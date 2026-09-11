import * as FirebirdRaw from 'node-firebird';
import type FirebirdType from 'node-firebird';

// Resolve CommonJS / ESM interop for node-firebird
const Firebird: typeof FirebirdType = ((FirebirdRaw as any).attach 
  ? FirebirdRaw 
  : ((FirebirdRaw as any).default || FirebirdRaw)) as any;

export interface DbConnectionOptions {
  id?: string;
  name?: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  role?: string;
  charset?: string;
}

export type CompareItemCategory = 
  | 'DOMAIN'
  | 'GENERATOR'
  | 'TABLE'
  | 'COLUMN'
  | 'PRIMARY_KEY'
  | 'FOREIGN_KEY'
  | 'VIEW'
  | 'PROCEDURE'
  | 'TRIGGER'
  | 'EXCEPTION'
  | 'DATA';

export type CompareItemStatus = 
  | 'EQUAL'
  | 'MISSING_IN_TARGET'
  | 'DIFFERENT'
  | 'MISSING_IN_SOURCE';

export interface CompareDiffItem {
  id: string;
  category: CompareItemCategory;
  objectName: string;
  parentTable?: string;
  status: CompareItemStatus;
  description: string;
  sourceValue?: string;
  targetValue?: string;
  migrationSql: string;
  canMigrate: boolean;
  selected: boolean;
  dataDiff?: {
    sourceRows: number;
    targetRows: number;
    missingInTargetCount: number;
    differingCount: number;
    extraInTargetCount: number;
  };
}

export interface CompareOptions {
  sourceConfig: DbConnectionOptions;
  targetConfig: DbConnectionOptions;
  compareMetadata: boolean;
  compareData: boolean;
  maxDataRowsPerTable?: number;
  selectedTables?: string[];
}

export interface CompareProgress {
  stage: string;
  percentage: number;
  message: string;
  currentTable?: string;
}

export interface CompareSummary {
  totalItems: number;
  equalCount: number;
  missingInTargetCount: number;
  differentCount: number;
  missingInSourceCount: number;
  dataDiffCount: number;
}

export interface CompareResult {
  success: boolean;
  sourceDatabase: string;
  targetDatabase: string;
  summary: CompareSummary;
  items: CompareDiffItem[];
  durationMs: number;
  error?: string;
}

export interface MigrationExecutionResult {
  success: boolean;
  statementsExecuted: number;
  errorsCount: number;
  errors: { statementSnippet: string; error: string }[];
  durationMs: number;
}

export class CompareService {
  private isCancelled: boolean = false;

  public cancel(): void {
    this.isCancelled = true;
  }

  private normalizeCharset(cs?: string): string {
    const raw = (cs || 'UTF8').trim().toUpperCase();
    if (raw === 'ISO-8859-1' || raw === 'ISO_8859_1' || raw === 'ISO8859-1') return 'ISO8859_1';
    return raw;
  }

  private attachDb(config: DbConnectionOptions): Promise<FirebirdType.Database> {
    return new Promise((resolve, reject) => {
      const fbOptions: FirebirdType.Options = {
        host: config.host || '127.0.0.1',
        port: Number(config.port) || 3050,
        database: config.database,
        user: config.user || 'SYSDBA',
        password: config.password || 'masterkey',
        role: config.role || undefined,
        encoding: this.normalizeCharset(config.charset) as any,
        blobAsText: true,
        lowercase_keys: false
      };

      Firebird.attach(fbOptions, (err, db) => {
        if (err) return reject(err);
        resolve(db);
      });
    });
  }

  private detachDb(db: FirebirdType.Database | null): Promise<void> {
    if (!db) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        db.detach((err) => {
          if (err) console.warn('Error detaching db in compare:', err);
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }

  private queryAsync(db: FirebirdType.Database, sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      db.query(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(Array.isArray(rows) ? rows : []);
      });
    });
  }

  private async readBlob(val: any): Promise<string> {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (Buffer.isBuffer(val)) return val.toString('utf-8');
    if (typeof val === 'function') {
      return new Promise((resolve) => {
        try {
          val((err: any, _name: any, emitter: any) => {
            if (err || !emitter) return resolve('');
            const chunks: Buffer[] = [];
            emitter.on('data', (chunk: Buffer) => chunks.push(chunk));
            emitter.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
            emitter.on('error', () => resolve(''));
          });
        } catch {
          resolve('');
        }
      });
    }
    return String(val);
  }

  private extractString(row: any, ...keys: string[]): string {
    if (!row || typeof row !== 'object') return '';
    for (const key of keys) {
      for (const rowKey of Object.keys(row)) {
        if (rowKey.toUpperCase() === key.toUpperCase()) {
          const val = row[rowKey];
          if (val === null || val === undefined) continue;
          if (Buffer.isBuffer(val)) return val.toString('utf-8').trim();
          return String(val).trim();
        }
      }
    }
    return '';
  }

  private extractNumber(row: any, ...keys: string[]): number {
    if (!row || typeof row !== 'object') return 0;
    for (const key of keys) {
      for (const rowKey of Object.keys(row)) {
        if (rowKey.toUpperCase() === key.toUpperCase()) {
          const val = row[rowKey];
          if (val === null || val === undefined) continue;
          const num = Number(val);
          return isNaN(num) ? 0 : num;
        }
      }
    }
    return 0;
  }

  private resolveFieldType(typeCode: number, subType: number, length: number, precision: number, scale: number): string {
    switch (typeCode) {
      case 7:
        if (scale < 0) return `NUMERIC(4, ${Math.abs(scale)})`;
        return 'SMALLINT';
      case 8:
        if (scale < 0) return `NUMERIC(9, ${Math.abs(scale)})`;
        return 'INTEGER';
      case 10:
        return 'FLOAT';
      case 12:
        return 'DATE';
      case 13:
        return 'TIME';
      case 14:
        return `CHAR(${length})`;
      case 16:
        if (scale < 0) return `NUMERIC(${precision || 18}, ${Math.abs(scale)})`;
        return 'BIGINT';
      case 27:
        return 'DOUBLE PRECISION';
      case 35:
        return 'TIMESTAMP';
      case 37:
        return `VARCHAR(${length})`;
      case 261:
        return subType === 1 ? 'BLOB SUB_TYPE TEXT' : 'BLOB SUB_TYPE BINARY';
      case 23:
      case 17:
        return 'BOOLEAN';
      default:
        return `TYPE_${typeCode}`;
    }
  }

  private decodeTriggerType(typeNum: number): string {
    const isBefore = (typeNum % 2) === 1;
    const actionNum = Math.floor((typeNum + 1) / 2);
    let timing = isBefore ? 'BEFORE' : 'AFTER';
    let event = 'INSERT';
    if (actionNum === 1) event = 'INSERT';
    else if (actionNum === 2) event = 'UPDATE';
    else if (actionNum === 3) event = 'DELETE';
    return `${timing} ${event}`;
  }

  private formatSqlValue(val: any): string {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (val instanceof Date) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const yyyy = val.getFullYear();
      const mm = pad(val.getMonth() + 1);
      const dd = pad(val.getDate());
      const hh = pad(val.getHours());
      const min = pad(val.getMinutes());
      const ss = pad(val.getSeconds());
      return `'${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}'`;
    }
    if (Buffer.isBuffer(val)) {
      return `x'${val.toString('hex')}'`;
    }
    const str = String(val).replace(/'/g, "''");
    return `'${str}'`;
  }

  private normalizeSql(sql: string): string {
    return sql
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  // Extract full database schema using bulk metadata queries
  private async loadDatabaseMetadata(db: FirebirdType.Database) {
    const tablesQuery = `
      SELECT TRIM(RDB$RELATION_NAME) AS NAME
      FROM RDB$RELATIONS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
        AND RDB$VIEW_BLR IS NULL
      ORDER BY 1
    `;

    const viewsQuery = `
      SELECT 
        TRIM(RDB$RELATION_NAME) AS NAME,
        RDB$VIEW_SOURCE AS SOURCE
      FROM RDB$RELATIONS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
        AND RDB$VIEW_BLR IS NOT NULL
      ORDER BY 1
    `;

    const proceduresQuery = `
      SELECT 
        TRIM(P.RDB$PROCEDURE_NAME) AS NAME,
        P.RDB$PROCEDURE_SOURCE AS SOURCE,
        COALESCE(P.RDB$PROCEDURE_INPUTS, 0) AS INPUTS,
        COALESCE(P.RDB$PROCEDURE_OUTPUTS, 0) AS OUTPUTS
      FROM RDB$PROCEDURES P
      WHERE (P.RDB$SYSTEM_FLAG = 0 OR P.RDB$SYSTEM_FLAG IS NULL)
      ORDER BY 1
    `;

    const procParamsQuery = `
      SELECT 
        TRIM(PP.RDB$PROCEDURE_NAME) AS PROC_NAME,
        TRIM(PP.RDB$PARAMETER_NAME) AS PARAM_NAME,
        PP.RDB$PARAMETER_TYPE AS PARAM_TYPE,
        PP.RDB$PARAMETER_NUMBER AS PARAM_NUM,
        F.RDB$FIELD_TYPE AS FIELD_TYPE_CODE,
        F.RDB$FIELD_SUB_TYPE AS FIELD_SUB_TYPE,
        F.RDB$FIELD_LENGTH AS FIELD_LENGTH,
        F.RDB$FIELD_PRECISION AS FIELD_PRECISION,
        F.RDB$FIELD_SCALE AS FIELD_SCALE
      FROM RDB$PROCEDURE_PARAMETERS PP
      JOIN RDB$FIELDS F ON PP.RDB$FIELD_SOURCE = F.RDB$FIELD_NAME
      ORDER BY PP.RDB$PROCEDURE_NAME, PP.RDB$PARAMETER_TYPE, PP.RDB$PARAMETER_NUMBER
    `;

    const triggersQuery = `
      SELECT 
        TRIM(T.RDB$TRIGGER_NAME) AS NAME,
        TRIM(T.RDB$RELATION_NAME) AS TABLE_NAME,
        COALESCE(T.RDB$TRIGGER_SEQUENCE, 0) AS SEQ,
        T.RDB$TRIGGER_TYPE AS TRIG_TYPE,
        COALESCE(T.RDB$TRIGGER_INACTIVE, 0) AS INACTIVE,
        T.RDB$TRIGGER_SOURCE AS SOURCE
      FROM RDB$TRIGGERS T
      WHERE (T.RDB$SYSTEM_FLAG = 0 OR T.RDB$SYSTEM_FLAG IS NULL)
      ORDER BY 1
    `;

    const generatorsQuery = `
      SELECT TRIM(RDB$GENERATOR_NAME) AS NAME
      FROM RDB$GENERATORS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
      ORDER BY 1
    `;

    const domainsQuery = `
      SELECT 
        TRIM(F.RDB$FIELD_NAME) AS DOMAIN_NAME,
        F.RDB$FIELD_TYPE AS FIELD_TYPE_CODE,
        F.RDB$FIELD_SUB_TYPE AS FIELD_SUB_TYPE,
        F.RDB$FIELD_LENGTH AS FIELD_LENGTH,
        F.RDB$FIELD_PRECISION AS FIELD_PRECISION,
        F.RDB$FIELD_SCALE AS FIELD_SCALE,
        TRIM(F.RDB$DEFAULT_SOURCE) AS DEFAULT_SOURCE,
        COALESCE(F.RDB$NULL_FLAG, 0) AS NULL_FLAG
      FROM RDB$FIELDS F
      WHERE (F.RDB$SYSTEM_FLAG = 0 OR F.RDB$SYSTEM_FLAG IS NULL)
        AND F.RDB$FIELD_NAME NOT STARTING WITH 'RDB$'
      ORDER BY F.RDB$FIELD_NAME
    `;

    const exceptionsQuery = `
      SELECT 
        TRIM(RDB$EXCEPTION_NAME) AS NAME,
        RDB$MESSAGE AS MESSAGE
      FROM RDB$EXCEPTIONS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
      ORDER BY 1
    `;

    const columnsQuery = `
      SELECT 
        TRIM(RF.RDB$RELATION_NAME) AS TABLE_NAME,
        TRIM(RF.RDB$FIELD_NAME) AS COLUMN_NAME,
        RF.RDB$FIELD_POSITION AS FIELD_POS,
        TRIM(F.RDB$FIELD_NAME) AS DOMAIN_NAME,
        F.RDB$FIELD_TYPE AS FIELD_TYPE_CODE,
        F.RDB$FIELD_SUB_TYPE AS FIELD_SUB_TYPE,
        F.RDB$FIELD_LENGTH AS FIELD_LENGTH,
        F.RDB$FIELD_PRECISION AS FIELD_PRECISION,
        F.RDB$FIELD_SCALE AS FIELD_SCALE,
        COALESCE(RF.RDB$NULL_FLAG, F.RDB$NULL_FLAG, 0) AS NULL_FLAG,
        TRIM(RF.RDB$DEFAULT_SOURCE) AS DEFAULT_VALUE
      FROM RDB$RELATION_FIELDS RF
      JOIN RDB$FIELDS F ON RF.RDB$FIELD_SOURCE = F.RDB$FIELD_NAME
      JOIN RDB$RELATIONS R ON R.RDB$RELATION_NAME = RF.RDB$RELATION_NAME
      WHERE (R.RDB$SYSTEM_FLAG = 0 OR R.RDB$SYSTEM_FLAG IS NULL)
        AND R.RDB$VIEW_BLR IS NULL
      ORDER BY RF.RDB$RELATION_NAME, RF.RDB$FIELD_POSITION
    `;

    const primaryKeysQuery = `
      SELECT 
        TRIM(RC.RDB$RELATION_NAME) AS TABLE_NAME,
        TRIM(RC.RDB$CONSTRAINT_NAME) AS PK_NAME,
        TRIM(ISG.RDB$FIELD_NAME) AS FIELD_NAME,
        ISG.RDB$FIELD_POSITION AS POS
      FROM RDB$RELATION_CONSTRAINTS RC
      JOIN RDB$INDEX_SEGMENTS ISG ON ISG.RDB$INDEX_NAME = RC.RDB$INDEX_NAME
      WHERE RC.RDB$CONSTRAINT_TYPE = 'PRIMARY KEY'
      ORDER BY RC.RDB$RELATION_NAME, ISG.RDB$FIELD_POSITION
    `;

    const foreignKeysQuery = `
      SELECT 
        TRIM(RC.RDB$CONSTRAINT_NAME) AS CONSTRAINT_NAME,
        TRIM(RC.RDB$RELATION_NAME) AS TABLE_NAME,
        TRIM(S.RDB$FIELD_NAME) AS FIELD_NAME,
        TRIM(REF_RC.RDB$RELATION_NAME) AS REF_TABLE_NAME,
        TRIM(REF_S.RDB$FIELD_NAME) AS REF_FIELD_NAME,
        TRIM(REF_C.RDB$UPDATE_RULE) AS UPDATE_RULE,
        TRIM(REF_C.RDB$DELETE_RULE) AS DELETE_RULE
      FROM RDB$RELATION_CONSTRAINTS RC
      JOIN RDB$REF_CONSTRAINTS REF_C ON RC.RDB$CONSTRAINT_NAME = REF_C.RDB$CONSTRAINT_NAME
      JOIN RDB$RELATION_CONSTRAINTS REF_RC ON REF_C.RDB$CONST_NAME_UQ = REF_RC.RDB$CONSTRAINT_NAME
      JOIN RDB$INDEX_SEGMENTS S ON RC.RDB$INDEX_NAME = S.RDB$INDEX_NAME
      JOIN RDB$INDEX_SEGMENTS REF_S ON REF_RC.RDB$INDEX_NAME = REF_S.RDB$INDEX_NAME AND S.RDB$FIELD_POSITION = REF_S.RDB$FIELD_POSITION
      WHERE RC.RDB$CONSTRAINT_TYPE = 'FOREIGN KEY'
      ORDER BY RC.RDB$RELATION_NAME, RC.RDB$CONSTRAINT_NAME, S.RDB$FIELD_POSITION
    `;

    const [
      tableRows,
      viewRows,
      procRows,
      paramRows,
      trigRows,
      genRows,
      domainRows,
      excRows,
      colRows,
      pkRows,
      fkRows
    ] = await Promise.all([
      this.queryAsync(db, tablesQuery),
      this.queryAsync(db, viewsQuery),
      this.queryAsync(db, proceduresQuery),
      this.queryAsync(db, procParamsQuery),
      this.queryAsync(db, triggersQuery),
      this.queryAsync(db, generatorsQuery),
      this.queryAsync(db, domainsQuery),
      this.queryAsync(db, exceptionsQuery),
      this.queryAsync(db, columnsQuery),
      this.queryAsync(db, primaryKeysQuery),
      this.queryAsync(db, foreignKeysQuery)
    ]);

    // 1. Tables list
    const tables = tableRows.map(r => this.extractString(r, 'NAME')).filter(Boolean);

    // 2. Views
    const views = new Map<string, { name: string; source: string }>();
    for (const r of viewRows) {
      const name = this.extractString(r, 'NAME');
      if (name) {
        const source = await this.readBlob(r.SOURCE || r.RDB$VIEW_SOURCE);
        views.set(name, { name, source });
      }
    }

    // 3. Procedures
    const procParamsMap = new Map<string, { inParams: { name: string; type: string }[]; outParams: { name: string; type: string }[] }>();
    for (const r of paramRows) {
      const procName = this.extractString(r, 'PROC_NAME');
      const paramName = this.extractString(r, 'PARAM_NAME');
      const paramType = this.extractNumber(r, 'PARAM_TYPE');
      const typeStr = this.resolveFieldType(
        this.extractNumber(r, 'FIELD_TYPE_CODE'),
        this.extractNumber(r, 'FIELD_SUB_TYPE'),
        this.extractNumber(r, 'FIELD_LENGTH'),
        this.extractNumber(r, 'FIELD_PRECISION'),
        this.extractNumber(r, 'FIELD_SCALE')
      );

      if (!procParamsMap.has(procName)) {
        procParamsMap.set(procName, { inParams: [], outParams: [] });
      }
      const entry = procParamsMap.get(procName)!;
      if (paramType === 0) {
        entry.inParams.push({ name: paramName, type: typeStr });
      } else {
        entry.outParams.push({ name: paramName, type: typeStr });
      }
    }

    const procedures = new Map<string, {
      name: string;
      source: string;
      inParams: { name: string; type: string }[];
      outParams: { name: string; type: string }[];
      ddl: string;
    }>();

    for (const r of procRows) {
      const name = this.extractString(r, 'NAME');
      if (name) {
        const source = await this.readBlob(r.SOURCE || r.RDB$PROCEDURE_SOURCE);
        const params = procParamsMap.get(name) || { inParams: [], outParams: [] };
        
        let ddl = `CREATE OR ALTER PROCEDURE ${name}`;
        if (params.inParams.length > 0) {
          ddl += ` (\n` + params.inParams.map(p => `    ${p.name} ${p.type}`).join(',\n') + `\n)`;
        }
        if (params.outParams.length > 0) {
          ddl += `\nRETURNS (\n` + params.outParams.map(p => `    ${p.name} ${p.type}`).join(',\n') + `\n)`;
        }
        ddl += `\nAS\n`;
        const body = source.trim();
        if (body.toUpperCase().startsWith('BEGIN') || body.toUpperCase().startsWith('DECLARE')) {
          ddl += body;
        } else {
          ddl += `BEGIN\n  ${body}\nEND`;
        }

        procedures.set(name, {
          name,
          source,
          inParams: params.inParams,
          outParams: params.outParams,
          ddl
        });
      }
    }

    // 4. Triggers
    const triggers = new Map<string, {
      name: string;
      tableName: string;
      seq: number;
      trigType: number;
      inactive: boolean;
      source: string;
      ddl: string;
    }>();

    for (const r of trigRows) {
      const name = this.extractString(r, 'NAME');
      const tableName = this.extractString(r, 'TABLE_NAME');
      const seq = this.extractNumber(r, 'SEQ');
      const trigType = this.extractNumber(r, 'TRIG_TYPE');
      const inactive = this.extractNumber(r, 'INACTIVE') === 1;
      const source = await this.readBlob(r.SOURCE || r.RDB$TRIGGER_SOURCE);

      const status = inactive ? 'INACTIVE' : 'ACTIVE';
      const eventType = this.decodeTriggerType(trigType || 1);
      const ddl = `CREATE OR ALTER TRIGGER ${name} FOR ${tableName}\n${status} ${eventType} POSITION ${seq}\nAS\n${source.trim()}`;

      triggers.set(name, {
        name,
        tableName,
        seq,
        trigType,
        inactive,
        source,
        ddl
      });
    }

    // 5. Generators & Values
    const generators = new Map<string, number>();
    for (const r of genRows) {
      const name = this.extractString(r, 'NAME');
      if (name) {
        let val = 0;
        try {
          const valRes = await this.queryAsync(db, `SELECT GEN_ID(${name}, 0) AS VAL FROM RDB$DATABASE`);
          val = this.extractNumber(valRes[0], 'VAL');
        } catch {
          val = 0;
        }
        generators.set(name, val);
      }
    }

    // 6. Domains
    const domains = new Map<string, {
      name: string;
      type: string;
      defaultSource?: string;
      notNull: boolean;
      ddl: string;
    }>();

    for (const r of domainRows) {
      const name = this.extractString(r, 'DOMAIN_NAME');
      const typeStr = this.resolveFieldType(
        this.extractNumber(r, 'FIELD_TYPE_CODE'),
        this.extractNumber(r, 'FIELD_SUB_TYPE'),
        this.extractNumber(r, 'FIELD_LENGTH'),
        this.extractNumber(r, 'FIELD_PRECISION'),
        this.extractNumber(r, 'FIELD_SCALE')
      );
      const defVal = this.extractString(r, 'DEFAULT_SOURCE');
      const isNotNull = this.extractNumber(r, 'NULL_FLAG') === 1;

      let ddl = `CREATE DOMAIN ${name} AS ${typeStr}`;
      if (defVal) ddl += ` ${defVal}`;
      if (isNotNull) ddl += ` NOT NULL`;
      ddl += `;`;

      domains.set(name, {
        name,
        type: typeStr,
        defaultSource: defVal || undefined,
        notNull: isNotNull,
        ddl
      });
    }

    // 7. Exceptions
    const exceptions = new Map<string, string>();
    for (const r of excRows) {
      const name = this.extractString(r, 'NAME');
      const msg = this.extractString(r, 'MESSAGE');
      if (name) exceptions.set(name, msg);
    }

    // 8. Columns by Table
    interface ColumnMeta {
      name: string;
      type: string;
      position: number;
      isNullable: boolean;
      defaultValue?: string;
      domainName?: string;
    }
    const columnsByTable = new Map<string, Map<string, ColumnMeta>>();
    for (const r of colRows) {
      const tbl = this.extractString(r, 'TABLE_NAME');
      const col = this.extractString(r, 'COLUMN_NAME');
      const typeStr = this.resolveFieldType(
        this.extractNumber(r, 'FIELD_TYPE_CODE'),
        this.extractNumber(r, 'FIELD_SUB_TYPE'),
        this.extractNumber(r, 'FIELD_LENGTH'),
        this.extractNumber(r, 'FIELD_PRECISION'),
        this.extractNumber(r, 'FIELD_SCALE')
      );
      const pos = this.extractNumber(r, 'FIELD_POS');
      const isNullable = this.extractNumber(r, 'NULL_FLAG') === 0;
      const defVal = this.extractString(r, 'DEFAULT_VALUE');
      const domainName = this.extractString(r, 'DOMAIN_NAME');

      if (!columnsByTable.has(tbl)) {
        columnsByTable.set(tbl, new Map());
      }
      columnsByTable.get(tbl)!.set(col, {
        name: col,
        type: typeStr,
        position: pos,
        isNullable,
        defaultValue: defVal || undefined,
        domainName: domainName || undefined
      });
    }

    // 9. Primary Keys by Table
    const pkByTable = new Map<string, { pkName: string; columns: string[] }>();
    for (const r of pkRows) {
      const tbl = this.extractString(r, 'TABLE_NAME');
      const pkName = this.extractString(r, 'PK_NAME');
      const field = this.extractString(r, 'FIELD_NAME');

      if (!pkByTable.has(tbl)) {
        pkByTable.set(tbl, { pkName, columns: [] });
      }
      pkByTable.get(tbl)!.columns.push(field);
    }

    // 10. Foreign Keys
    interface FkMeta {
      name: string;
      table: string;
      fields: string[];
      refTable: string;
      refFields: string[];
      updateRule: string;
      deleteRule: string;
    }
    const foreignKeys = new Map<string, FkMeta>();
    for (const r of fkRows) {
      const name = this.extractString(r, 'CONSTRAINT_NAME');
      const tbl = this.extractString(r, 'TABLE_NAME');
      const refTbl = this.extractString(r, 'REF_TABLE_NAME');
      const field = this.extractString(r, 'FIELD_NAME');
      const refField = this.extractString(r, 'REF_FIELD_NAME');
      const updateRule = this.extractString(r, 'UPDATE_RULE') || 'RESTRICT';
      const deleteRule = this.extractString(r, 'DELETE_RULE') || 'RESTRICT';

      if (!foreignKeys.has(name)) {
        foreignKeys.set(name, {
          name,
          table: tbl,
          fields: [],
          refTable: refTbl,
          refFields: [],
          updateRule,
          deleteRule
        });
      }
      const fk = foreignKeys.get(name)!;
      if (!fk.fields.includes(field)) fk.fields.push(field);
      if (!fk.refFields.includes(refField)) fk.refFields.push(refField);
    }

    return {
      tables,
      views,
      procedures,
      triggers,
      generators,
      domains,
      exceptions,
      columnsByTable,
      pkByTable,
      foreignKeys
    };
  }

  // Main Database Comparison entrypoint
  public async compareDatabases(
    options: CompareOptions,
    onProgress: (p: CompareProgress) => void
  ): Promise<CompareResult> {
    this.isCancelled = false;
    const startTime = Date.now();

    let sourceDb: FirebirdType.Database | null = null;
    let targetDb: FirebirdType.Database | null = null;

    const items: CompareDiffItem[] = [];

    try {
      // 1. Connect to Source
      onProgress({
        stage: 'CONNECTING',
        percentage: 5,
        message: `Conectando a la base de datos de origen (${options.sourceConfig.name || options.sourceConfig.database})...`
      });
      sourceDb = await this.attachDb(options.sourceConfig);

      // 2. Connect to Target
      onProgress({
        stage: 'CONNECTING',
        percentage: 10,
        message: `Conectando a la base de datos de destino (${options.targetConfig.name || options.targetConfig.database})...`
      });
      targetDb = await this.attachDb(options.targetConfig);

      if (this.isCancelled) throw new Error('Comparación cancelada.');

      // 3. Extract metadata from Source
      onProgress({
        stage: 'METADATA_SOURCE',
        percentage: 20,
        message: 'Leyendo estructura y metadatos de la base de origen...'
      });
      const srcMeta = await this.loadDatabaseMetadata(sourceDb);

      if (this.isCancelled) throw new Error('Comparación cancelada.');

      // 4. Extract metadata from Target
      onProgress({
        stage: 'METADATA_TARGET',
        percentage: 35,
        message: 'Leyendo estructura y metadatos de la base de destino...'
      });
      const tgtMeta = await this.loadDatabaseMetadata(targetDb);

      if (this.isCancelled) throw new Error('Comparación cancelada.');

      // 5. Compare Metadata
      onProgress({
        stage: 'COMPARING_METADATA',
        percentage: 50,
        message: 'Comparando tablas, columnas, procedimientos y vistas...'
      });

      // A. DOMAINS
      for (const [domName, srcDom] of srcMeta.domains.entries()) {
        const tgtDom = tgtMeta.domains.get(domName);
        if (!tgtDom) {
          items.push({
            id: `dom_${domName}`,
            category: 'DOMAIN',
            objectName: domName,
            status: 'MISSING_IN_TARGET',
            description: `Dominio falta en destino (${srcDom.type})`,
            sourceValue: srcDom.ddl,
            migrationSql: srcDom.ddl,
            canMigrate: true,
            selected: true
          });
        } else if (
          srcDom.type !== tgtDom.type ||
          srcDom.notNull !== tgtDom.notNull ||
          (srcDom.defaultSource || '') !== (tgtDom.defaultSource || '')
        ) {
          items.push({
            id: `dom_${domName}`,
            category: 'DOMAIN',
            objectName: domName,
            status: 'DIFFERENT',
            description: `Dominio difiere: Origen [${srcDom.type}] vs Destino [${tgtDom.type}]`,
            sourceValue: srcDom.ddl,
            targetValue: tgtDom.ddl,
            migrationSql: `ALTER DOMAIN ${domName} TYPE ${srcDom.type};`,
            canMigrate: true,
            selected: true
          });
        } else {
          items.push({
            id: `dom_${domName}`,
            category: 'DOMAIN',
            objectName: domName,
            status: 'EQUAL',
            description: `Dominio idéntico (${srcDom.type})`,
            sourceValue: srcDom.ddl,
            targetValue: tgtDom.ddl,
            migrationSql: '',
            canMigrate: false,
            selected: false
          });
        }
      }
      for (const [domName, tgtDom] of tgtMeta.domains.entries()) {
        if (!srcMeta.domains.has(domName)) {
          items.push({
            id: `dom_extra_${domName}`,
            category: 'DOMAIN',
            objectName: domName,
            status: 'MISSING_IN_SOURCE',
            description: 'Dominio existe solo en el destino',
            targetValue: tgtDom.ddl,
            migrationSql: `-- DROP DOMAIN ${domName};`,
            canMigrate: false,
            selected: false
          });
        }
      }

      // B. GENERATORS / SEQUENCES
      for (const [genName, srcVal] of srcMeta.generators.entries()) {
        if (!tgtMeta.generators.has(genName)) {
          const createSql = `EXECUTE BLOCK AS BEGIN IF (NOT EXISTS (SELECT 1 FROM RDB$GENERATORS WHERE TRIM(RDB$GENERATOR_NAME) = '${genName}')) THEN EXECUTE STATEMENT 'CREATE SEQUENCE ${genName}'; END;\nSET GENERATOR ${genName} TO ${srcVal};`;
          items.push({
            id: `gen_${genName}`,
            category: 'GENERATOR',
            objectName: genName,
            status: 'MISSING_IN_TARGET',
            description: `Generador/Secuencia falta en destino (Valor actual: ${srcVal})`,
            sourceValue: `Valor actual: ${srcVal}`,
            migrationSql: createSql,
            canMigrate: true,
            selected: true
          });
        } else {
          const tgtVal = tgtMeta.generators.get(genName)!;
          if (srcVal !== tgtVal) {
            items.push({
              id: `gen_${genName}`,
              category: 'GENERATOR',
              objectName: genName,
              status: 'DIFFERENT',
              description: `Valor diferente: Origen [${srcVal}] vs Destino [${tgtVal}]`,
              sourceValue: `Valor: ${srcVal}`,
              targetValue: `Valor: ${tgtVal}`,
              migrationSql: `SET GENERATOR ${genName} TO ${srcVal};`,
              canMigrate: true,
              selected: srcVal > tgtVal // Default select if source is ahead
            });
          } else {
            items.push({
              id: `gen_${genName}`,
              category: 'GENERATOR',
              objectName: genName,
              status: 'EQUAL',
              description: `Generador idéntico (Valor: ${srcVal})`,
              sourceValue: `Valor: ${srcVal}`,
              targetValue: `Valor: ${tgtVal}`,
              migrationSql: '',
              canMigrate: false,
              selected: false
            });
          }
        }
      }
      for (const [genName, tgtVal] of tgtMeta.generators.entries()) {
        if (!srcMeta.generators.has(genName)) {
          items.push({
            id: `gen_extra_${genName}`,
            category: 'GENERATOR',
            objectName: genName,
            status: 'MISSING_IN_SOURCE',
            description: `Generador existe solo en destino (Valor: ${tgtVal})`,
            targetValue: `Valor: ${tgtVal}`,
            migrationSql: `-- DROP SEQUENCE ${genName};`,
            canMigrate: false,
            selected: false
          });
        }
      }

      // C. TABLES & COLUMNS & PRIMARY KEYS
      const allTableNames = Array.from(new Set([...srcMeta.tables, ...tgtMeta.tables]));
      const tablesToCompare = options.selectedTables && options.selectedTables.length > 0
        ? allTableNames.filter(t => options.selectedTables!.includes(t))
        : allTableNames;

      for (const tableName of tablesToCompare) {
        const inSource = srcMeta.tables.includes(tableName);
        const inTarget = tgtMeta.tables.includes(tableName);

        if (inSource && !inTarget) {
          // Table completely missing in target -> Full CREATE TABLE
          const colsMap = srcMeta.columnsByTable.get(tableName);
          const cols = colsMap ? Array.from(colsMap.values()).sort((a, b) => a.position - b.position) : [];
          const pk = srcMeta.pkByTable.get(tableName);

          let tableDdl = `CREATE TABLE ${tableName} (\n`;
          const colDefs: string[] = [];
          for (const col of cols) {
            let colDef = `    ${col.name} ${col.type}`;
            if (col.defaultValue) colDef += ` ${col.defaultValue}`;
            if (!col.isNullable) colDef += ` NOT NULL`;
            colDefs.push(colDef);
          }
          if (pk && pk.columns.length > 0) {
            colDefs.push(`    CONSTRAINT PK_${tableName} PRIMARY KEY (${pk.columns.join(', ')})`);
          }
          tableDdl += colDefs.join(',\n') + '\n);';

          items.push({
            id: `tbl_${tableName}`,
            category: 'TABLE',
            objectName: tableName,
            status: 'MISSING_IN_TARGET',
            description: `Tabla falta en destino (${cols.length} campos)`,
            sourceValue: tableDdl,
            migrationSql: tableDdl,
            canMigrate: true,
            selected: true
          });
        } else if (!inSource && inTarget) {
          items.push({
            id: `tbl_extra_${tableName}`,
            category: 'TABLE',
            objectName: tableName,
            status: 'MISSING_IN_SOURCE',
            description: 'Tabla existe solo en el destino',
            targetValue: `Tabla: ${tableName}`,
            migrationSql: `-- DROP TABLE ${tableName};`,
            canMigrate: false,
            selected: false
          });
        } else {
          // Present in both: Compare Columns
          const srcCols = srcMeta.columnsByTable.get(tableName) || new Map();
          const tgtCols = tgtMeta.columnsByTable.get(tableName) || new Map();

          let tableHasDiffs = false;

          for (const [colName, srcCol] of srcCols.entries()) {
            const tgtCol = tgtCols.get(colName);
            if (!tgtCol) {
              tableHasDiffs = true;
              let addSql = `ALTER TABLE ${tableName} ADD ${colName} ${srcCol.type}`;
              if (srcCol.defaultValue) addSql += ` ${srcCol.defaultValue}`;
              addSql += ';';

              items.push({
                id: `col_${tableName}_${colName}`,
                category: 'COLUMN',
                objectName: `${tableName}.${colName}`,
                parentTable: tableName,
                status: 'MISSING_IN_TARGET',
                description: `Columna falta en destino: ${srcCol.type}${!srcCol.isNullable ? ' NOT NULL' : ''}`,
                sourceValue: `${srcCol.name} ${srcCol.type}`,
                migrationSql: addSql,
                canMigrate: true,
                selected: true
              });
            } else if (srcCol.type !== tgtCol.type) {
              tableHasDiffs = true;
              const alterSql = `ALTER TABLE ${tableName} ALTER COLUMN ${colName} TYPE ${srcCol.type};`;
              items.push({
                id: `col_${tableName}_${colName}`,
                category: 'COLUMN',
                objectName: `${tableName}.${colName}`,
                parentTable: tableName,
                status: 'DIFFERENT',
                description: `Tipo de columna difiere: Origen [${srcCol.type}] vs Destino [${tgtCol.type}]`,
                sourceValue: `${srcCol.name} ${srcCol.type}`,
                targetValue: `${tgtCol.name} ${tgtCol.type}`,
                migrationSql: alterSql,
                canMigrate: true,
                selected: true
              });
            } else {
              items.push({
                id: `col_${tableName}_${colName}`,
                category: 'COLUMN',
                objectName: `${tableName}.${colName}`,
                parentTable: tableName,
                status: 'EQUAL',
                description: `Columna idéntica (${srcCol.type})`,
                sourceValue: `${srcCol.name} ${srcCol.type}`,
                targetValue: `${tgtCol.name} ${tgtCol.type}`,
                migrationSql: '',
                canMigrate: false,
                selected: false
              });
            }
          }

          for (const [colName, tgtCol] of tgtCols.entries()) {
            if (!srcCols.has(colName)) {
              tableHasDiffs = true;
              items.push({
                id: `col_extra_${tableName}_${colName}`,
                category: 'COLUMN',
                objectName: `${tableName}.${colName}`,
                parentTable: tableName,
                status: 'MISSING_IN_SOURCE',
                description: `Columna existe solo en destino (${tgtCol.type})`,
                targetValue: `${tgtCol.name} ${tgtCol.type}`,
                migrationSql: `-- ALTER TABLE ${tableName} DROP ${colName};`,
                canMigrate: false,
                selected: false
              });
            }
          }

          // Compare Primary Key
          const srcPk = srcMeta.pkByTable.get(tableName);
          const tgtPk = tgtMeta.pkByTable.get(tableName);

          const srcPkCols = srcPk ? srcPk.columns.slice().sort() : [];
          const tgtPkCols = tgtPk ? tgtPk.columns.slice().sort() : [];

          if (srcPkCols.length > 0 && tgtPkCols.length === 0) {
            tableHasDiffs = true;
            const addPkSql = `ALTER TABLE ${tableName} ADD CONSTRAINT PK_${tableName} PRIMARY KEY (${srcPk!.columns.join(', ')});`;
            items.push({
              id: `pk_${tableName}`,
              category: 'PRIMARY_KEY',
              objectName: `PK_${tableName}`,
              parentTable: tableName,
              status: 'MISSING_IN_TARGET',
              description: `Clave primaria falta en destino (${srcPk!.columns.join(', ')})`,
              sourceValue: `PK (${srcPk!.columns.join(', ')})`,
              migrationSql: addPkSql,
              canMigrate: true,
              selected: true
            });
          } else if (srcPkCols.length > 0 && tgtPkCols.length > 0 && srcPkCols.join(',') !== tgtPkCols.join(',')) {
            tableHasDiffs = true;
            let alterPkSql = '';
            if (tgtPk?.pkName) {
              alterPkSql += `ALTER TABLE ${tableName} DROP CONSTRAINT ${tgtPk.pkName};\n`;
            }
            alterPkSql += `ALTER TABLE ${tableName} ADD CONSTRAINT PK_${tableName} PRIMARY KEY (${srcPk!.columns.join(', ')});`;

            items.push({
              id: `pk_${tableName}`,
              category: 'PRIMARY_KEY',
              objectName: `PK_${tableName}`,
              parentTable: tableName,
              status: 'DIFFERENT',
              description: `Clave primaria difiere: Origen [${srcPk!.columns.join(', ')}] vs Destino [${tgtPk!.columns.join(', ')}]`,
              sourceValue: `PK (${srcPk!.columns.join(', ')})`,
              targetValue: `PK (${tgtPk!.columns.join(', ')})`,
              migrationSql: alterPkSql,
              canMigrate: true,
              selected: true
            });
          } else if (srcPkCols.length > 0) {
            items.push({
              id: `pk_${tableName}`,
              category: 'PRIMARY_KEY',
              objectName: `PK_${tableName}`,
              parentTable: tableName,
              status: 'EQUAL',
              description: `Clave primaria idéntica (${srcPk!.columns.join(', ')})`,
              sourceValue: `PK (${srcPk!.columns.join(', ')})`,
              targetValue: `PK (${tgtPk!.columns.join(', ')})`,
              migrationSql: '',
              canMigrate: false,
              selected: false
            });
          }

          // Table summary item
          items.push({
            id: `tbl_${tableName}`,
            category: 'TABLE',
            objectName: tableName,
            status: tableHasDiffs ? 'DIFFERENT' : 'EQUAL',
            description: tableHasDiffs
              ? `Estructura de tabla con diferencias en campos o índices`
              : `Estructura de tabla idéntica (${srcCols.size} campos)`,
            migrationSql: '',
            canMigrate: false,
            selected: false
          });
        }
      }

      // D. FOREIGN KEYS
      for (const [fkName, srcFk] of srcMeta.foreignKeys.entries()) {
        const tgtFk = tgtMeta.foreignKeys.get(fkName);
        const fkSql = `ALTER TABLE ${srcFk.table} ADD CONSTRAINT ${fkName} FOREIGN KEY (${srcFk.fields.join(', ')}) REFERENCES ${srcFk.refTable} (${srcFk.refFields.join(', ')})${srcFk.updateRule && srcFk.updateRule !== 'RESTRICT' ? ' ON UPDATE ' + srcFk.updateRule : ''}${srcFk.deleteRule && srcFk.deleteRule !== 'RESTRICT' ? ' ON DELETE ' + srcFk.deleteRule : ''};`;

        if (!tgtFk) {
          items.push({
            id: `fk_${fkName}`,
            category: 'FOREIGN_KEY',
            objectName: fkName,
            parentTable: srcFk.table,
            status: 'MISSING_IN_TARGET',
            description: `Clave foránea falta en destino (${srcFk.table} -> ${srcFk.refTable})`,
            sourceValue: `${srcFk.table}(${srcFk.fields.join(',')}) -> ${srcFk.refTable}(${srcFk.refFields.join(',')})`,
            migrationSql: fkSql,
            canMigrate: true,
            selected: true
          });
        } else if (
          srcFk.table !== tgtFk.table ||
          srcFk.refTable !== tgtFk.refTable ||
          srcFk.fields.join(',') !== tgtFk.fields.join(',') ||
          srcFk.refFields.join(',') !== tgtFk.refFields.join(',')
        ) {
          items.push({
            id: `fk_${fkName}`,
            category: 'FOREIGN_KEY',
            objectName: fkName,
            parentTable: srcFk.table,
            status: 'DIFFERENT',
            description: `Definición de clave foránea difiere`,
            sourceValue: `${srcFk.table}(${srcFk.fields.join(',')}) -> ${srcFk.refTable}`,
            targetValue: `${tgtFk.table}(${tgtFk.fields.join(',')}) -> ${tgtFk.refTable}`,
            migrationSql: `ALTER TABLE ${srcFk.table} DROP CONSTRAINT ${fkName};\n${fkSql}`,
            canMigrate: true,
            selected: true
          });
        } else {
          items.push({
            id: `fk_${fkName}`,
            category: 'FOREIGN_KEY',
            objectName: fkName,
            parentTable: srcFk.table,
            status: 'EQUAL',
            description: `Clave foránea idéntica (${srcFk.table} -> ${srcFk.refTable})`,
            sourceValue: `${srcFk.table} -> ${srcFk.refTable}`,
            targetValue: `${tgtFk.table} -> ${tgtFk.refTable}`,
            migrationSql: '',
            canMigrate: false,
            selected: false
          });
        }
      }

      // E. VIEWS
      for (const [viewName, srcView] of srcMeta.views.entries()) {
        const tgtView = tgtMeta.views.get(viewName);
        const viewSql = `CREATE OR ALTER VIEW ${viewName} AS\n${srcView.source.trim()};\n`;

        if (!tgtView) {
          items.push({
            id: `view_${viewName}`,
            category: 'VIEW',
            objectName: viewName,
            status: 'MISSING_IN_TARGET',
            description: 'Vista falta en destino',
            sourceValue: srcView.source,
            migrationSql: viewSql,
            canMigrate: true,
            selected: true
          });
        } else if (this.normalizeSql(srcView.source) !== this.normalizeSql(tgtView.source)) {
          items.push({
            id: `view_${viewName}`,
            category: 'VIEW',
            objectName: viewName,
            status: 'DIFFERENT',
            description: 'Código de la vista difiere',
            sourceValue: srcView.source,
            targetValue: tgtView.source,
            migrationSql: viewSql,
            canMigrate: true,
            selected: true
          });
        } else {
          items.push({
            id: `view_${viewName}`,
            category: 'VIEW',
            objectName: viewName,
            status: 'EQUAL',
            description: 'Vista idéntica',
            sourceValue: srcView.source,
            targetValue: tgtView.source,
            migrationSql: '',
            canMigrate: false,
            selected: false
          });
        }
      }
      for (const [viewName, tgtView] of tgtMeta.views.entries()) {
        if (!srcMeta.views.has(viewName)) {
          items.push({
            id: `view_extra_${viewName}`,
            category: 'VIEW',
            objectName: viewName,
            status: 'MISSING_IN_SOURCE',
            description: 'Vista existe solo en destino',
            targetValue: tgtView.source,
            migrationSql: `-- DROP VIEW ${viewName};`,
            canMigrate: false,
            selected: false
          });
        }
      }

      // F. STORED PROCEDURES
      for (const [procName, srcProc] of srcMeta.procedures.entries()) {
        const tgtProc = tgtMeta.procedures.get(procName);
        const procSql = srcProc.ddl + ';\n';

        if (!tgtProc) {
          items.push({
            id: `proc_${procName}`,
            category: 'PROCEDURE',
            objectName: procName,
            status: 'MISSING_IN_TARGET',
            description: `Procedimiento falta en destino (${srcProc.inParams.length} in, ${srcProc.outParams.length} out)`,
            sourceValue: srcProc.ddl,
            migrationSql: procSql,
            canMigrate: true,
            selected: true
          });
        } else if (
          this.normalizeSql(srcProc.ddl) !== this.normalizeSql(tgtProc.ddl)
        ) {
          items.push({
            id: `proc_${procName}`,
            category: 'PROCEDURE',
            objectName: procName,
            status: 'DIFFERENT',
            description: 'Firma o código del procedimiento difiere',
            sourceValue: srcProc.ddl,
            targetValue: tgtProc.ddl,
            migrationSql: procSql,
            canMigrate: true,
            selected: true
          });
        } else {
          items.push({
            id: `proc_${procName}`,
            category: 'PROCEDURE',
            objectName: procName,
            status: 'EQUAL',
            description: 'Procedimiento almacenado idéntico',
            sourceValue: srcProc.ddl,
            targetValue: tgtProc.ddl,
            migrationSql: '',
            canMigrate: false,
            selected: false
          });
        }
      }
      for (const [procName, tgtProc] of tgtMeta.procedures.entries()) {
        if (!srcMeta.procedures.has(procName)) {
          items.push({
            id: `proc_extra_${procName}`,
            category: 'PROCEDURE',
            objectName: procName,
            status: 'MISSING_IN_SOURCE',
            description: 'Procedimiento existe solo en destino',
            targetValue: tgtProc.ddl,
            migrationSql: `-- DROP PROCEDURE ${procName};`,
            canMigrate: false,
            selected: false
          });
        }
      }

      // G. TRIGGERS
      for (const [trigName, srcTrig] of srcMeta.triggers.entries()) {
        const tgtTrig = tgtMeta.triggers.get(trigName);
        const trigSql = srcTrig.ddl + ';\n';

        if (!tgtTrig) {
          items.push({
            id: `trig_${trigName}`,
            category: 'TRIGGER',
            objectName: trigName,
            parentTable: srcTrig.tableName,
            status: 'MISSING_IN_TARGET',
            description: `Trigger falta en destino (Tabla: ${srcTrig.tableName})`,
            sourceValue: srcTrig.ddl,
            migrationSql: trigSql,
            canMigrate: true,
            selected: true
          });
        } else if (
          srcTrig.tableName !== tgtTrig.tableName ||
          srcTrig.trigType !== tgtTrig.trigType ||
          srcTrig.inactive !== tgtTrig.inactive ||
          this.normalizeSql(srcTrig.source) !== this.normalizeSql(tgtTrig.source)
        ) {
          items.push({
            id: `trig_${trigName}`,
            category: 'TRIGGER',
            objectName: trigName,
            parentTable: srcTrig.tableName,
            status: 'DIFFERENT',
            description: `Código o evento del trigger difiere`,
            sourceValue: srcTrig.ddl,
            targetValue: tgtTrig.ddl,
            migrationSql: trigSql,
            canMigrate: true,
            selected: true
          });
        } else {
          items.push({
            id: `trig_${trigName}`,
            category: 'TRIGGER',
            objectName: trigName,
            parentTable: srcTrig.tableName,
            status: 'EQUAL',
            description: `Trigger idéntico (${srcTrig.tableName})`,
            sourceValue: srcTrig.ddl,
            targetValue: tgtTrig.ddl,
            migrationSql: '',
            canMigrate: false,
            selected: false
          });
        }
      }
      for (const [trigName, tgtTrig] of tgtMeta.triggers.entries()) {
        if (!srcMeta.triggers.has(trigName)) {
          items.push({
            id: `trig_extra_${trigName}`,
            category: 'TRIGGER',
            objectName: trigName,
            parentTable: tgtTrig.tableName,
            status: 'MISSING_IN_SOURCE',
            description: 'Trigger existe solo en destino',
            targetValue: tgtTrig.ddl,
            migrationSql: `-- DROP TRIGGER ${trigName};`,
            canMigrate: false,
            selected: false
          });
        }
      }

      // H. EXCEPTIONS
      for (const [excName, srcMsg] of srcMeta.exceptions.entries()) {
        const tgtMsg = tgtMeta.exceptions.get(excName);
        const excSql = `CREATE OR ALTER EXCEPTION ${excName} '${srcMsg.replace(/'/g, "''")}';\n`;

        if (tgtMsg === undefined) {
          items.push({
            id: `exc_${excName}`,
            category: 'EXCEPTION',
            objectName: excName,
            status: 'MISSING_IN_TARGET',
            description: `Excepción falta en destino`,
            sourceValue: srcMsg,
            migrationSql: excSql,
            canMigrate: true,
            selected: true
          });
        } else if (srcMsg !== tgtMsg) {
          items.push({
            id: `exc_${excName}`,
            category: 'EXCEPTION',
            objectName: excName,
            status: 'DIFFERENT',
            description: `Mensaje de excepción difiere`,
            sourceValue: srcMsg,
            targetValue: tgtMsg,
            migrationSql: excSql,
            canMigrate: true,
            selected: true
          });
        } else {
          items.push({
            id: `exc_${excName}`,
            category: 'EXCEPTION',
            objectName: excName,
            status: 'EQUAL',
            description: `Excepción idéntica`,
            sourceValue: srcMsg,
            targetValue: tgtMsg,
            migrationSql: '',
            canMigrate: false,
            selected: false
          });
        }
      }

      // 6. Compare Table Data (if enabled)
      if (options.compareData) {
        const maxRowsLimit = options.maxDataRowsPerTable || 5000;
        const sharedTables = srcMeta.tables.filter(t => tgtMeta.tables.includes(t));
        const tablesForData = options.selectedTables && options.selectedTables.length > 0
          ? sharedTables.filter(t => options.selectedTables!.includes(t))
          : sharedTables;

        const totalDataTables = tablesForData.length;

        for (let i = 0; i < totalDataTables; i++) {
          if (this.isCancelled) throw new Error('Comparación cancelada.');
          const tbl = tablesForData[i];

          onProgress({
            stage: 'COMPARING_DATA',
            percentage: 60 + Math.round((i / Math.max(1, totalDataTables)) * 35),
            message: `Comparando datos en tabla ${tbl} (${i + 1}/${totalDataTables})...`,
            currentTable: tbl
          });

          // Row counts
          let srcRowCount = 0;
          let tgtRowCount = 0;
          try {
            const [srcCountRes, tgtCountRes] = await Promise.all([
              this.queryAsync(sourceDb, `SELECT COUNT(*) AS CNT FROM ${tbl}`),
              this.queryAsync(targetDb, `SELECT COUNT(*) AS CNT FROM ${tbl}`)
            ]);
            srcRowCount = this.extractNumber(srcCountRes[0], 'CNT');
            tgtRowCount = this.extractNumber(tgtCountRes[0], 'CNT');
          } catch (err: any) {
            console.warn(`Error counting rows for ${tbl}:`, err);
            continue;
          }

          const pk = srcMeta.pkByTable.get(tbl);
          const pkCols = pk && pk.columns.length > 0 ? pk.columns : [];

          // If no PK, or row count exceeds threshold, do high-level count comparison
          if (pkCols.length === 0 || srcRowCount > maxRowsLimit || tgtRowCount > maxRowsLimit) {
            const hasDiff = srcRowCount !== tgtRowCount;
            const note = pkCols.length === 0
              ? 'Sin clave primaria para comparación registro a registro'
              : `Excede el límite configurado (${maxRowsLimit} filas)`;

            items.push({
              id: `data_${tbl}`,
              category: 'DATA',
              objectName: `${tbl} (Datos)`,
              parentTable: tbl,
              status: hasDiff ? 'DIFFERENT' : 'EQUAL',
              description: hasDiff
                ? `Diferencia de registros: Origen ${srcRowCount}, Destino ${tgtRowCount} (${note})`
                : `Mismo número de registros (${srcRowCount} filas, ${note})`,
              sourceValue: `${srcRowCount} filas`,
              targetValue: `${tgtRowCount} filas`,
              migrationSql: '',
              canMigrate: false,
              selected: false,
              dataDiff: {
                sourceRows: srcRowCount,
                targetRows: tgtRowCount,
                missingInTargetCount: hasDiff ? Math.max(0, srcRowCount - tgtRowCount) : 0,
                differingCount: 0,
                extraInTargetCount: hasDiff ? Math.max(0, tgtRowCount - srcRowCount) : 0
              }
            });
            continue;
          }

          // Tables with PK and within row limit -> Full record diff
          try {
            const [srcRows, tgtRows] = await Promise.all([
              this.queryAsync(sourceDb, `SELECT * FROM ${tbl} ORDER BY ${pkCols.join(', ')}`),
              this.queryAsync(targetDb, `SELECT * FROM ${tbl} ORDER BY ${pkCols.join(', ')}`)
            ]);

            // Build PK Map for target
            const makePkKey = (row: any): string => {
              return pkCols.map(c => {
                let v = undefined;
                for (const k of Object.keys(row)) {
                  if (k.toUpperCase() === c.toUpperCase()) {
                    v = row[k];
                    break;
                  }
                }
                return String(v);
              }).join('|||');
            };

            const makeWhereClause = (row: any): string => {
              return pkCols.map(c => {
                let v = undefined;
                for (const k of Object.keys(row)) {
                  if (k.toUpperCase() === c.toUpperCase()) {
                    v = row[k];
                    break;
                  }
                }
                return `${c} = ${this.formatSqlValue(v)}`;
              }).join(' AND ');
            };

            const tgtMap = new Map<string, any>();
            for (const r of tgtRows) {
              tgtMap.set(makePkKey(r), r);
            }

            // Fetch columns of the table
            const colNames = Array.from(srcMeta.columnsByTable.get(tbl)?.keys() || []);
            const nonPkCols = colNames.filter(c => !pkCols.some(pkCol => pkCol.toUpperCase() === c.toUpperCase()));

            const insertStatements: string[] = [];
            const updateStatements: string[] = [];
            let missingInTargetCount = 0;
            let differingCount = 0;

            for (const srcRow of srcRows) {
              const pkKey = makePkKey(srcRow);
              const tgtRow = tgtMap.get(pkKey);

              if (!tgtRow) {
                // Missing in target -> INSERT
                missingInTargetCount++;
                const values = colNames.map(col => {
                  let v = undefined;
                  for (const k of Object.keys(srcRow)) {
                    if (k.toUpperCase() === col.toUpperCase()) {
                      v = srcRow[k];
                      break;
                    }
                  }
                  return this.formatSqlValue(v);
                });
                insertStatements.push(`INSERT INTO ${tbl} (${colNames.join(', ')}) VALUES (${values.join(', ')});`);
              } else {
                // Check if any non-PK column values differ
                let rowDiffers = false;
                const setClauses: string[] = [];

                for (const col of nonPkCols) {
                  let sVal = undefined;
                  let tVal = undefined;
                  for (const k of Object.keys(srcRow)) {
                    if (k.toUpperCase() === col.toUpperCase()) { sVal = srcRow[k]; break; }
                  }
                  for (const k of Object.keys(tgtRow)) {
                    if (k.toUpperCase() === col.toUpperCase()) { tVal = tgtRow[k]; break; }
                  }

                  const sFormatted = this.formatSqlValue(sVal);
                  const tFormatted = this.formatSqlValue(tVal);

                  if (sFormatted !== tFormatted) {
                    rowDiffers = true;
                    setClauses.push(`${col} = ${sFormatted}`);
                  }
                }

                if (rowDiffers) {
                  differingCount++;
                  updateStatements.push(`UPDATE ${tbl} SET ${setClauses.join(', ')} WHERE ${makeWhereClause(srcRow)};`);
                }
              }
            }

            // Target rows not in source
            const srcPkKeys = new Set(srcRows.map(r => makePkKey(r)));
            let extraInTargetCount = 0;
            for (const tgtKey of tgtMap.keys()) {
              if (!srcPkKeys.has(tgtKey)) {
                extraInTargetCount++;
              }
            }

            const totalChanges = missingInTargetCount + differingCount;
            const dataSql = [...insertStatements, ...updateStatements].join('\n');

            if (totalChanges > 0 || extraInTargetCount > 0) {
              items.push({
                id: `data_${tbl}`,
                category: 'DATA',
                objectName: `${tbl} (Datos)`,
                parentTable: tbl,
                status: totalChanges > 0 ? 'DIFFERENT' : 'EQUAL',
                description: `${missingInTargetCount} a insertar, ${differingCount} a actualizar, ${extraInTargetCount} extra en destino`,
                sourceValue: `${srcRowCount} filas`,
                targetValue: `${tgtRowCount} filas`,
                migrationSql: dataSql,
                canMigrate: totalChanges > 0,
                selected: totalChanges > 0,
                dataDiff: {
                  sourceRows: srcRowCount,
                  targetRows: tgtRowCount,
                  missingInTargetCount,
                  differingCount,
                  extraInTargetCount
                }
              });
            } else {
              items.push({
                id: `data_${tbl}`,
                category: 'DATA',
                objectName: `${tbl} (Datos)`,
                parentTable: tbl,
                status: 'EQUAL',
                description: `Datos idénticos (${srcRowCount} registros validados)`,
                sourceValue: `${srcRowCount} filas`,
                targetValue: `${tgtRowCount} filas`,
                migrationSql: '',
                canMigrate: false,
                selected: false,
                dataDiff: {
                  sourceRows: srcRowCount,
                  targetRows: tgtRowCount,
                  missingInTargetCount: 0,
                  differingCount: 0,
                  extraInTargetCount: 0
                }
              });
            }
          } catch (err: any) {
            console.warn(`Error comparing table data for ${tbl}:`, err);
          }
        }
      }

      onProgress({
        stage: 'DONE',
        percentage: 100,
        message: '¡Comparación completada con éxito!'
      });

      // Calculate summary stats
      let equalCount = 0;
      let missingInTargetCount = 0;
      let differentCount = 0;
      let missingInSourceCount = 0;
      let dataDiffCount = 0;

      for (const item of items) {
        if (item.category === 'DATA' && item.status !== 'EQUAL') {
          dataDiffCount++;
        }
        if (item.status === 'EQUAL') equalCount++;
        else if (item.status === 'MISSING_IN_TARGET') missingInTargetCount++;
        else if (item.status === 'DIFFERENT') differentCount++;
        else if (item.status === 'MISSING_IN_SOURCE') missingInSourceCount++;
      }

      return {
        success: true,
        sourceDatabase: options.sourceConfig.database,
        targetDatabase: options.targetConfig.database,
        summary: {
          totalItems: items.length,
          equalCount,
          missingInTargetCount,
          differentCount,
          missingInSourceCount,
          dataDiffCount
        },
        items,
        durationMs: Date.now() - startTime
      };

    } catch (err: any) {
      return {
        success: false,
        sourceDatabase: options.sourceConfig.database,
        targetDatabase: options.targetConfig.database,
        summary: {
          totalItems: 0,
          equalCount: 0,
          missingInTargetCount: 0,
          differentCount: 0,
          missingInSourceCount: 0,
          dataDiffCount: 0
        },
        items: [],
        durationMs: Date.now() - startTime,
        error: err.message || 'Error durante la comparación de bases de datos.'
      };
    } finally {
      await Promise.all([
        this.detachDb(sourceDb),
        this.detachDb(targetDb)
      ]);
    }
  }

  // Generate assembled, dependency-ordered SQL migration script
  public generateMigrationScript(
    selectedItems: CompareDiffItem[],
    sourceName: string,
    targetName: string
  ): string {
    const activeItems = selectedItems.filter(i => i.selected && i.migrationSql.trim());
    const lines: string[] = [];

    const now = new Date();
    lines.push(`/*******************************************************************************`);
    lines.push(` * FirebirdYog - Script de Sincronización / Migración`);
    lines.push(` * Origen:  ${sourceName}`);
    lines.push(` * Destino: ${targetName}`);
    lines.push(` * Fecha:   ${now.toISOString()}`);
    lines.push(` * Elementos seleccionados para migrar: ${activeItems.length}`);
    lines.push(` *******************************************************************************/`);
    lines.push(``);
    lines.push(`SET SQL DIALECT 3;`);
    lines.push(`SET NAMES UTF8;`);
    lines.push(``);

    const categoriesOrder: { cat: CompareItemCategory; title: string }[] = [
      { cat: 'DOMAIN', title: '1. DOMINIOS' },
      { cat: 'GENERATOR', title: '2. GENERADORES / SECUENCIAS' },
      { cat: 'TABLE', title: '3. NUEVAS TABLAS' },
      { cat: 'COLUMN', title: '4. COLUMNAS Y ESTRUCTURA DE TABLAS' },
      { cat: 'PRIMARY_KEY', title: '5. CLAVES PRIMARIAS' },
      { cat: 'DATA', title: '6. SINCRONIZACIÓN DE DATOS' },
      { cat: 'FOREIGN_KEY', title: '7. CLAVES FORÁNEAS' },
      { cat: 'VIEW', title: '8. VISTAS' },
      { cat: 'PROCEDURE', title: '9. PROCEDIMIENTOS ALMACENADOS' },
      { cat: 'TRIGGER', title: '10. TRIGGERS' },
      { cat: 'EXCEPTION', title: '11. EXCEPCIONES' }
    ];

    for (const group of categoriesOrder) {
      const groupItems = activeItems.filter(i => i.category === group.cat);
      if (groupItems.length === 0) continue;

      lines.push(`/* ========================================================== */`);
      lines.push(`/* ${group.title.padEnd(58, ' ')} */`);
      lines.push(`/* ========================================================== */`);

      for (const item of groupItems) {
        lines.push(`-- ${item.category}: ${item.objectName} (${item.description})`);
        lines.push(item.migrationSql.trim());
        lines.push(``);
      }

      lines.push(`COMMIT;`);
      lines.push(``);
    }

    lines.push(`/* Fin del script de migración */`);
    lines.push(``);

    return lines.join('\n');
  }

  // Execute migration script on destination database
  public async executeMigration(
    targetConfig: DbConnectionOptions,
    script: string,
    onProgress?: (info: { executed: number; total: number }) => void
  ): Promise<MigrationExecutionResult> {
    const startTime = Date.now();
    let db: FirebirdType.Database | null = null;
    const errors: { statementSnippet: string; error: string }[] = [];
    let statementsExecuted = 0;

    try {
      db = await this.attachDb(targetConfig);

      // Clean statements
      const cleanScript = script.replace(/SET\s+SQL\s+DIALECT\s+\d+\s*;?/gi, '').replace(/SET\s+NAMES\s+\w+\s*;?/gi, '');
      const rawStatements = cleanScript.split(';').map(s => s.trim()).filter(Boolean);

      const total = rawStatements.length;

      for (let i = 0; i < total; i++) {
        const stmt = rawStatements[i];
        if (!stmt) continue;

        // Skip client directives
        if (/^(COMMIT|ROLLBACK)(\s+WORK)?$/i.test(stmt)) {
          continue;
        }

        try {
          await this.queryAsync(db, stmt);
          statementsExecuted++;
        } catch (err: any) {
          const errMsg = err.message || String(err);
          // Ignore if object already exists or duplicate constraint
          if (!/already exists|ya existe|duplicate/i.test(errMsg)) {
            errors.push({
              statementSnippet: stmt.substring(0, 100),
              error: errMsg
            });
          }
        }

        if (onProgress && (i % 10 === 0 || i === total - 1)) {
          onProgress({ executed: i + 1, total });
        }
      }

      return {
        success: errors.length === 0,
        statementsExecuted,
        errorsCount: errors.length,
        errors,
        durationMs: Date.now() - startTime
      };
    } catch (err: any) {
      return {
        success: false,
        statementsExecuted,
        errorsCount: errors.length + 1,
        errors: [...errors, { statementSnippet: 'Conexión a BD', error: err.message || 'Error de conexión' }],
        durationMs: Date.now() - startTime
      };
    } finally {
      await this.detachDb(db);
    }
  }
}
