import * as FirebirdRaw from 'node-firebird';
import type FirebirdType from 'node-firebird';

// Resolve CommonJS / ESM interop for node-firebird
const Firebird: typeof FirebirdType = ((FirebirdRaw as any).attach 
  ? FirebirdRaw 
  : ((FirebirdRaw as any).default || FirebirdRaw)) as any;

export interface FirebirdConnectionOptions {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  role?: string;
  charset?: string;
  pageSize?: number;
}

export class FirebirdService {
  private activeDb: FirebirdType.Database | null = null;
  private currentConfig: any = null;

  public isConnected(): boolean {
    return this.activeDb !== null;
  }

  public getCurrentConfig(): any {
    return this.currentConfig;
  }

  public async testConnection(options: FirebirdConnectionOptions): Promise<{ success: boolean; message: string; pingMs: number }> {
    const start = Date.now();
    return new Promise((resolve) => {
      const fbOptions: FirebirdType.Options = {
        host: options.host || '127.0.0.1',
        port: Number(options.port) || 3050,
        database: options.database,
        user: options.user || 'SYSDBA',
        password: options.password || 'masterkey',
        role: options.role || undefined,
        encoding: (options.charset || 'UTF8') as any,
        blobAsText: true,
        lowercase_keys: false
      };

      Firebird.attach(fbOptions, (err, db) => {
        const pingMs = Date.now() - start;
        if (err) {
          resolve({
            success: false,
            message: err.message || String(err),
            pingMs
          });
        } else {
          db.detach((detachErr) => {
            if (detachErr) {
              console.warn('Error during detach after test:', detachErr);
            }
            resolve({
              success: true,
              message: '¡Conexión exitosa a la base de datos Firebird!',
              pingMs
            });
          });
        }
      });
    });
  }

  public async connect(options: FirebirdConnectionOptions): Promise<void> {
    if (this.activeDb) {
      await this.disconnect();
    }

    const fbOptions: FirebirdType.Options = {
      host: options.host || '127.0.0.1',
      port: Number(options.port) || 3050,
      database: options.database,
      user: options.user || 'SYSDBA',
      password: options.password || 'masterkey',
      role: options.role || undefined,
      encoding: (options.charset || 'UTF8') as any,
      blobAsText: true,
      lowercase_keys: false
    };

    return new Promise((resolve, reject) => {
      Firebird.attach(fbOptions, (err, db) => {
        if (err) {
          return reject(err);
        }
        this.activeDb = db;
        this.currentConfig = options;
        resolve();
      });
    });
  }

  public async createDatabase(options: FirebirdConnectionOptions): Promise<{ database: string }> {
    if (this.activeDb) {
      await this.disconnect();
    }

    const fbOptions: FirebirdType.Options = {
      host: options.host || '127.0.0.1',
      port: Number(options.port) || 3050,
      database: options.database,
      user: options.user || 'SYSDBA',
      password: options.password || 'masterkey',
      role: options.role || undefined,
      pageSize: options.pageSize || 16384,
      encoding: (options.charset || 'UTF8') as any,
      blobAsText: true,
      lowercase_keys: false
    };

    return new Promise((resolve, reject) => {
      Firebird.create(fbOptions, (err, db) => {
        if (err) {
          return reject(err);
        }
        this.activeDb = db;
        this.currentConfig = options;
        resolve({ database: options.database });
      });
    });
  }

  public async disconnect(): Promise<void> {
    if (!this.activeDb) return;
    return new Promise((resolve) => {
      this.activeDb!.detach((err) => {
        if (err) {
          console.warn('Error detaching database:', err);
        }
        this.activeDb = null;
        this.currentConfig = null;
        resolve();
      });
    });
  }

  public async readBlobValue(val: any): Promise<string> {
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

  private formatRowValue(val: any): any {
    if (val === null || val === undefined) {
      return null;
    }
    if (Buffer.isBuffer(val)) {
      try {
        const str = val.toString('utf-8');
        if (/^[\x20-\x7E\s\u00A0-\uFFFF]*$/.test(str.substring(0, 100))) {
          return str;
        }
        return `[BLOB Binary ${val.length} bytes]`;
      } catch {
        return `[BLOB Binary ${val.length} bytes]`;
      }
    }
    if (typeof val === 'function') {
      return '[BLOB]';
    }
    if (val instanceof Date) {
      return val.toISOString();
    }
    if (typeof val === 'bigint') {
      return val.toString();
    }
    return val;
  }

  public cleanSqlForExecution(sql: string): string {
    let s = sql.trim();

    // Remove any SET TERM statements anywhere in the text (case-insensitive)
    s = s.replace(/SET\s+TERM\s+[\^~#@!;&|]+(?:\s*;\s*|\s*[\^~#@!;&|]+\s*|\s*)/gi, '');
    s = s.replace(/SET\s+TERM\s+;\s*[\^~#@!;&|]*/gi, '');

    // Trim whitespace
    s = s.trim();

    // Remove trailing delimiter symbols like ^, ~, #, or whitespace at the end
    s = s.replace(/[\s\^~#@!]+$/g, '');

    return s.trim();
  }

  public async executeQuery(sql: string, maxRows: number = 1000): Promise<{
    columns: string[];
    rows: Record<string, any>[];
    rowCount: number;
    affectedRows?: number;
    executionTimeMs: number;
    sql: string;
    hasMore?: boolean;
  }> {
    if (!this.activeDb) {
      throw new Error('No hay conexión activa a la base de datos Firebird.');
    }

    const cleanedSql = this.cleanSqlForExecution(sql);
    if (!cleanedSql) {
      throw new Error('La consulta está vacía.');
    }

    const isSelect = /^(SELECT|WITH|SHOW|LIST)/i.test(cleanedSql);
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      this.activeDb!.query(cleanedSql, [], (err, rawResult) => {
        const executionTimeMs = Date.now() - startTime;
        if (err) {
          return reject(err);
        }

        if (!isSelect || !Array.isArray(rawResult)) {
          const affected = typeof rawResult === 'number' ? rawResult : 0;
          return resolve({
            columns: ['RESULT'],
            rows: [{ RESULT: `Comando ejecutado exitosamente en ${executionTimeMs} ms.` }],
            rowCount: 1,
            affectedRows: affected,
            executionTimeMs,
            sql: cleanedSql
          });
        }

        const rows = rawResult as any[];
        const hasMore = rows.length > maxRows;
        const slicedRows = hasMore ? rows.slice(0, maxRows) : rows;

        const columnsSet = new Set<string>();
        if (slicedRows.length > 0) {
          Object.keys(slicedRows[0]).forEach((k) => columnsSet.add(k));
        }

        const formattedRows = slicedRows.map((row) => {
          const newRow: Record<string, any> = {};
          for (const key of Object.keys(row)) {
            newRow[key] = this.formatRowValue(row[key]);
          }
          return newRow;
        });

        resolve({
          columns: Array.from(columnsSet),
          rows: formattedRows,
          rowCount: formattedRows.length,
          executionTimeMs,
          sql: cleanedSql,
          hasMore
        });
      });
    });
  }

  public splitSqlStatements(script: string): string[] {
    const cleaned = this.cleanSqlForExecution(script);
    const statements: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBlockComment = false;
    let inLineComment = false;
    let beginDepth = 0;

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      const nextChar = cleaned[i + 1] || '';

      // Line comment
      if (!inSingleQuote && !inDoubleQuote && !inBlockComment && char === '-' && nextChar === '-') {
        inLineComment = true;
        i++;
        continue;
      }
      if (inLineComment) {
        if (char === '\n') inLineComment = false;
        continue;
      }

      // Block comment
      if (!inSingleQuote && !inDoubleQuote && !inLineComment && char === '/' && nextChar === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
      if (inBlockComment) {
        if (char === '*' && nextChar === '/') {
          inBlockComment = false;
          i++;
        }
        continue;
      }

      // Quotes
      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        current += char;
        continue;
      }
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        current += char;
        continue;
      }

      if (!inSingleQuote && !inDoubleQuote) {
        // Detect BEGIN and END keywords for procedures/triggers
        const remaining = cleaned.slice(i).toUpperCase();
        if (/^\bBEGIN\b/.test(remaining)) {
          beginDepth++;
        } else if (/^\bEND\b/.test(remaining)) {
          if (beginDepth > 0) beginDepth--;
        }

        // Semicolon delimiter
        if (char === ';') {
          if (beginDepth === 0) {
            if (current.trim()) {
              statements.push(current.trim());
            }
            current = '';
            continue;
          }
        }
      }

      current += char;
    }

    if (current.trim()) {
      statements.push(current.trim());
    }

    return statements;
  }

  public async executeScript(script: string): Promise<{ statementsExecuted: number; results: any[] }> {
    const statements = this.splitSqlStatements(script);
    const results: any[] = [];

    for (const stmt of statements) {
      if (!stmt.trim()) continue;
      const res = await this.executeQuery(stmt);
      results.push(res);
    }

    return {
      statementsExecuted: results.length,
      results
    };
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

  public async getSchemaObjects(): Promise<{
    tables: string[];
    views: string[];
    procedures: { name: string; inputs: number; outputs: number }[];
    triggers: { name: string; table: string; inactive: boolean }[];
    generators: string[];
    domains: string[];
    exceptions: string[];
  }> {
    if (!this.activeDb) {
      throw new Error('No hay conexión activa a la base de datos.');
    }

    const tablesQuery = `
      SELECT TRIM(RDB$RELATION_NAME) AS NAME
      FROM RDB$RELATIONS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
        AND RDB$VIEW_BLR IS NULL
      ORDER BY 1
    `;

    const viewsQuery = `
      SELECT TRIM(RDB$RELATION_NAME) AS NAME
      FROM RDB$RELATIONS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
        AND RDB$VIEW_BLR IS NOT NULL
      ORDER BY 1
    `;

    const proceduresQuery = `
      SELECT 
        TRIM(RDB$PROCEDURE_NAME) AS NAME,
        COALESCE(RDB$PROCEDURE_INPUTS, 0) AS INPUTS,
        COALESCE(RDB$PROCEDURE_OUTPUTS, 0) AS OUTPUTS
      FROM RDB$PROCEDURES
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
      ORDER BY 1
    `;

    const triggersQuery = `
      SELECT 
        TRIM(RDB$TRIGGER_NAME) AS NAME,
        TRIM(RDB$RELATION_NAME) AS TABLE_NAME,
        COALESCE(RDB$TRIGGER_INACTIVE, 0) AS INACTIVE
      FROM RDB$TRIGGERS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
      ORDER BY 1
    `;

    const generatorsQuery = `
      SELECT TRIM(RDB$GENERATOR_NAME) AS NAME
      FROM RDB$GENERATORS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
      ORDER BY 1
    `;

    const domainsQuery = `
      SELECT TRIM(RDB$FIELD_NAME) AS NAME
      FROM RDB$FIELDS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
        AND RDB$FIELD_NAME NOT STARTING WITH 'RDB$'
      ORDER BY 1
    `;

    const exceptionsQuery = `
      SELECT TRIM(RDB$EXCEPTION_NAME) AS NAME
      FROM RDB$EXCEPTIONS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
      ORDER BY 1
    `;

    const queryAsync = (sql: string): Promise<any[]> => {
      return new Promise((res, rej) => {
        this.activeDb!.query(sql, [], (err, rows) => {
          if (err) return rej(err);
          res(Array.isArray(rows) ? rows : []);
        });
      });
    };

    try {
      const [tables, views, procs, triggers, gens, domains, exceptions] = await Promise.all([
        queryAsync(tablesQuery),
        queryAsync(viewsQuery),
        queryAsync(proceduresQuery),
        queryAsync(triggersQuery),
        queryAsync(generatorsQuery),
        queryAsync(domainsQuery),
        queryAsync(exceptionsQuery)
      ]);

      return {
        tables: tables.map(r => this.extractString(r, 'NAME', 'RDB$RELATION_NAME')).filter(Boolean),
        views: views.map(r => this.extractString(r, 'NAME', 'RDB$RELATION_NAME')).filter(Boolean),
        procedures: procs.map(r => ({
          name: this.extractString(r, 'NAME', 'RDB$PROCEDURE_NAME'),
          inputs: this.extractNumber(r, 'INPUTS', 'RDB$PROCEDURE_INPUTS'),
          outputs: this.extractNumber(r, 'OUTPUTS', 'RDB$PROCEDURE_OUTPUTS')
        })).filter(p => Boolean(p.name)),
        triggers: triggers.map(r => ({
          name: this.extractString(r, 'NAME', 'RDB$TRIGGER_NAME'),
          table: this.extractString(r, 'TABLE_NAME', 'RDB$RELATION_NAME'),
          inactive: this.extractNumber(r, 'INACTIVE', 'RDB$TRIGGER_INACTIVE') === 1
        })).filter(t => Boolean(t.name)),
        generators: gens.map(r => this.extractString(r, 'NAME', 'RDB$GENERATOR_NAME')).filter(Boolean),
        domains: domains.map(r => this.extractString(r, 'NAME', 'RDB$FIELD_NAME')).filter(Boolean),
        exceptions: exceptions.map(r => this.extractString(r, 'NAME', 'RDB$EXCEPTION_NAME')).filter(Boolean)
      };
    } catch (err: any) {
      throw new Error(`Error al consultar metadatos de Firebird: ${err.message}`);
    }
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

  public async getObjectDdl(objectType: string, objectName: string): Promise<{ ddl: string; name: string; type: string }> {
    if (!this.activeDb) {
      throw new Error('No hay conexión activa a la base de datos.');
    }

    const cleanName = objectName.trim().toUpperCase();
    const typeUpper = objectType.trim().toUpperCase();

    const queryParamsAsync = (sql: string, params: any[]): Promise<any[]> => {
      return new Promise((res, rej) => {
        this.activeDb!.query(sql, params, (err, rows) => {
          if (err) return rej(err);
          res(Array.isArray(rows) ? rows : []);
        });
      });
    };

    if (typeUpper === 'PROCEDURE') {
      // 1. Fetch Procedure Source & Header
      const procQuery = `
        SELECT 
          TRIM(P.RDB$PROCEDURE_NAME) AS NAME,
          P.RDB$PROCEDURE_SOURCE AS SOURCE,
          COALESCE(P.RDB$PROCEDURE_INPUTS, 0) AS INPUTS,
          COALESCE(P.RDB$PROCEDURE_OUTPUTS, 0) AS OUTPUTS
        FROM RDB$PROCEDURES P
        WHERE TRIM(P.RDB$PROCEDURE_NAME) = ?
      `;

      // 2. Fetch Parameters
      const paramQuery = `
        SELECT 
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
        WHERE TRIM(PP.RDB$PROCEDURE_NAME) = ?
        ORDER BY PP.RDB$PARAMETER_TYPE, PP.RDB$PARAMETER_NUMBER
      `;

      const [procRows, paramRows] = await Promise.all([
        queryParamsAsync(procQuery, [cleanName]),
        queryParamsAsync(paramQuery, [cleanName])
      ]);

      if (procRows.length === 0) {
        throw new Error(`No se encontró el procedimiento '${cleanName}'.`);
      }

      const proc = procRows[0];
      const source = await this.readBlobValue(proc.SOURCE);

      const inParams = paramRows
        .filter(p => Number(p.PARAM_TYPE) === 0)
        .map(p => {
          const typeStr = this.resolveFieldType(
            Number(p.FIELD_TYPE_CODE),
            Number(p.FIELD_SUB_TYPE),
            Number(p.FIELD_LENGTH),
            Number(p.FIELD_PRECISION),
            Number(p.FIELD_SCALE)
          );
          return `    ${p.PARAM_NAME} ${typeStr}`;
        });

      const outParams = paramRows
        .filter(p => Number(p.PARAM_TYPE) === 1)
        .map(p => {
          const typeStr = this.resolveFieldType(
            Number(p.FIELD_TYPE_CODE),
            Number(p.FIELD_SUB_TYPE),
            Number(p.FIELD_LENGTH),
            Number(p.FIELD_PRECISION),
            Number(p.FIELD_SCALE)
          );
          return `    ${p.PARAM_NAME} ${typeStr}`;
        });

      let ddl = `CREATE OR ALTER PROCEDURE ${cleanName}`;
      if (inParams.length > 0) {
        ddl += ` (\n${inParams.join(',\n')}\n)`;
      }
      if (outParams.length > 0) {
        ddl += `\nRETURNS (\n${outParams.join(',\n')}\n)`;
      }
      ddl += `\nAS\n`;
      
      const body = source.trim();
      if (body.toUpperCase().startsWith('BEGIN')) {
        ddl += body;
      } else if (body.toUpperCase().startsWith('DECLARE') || body.toUpperCase().startsWith('VARIABLE')) {
        ddl += body;
      } else {
        ddl += `BEGIN\n  ${body}\nEND`;
      }
      
      ddl += `\n`;

      return { ddl, name: cleanName, type: 'PROCEDURE' };
    }

    if (typeUpper === 'TRIGGER') {
      const triggerQuery = `
        SELECT 
          TRIM(T.RDB$TRIGGER_NAME) AS NAME,
          TRIM(T.RDB$RELATION_NAME) AS TABLE_NAME,
          COALESCE(T.RDB$TRIGGER_SEQUENCE, 0) AS SEQ,
          T.RDB$TRIGGER_TYPE AS TRIG_TYPE,
          COALESCE(T.RDB$TRIGGER_INACTIVE, 0) AS INACTIVE,
          T.RDB$TRIGGER_SOURCE AS SOURCE
        FROM RDB$TRIGGERS T
        WHERE TRIM(T.RDB$TRIGGER_NAME) = ?
      `;

      const rows = await queryParamsAsync(triggerQuery, [cleanName]);
      if (rows.length === 0) {
        throw new Error(`No se encontró el trigger '${cleanName}'.`);
      }

      const trig = rows[0];
      const source = await this.readBlobValue(trig.SOURCE);
      const status = Number(trig.INACTIVE) === 1 ? 'INACTIVE' : 'ACTIVE';
      const eventType = this.decodeTriggerType(Number(trig.TRIG_TYPE) || 1);

      let ddl = `CREATE OR ALTER TRIGGER ${cleanName} FOR ${trig.TABLE_NAME}\n`;
      ddl += `${status} ${eventType} POSITION ${trig.SEQ}\nAS\n`;
      ddl += `${source.trim()}\n`;

      return { ddl, name: cleanName, type: 'TRIGGER' };
    }

    if (typeUpper === 'VIEW') {
      const viewQuery = `
        SELECT 
          TRIM(R.RDB$RELATION_NAME) AS NAME,
          R.RDB$VIEW_SOURCE AS SOURCE
        FROM RDB$RELATIONS R
        WHERE TRIM(R.RDB$RELATION_NAME) = ?
      `;

      const rows = await queryParamsAsync(viewQuery, [cleanName]);
      if (rows.length === 0) {
        throw new Error(`No se encontró la vista '${cleanName}'.`);
      }

      const view = rows[0];
      const source = await this.readBlobValue(view.SOURCE);

      let ddl = `CREATE OR ALTER VIEW ${cleanName} AS\n${source.trim()};\n`;
      return { ddl, name: cleanName, type: 'VIEW' };
    }

    if (typeUpper === 'TABLE') {
      const details = await this.getTableDetails(cleanName);
      return { ddl: details.ddl || '', name: cleanName, type: 'TABLE' };
    }

    throw new Error(`Tipo de objeto '${objectType}' no soportado para generación de DDL.`);
  }

  public async getTableDetails(tableName: string): Promise<any> {
    if (!this.activeDb) {
      throw new Error('No hay conexión activa a la base de datos.');
    }

    const columnsQuery = `
      SELECT 
        TRIM(RF.RDB$FIELD_NAME) AS COLUMN_NAME,
        RF.RDB$FIELD_POSITION AS FIELD_POS,
        TRIM(F.RDB$FIELD_NAME) AS DOMAIN_NAME,
        F.RDB$FIELD_TYPE AS FIELD_TYPE_CODE,
        F.RDB$FIELD_SUB_TYPE AS FIELD_SUB_TYPE,
        F.RDB$FIELD_LENGTH AS FIELD_LENGTH,
        F.RDB$FIELD_PRECISION AS FIELD_PRECISION,
        F.RDB$FIELD_SCALE AS FIELD_SCALE,
        COALESCE(RF.RDB$NULL_FLAG, F.RDB$NULL_FLAG, 0) AS NULL_FLAG,
        TRIM(RF.RDB$DEFAULT_SOURCE) AS DEFAULT_VALUE,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM RDB$RELATION_CONSTRAINTS RC
            JOIN RDB$INDEX_SEGMENTS ISG ON ISG.RDB$INDEX_NAME = RC.RDB$INDEX_NAME
            WHERE RC.RDB$RELATION_NAME = RF.RDB$RELATION_NAME
              AND RC.RDB$CONSTRAINT_TYPE = 'PRIMARY KEY'
              AND ISG.RDB$FIELD_NAME = RF.RDB$FIELD_NAME
          ) THEN 1 ELSE 0 END AS IS_PRIMARY_KEY
      FROM RDB$RELATION_FIELDS RF
      JOIN RDB$FIELDS F ON RF.RDB$FIELD_SOURCE = F.RDB$FIELD_NAME
      WHERE TRIM(RF.RDB$RELATION_NAME) = ?
      ORDER BY RF.RDB$FIELD_POSITION
    `;

    const triggersQuery = `
      SELECT 
        TRIM(RDB$TRIGGER_NAME) AS NAME,
        RDB$TRIGGER_TYPE AS TYPE,
        COALESCE(RDB$TRIGGER_INACTIVE, 0) AS INACTIVE
      FROM RDB$TRIGGERS
      WHERE TRIM(RDB$RELATION_NAME) = ?
        AND (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
      ORDER BY RDB$TRIGGER_SEQUENCE
    `;

    const indicesQuery = `
      SELECT 
        TRIM(I.RDB$INDEX_NAME) AS INDEX_NAME,
        COALESCE(I.RDB$UNIQUE_FLAG, 0) AS UNIQUE_FLAG,
        TRIM(S.RDB$FIELD_NAME) AS FIELD_NAME
      FROM RDB$INDICES I
      JOIN RDB$INDEX_SEGMENTS S ON I.RDB$INDEX_NAME = S.RDB$INDEX_NAME
      WHERE TRIM(I.RDB$RELATION_NAME) = ?
        AND (I.RDB$SYSTEM_FLAG = 0 OR I.RDB$SYSTEM_FLAG IS NULL)
      ORDER BY I.RDB$INDEX_NAME, S.RDB$FIELD_POSITION
    `;

    const queryParamsAsync = (sql: string, params: any[]): Promise<any[]> => {
      return new Promise((res, rej) => {
        this.activeDb!.query(sql, params, (err, rows) => {
          if (err) return rej(err);
          res(Array.isArray(rows) ? rows : []);
        });
      });
    };

    const cleanTableName = tableName.trim().toUpperCase();

    const [colRows, trigRows, idxRows] = await Promise.all([
      queryParamsAsync(columnsQuery, [cleanTableName]),
      queryParamsAsync(triggersQuery, [cleanTableName]),
      queryParamsAsync(indicesQuery, [cleanTableName])
    ]);

    const columns = colRows.map((r) => ({
      columnName: this.extractString(r, 'COLUMN_NAME'),
      position: this.extractNumber(r, 'FIELD_POS', 'POSITION'),
      domainName: this.extractString(r, 'DOMAIN_NAME'),
      fieldType: this.resolveFieldType(
        this.extractNumber(r, 'FIELD_TYPE_CODE'),
        this.extractNumber(r, 'FIELD_SUB_TYPE'),
        this.extractNumber(r, 'FIELD_LENGTH'),
        this.extractNumber(r, 'FIELD_PRECISION'),
        this.extractNumber(r, 'FIELD_SCALE')
      ),
      length: this.extractNumber(r, 'FIELD_LENGTH'),
      precision: this.extractNumber(r, 'FIELD_PRECISION'),
      scale: this.extractNumber(r, 'FIELD_SCALE'),
      isNullable: this.extractNumber(r, 'NULL_FLAG') === 0,
      defaultValue: this.extractString(r, 'DEFAULT_VALUE') || null,
      isPrimaryKey: this.extractNumber(r, 'IS_PRIMARY_KEY') === 1
    }));

    const triggers = trigRows.map((t) => ({
      name: this.extractString(t, 'NAME'),
      type: this.extractString(t, 'TYPE'),
      inactive: this.extractNumber(t, 'INACTIVE') === 1
    }));

    const indicesMap = new Map<string, { name: string; unique: boolean; fields: string[] }>();
    for (const row of idxRows) {
      const idxName = this.extractString(row, 'INDEX_NAME');
      const fldName = this.extractString(row, 'FIELD_NAME');
      const isUnique = this.extractNumber(row, 'UNIQUE_FLAG') === 1;

      if (!indicesMap.has(idxName)) {
        indicesMap.set(idxName, {
          name: idxName,
          unique: isUnique,
          fields: []
        });
      }
      if (fldName) {
        indicesMap.get(idxName)!.fields.push(fldName);
      }
    }

    let ddl = `CREATE TABLE ${cleanTableName} (\n`;
    const colDefs = columns.map((col) => {
      let def = `    ${col.columnName} ${col.fieldType}`;
      if (col.defaultValue) {
        def += ` ${col.defaultValue}`;
      }
      if (!col.isNullable) {
        def += ' NOT NULL';
      }
      return def;
    });

    const pkCols = columns.filter((c) => c.isPrimaryKey).map((c) => c.columnName);
    if (pkCols.length > 0) {
      colDefs.push(`    CONSTRAINT PK_${cleanTableName} PRIMARY KEY (${pkCols.join(', ')})`);
    }

    ddl += colDefs.join(',\n') + '\n);';

    return {
      tableName: cleanTableName,
      columns,
      triggers,
      indices: Array.from(indicesMap.values()),
      ddl
    };
  }
}
