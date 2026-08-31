import Firebird from 'node-firebird';

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
  private activeDb: Firebird.Database | null = null;
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
      const fbOptions: Firebird.Options = {
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

    const fbOptions: Firebird.Options = {
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

  private formatRowValue(val: any): any {
    if (val === null || val === undefined) {
      return null;
    }
    if (Buffer.isBuffer(val)) {
      // Check if it's text or binary
      try {
        const str = val.toString('utf-8');
        // Check if string contains printable chars
        if (/^[\x20-\x7E\s\u00A0-\uFFFF]*$/.test(str.substring(0, 100))) {
          return str;
        }
        return `[BLOB Binary ${val.length} bytes]`;
      } catch {
        return `[BLOB Binary ${val.length} bytes]`;
      }
    }
    if (typeof val === 'function') {
      // Firebird BLOB callback function in node-firebird
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

    const trimmedSql = sql.trim();
    const isSelect = /^(SELECT|WITH|SHOW|LIST)/i.test(trimmedSql);
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      this.activeDb!.query(trimmedSql, [], (err, rawResult) => {
        const executionTimeMs = Date.now() - startTime;
        if (err) {
          return reject(err);
        }

        if (!isSelect || !Array.isArray(rawResult)) {
          // DML / DDL / Non-select query
          const affected = typeof rawResult === 'number' ? rawResult : 0;
          return resolve({
            columns: ['RESULT'],
            rows: [{ RESULT: `Comando ejecutado exitosamente en ${executionTimeMs} ms.` }],
            rowCount: 1,
            affectedRows: affected,
            executionTimeMs,
            sql: trimmedSql
          });
        }

        const rows = rawResult as any[];
        const hasMore = rows.length > maxRows;
        const slicedRows = hasMore ? rows.slice(0, maxRows) : rows;

        // Extract column names
        const columnsSet = new Set<string>();
        if (slicedRows.length > 0) {
          Object.keys(slicedRows[0]).forEach((k) => columnsSet.add(k));
        }

        // Format rows
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
          sql: trimmedSql,
          hasMore
        });
      });
    });
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

    // Tables
    const tablesQuery = `
      SELECT TRIM(RDB$RELATION_NAME) AS NAME
      FROM RDB$RELATIONS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
        AND RDB$VIEW_BLR IS NULL
      ORDER BY 1
    `;

    // Views
    const viewsQuery = `
      SELECT TRIM(RDB$RELATION_NAME) AS NAME
      FROM RDB$RELATIONS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
        AND RDB$VIEW_BLR IS NOT NULL
      ORDER BY 1
    `;

    // Procedures
    const proceduresQuery = `
      SELECT 
        TRIM(RDB$PROCEDURE_NAME) AS NAME,
        COALESCE(RDB$PROCEDURE_INPUTS, 0) AS INPUTS,
        COALESCE(RDB$PROCEDURE_OUTPUTS, 0) AS OUTPUTS
      FROM RDB$PROCEDURES
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
      ORDER BY 1
    `;

    // Triggers
    const triggersQuery = `
      SELECT 
        TRIM(RDB$TRIGGER_NAME) AS NAME,
        TRIM(RDB$RELATION_NAME) AS TABLE_NAME,
        COALESCE(RDB$TRIGGER_INACTIVE, 0) AS INACTIVE
      FROM RDB$TRIGGERS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
      ORDER BY 1
    `;

    // Generators
    const generatorsQuery = `
      SELECT TRIM(RDB$GENERATOR_NAME) AS NAME
      FROM RDB$GENERATORS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
      ORDER BY 1
    `;

    // Domains
    const domainsQuery = `
      SELECT TRIM(RDB$FIELD_NAME) AS NAME
      FROM RDB$FIELDS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
        AND RDB$FIELD_NAME NOT STARTING WITH 'RDB$'
      ORDER BY 1
    `;

    // Exceptions
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
        tables: tables.map(r => r.NAME),
        views: views.map(r => r.NAME),
        procedures: procs.map(r => ({
          name: r.NAME,
          inputs: Number(r.INPUTS) || 0,
          outputs: Number(r.OUTPUTS) || 0
        })),
        triggers: triggers.map(r => ({
          name: r.NAME,
          table: r.TABLE_NAME || '',
          inactive: Number(r.INACTIVE) === 1
        })),
        generators: gens.map(r => r.NAME),
        domains: domains.map(r => r.NAME),
        exceptions: exceptions.map(r => r.NAME)
      };
    } catch (err: any) {
      throw new Error(`Error al consultar metadatos de Firebird: ${err.message}`);
    }
  }

  private resolveFieldType(typeCode: number, subType: number, length: number, precision: number, scale: number): string {
    switch (typeCode) {
      case 7: // SMALLINT
        if (scale < 0) return `NUMERIC(4, ${Math.abs(scale)})`;
        return 'SMALLINT';
      case 8: // INTEGER
        if (scale < 0) return `NUMERIC(9, ${Math.abs(scale)})`;
        return 'INTEGER';
      case 10: // FLOAT
        return 'FLOAT';
      case 12: // DATE
        return 'DATE';
      case 13: // TIME
        return 'TIME';
      case 14: // CHAR
        return `CHAR(${length})`;
      case 16: // BIGINT / INT64
        if (scale < 0) return `NUMERIC(${precision || 18}, ${Math.abs(scale)})`;
        return 'BIGINT';
      case 27: // DOUBLE PRECISION
        return 'DOUBLE PRECISION';
      case 35: // TIMESTAMP
        return 'TIMESTAMP';
      case 37: // VARCHAR
        return `VARCHAR(${length})`;
      case 261: // BLOB
        return subType === 1 ? 'BLOB SUB_TYPE TEXT' : 'BLOB SUB_TYPE BINARY';
      case 23:
      case 17:
        return 'BOOLEAN';
      default:
        return `TYPE_${typeCode}`;
    }
  }

  public async getTableDetails(tableName: string): Promise<any> {
    if (!this.activeDb) {
      throw new Error('No hay conexión activa a la base de datos.');
    }

    const columnsQuery = `
      SELECT 
        TRIM(RF.RDB$FIELD_NAME) AS COLUMN_NAME,
        RF.RDB$FIELD_POSITION AS POSITION,
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
            WHERE TRIM(RC.RDB$RELATION_NAME) = ?
              AND RC.RDB$CONSTRAINT_TYPE = 'PRIMARY KEY'
              AND TRIM(ISG.RDB$FIELD_NAME) = TRIM(RF.RDB$FIELD_NAME)
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
      queryParamsAsync(columnsQuery, [cleanTableName, cleanTableName]),
      queryParamsAsync(triggersQuery, [cleanTableName]),
      queryParamsAsync(indicesQuery, [cleanTableName])
    ]);

    const columns = colRows.map((r) => ({
      columnName: r.COLUMN_NAME,
      position: Number(r.POSITION),
      domainName: r.DOMAIN_NAME,
      fieldType: this.resolveFieldType(
        Number(r.FIELD_TYPE_CODE),
        Number(r.FIELD_SUB_TYPE),
        Number(r.FIELD_LENGTH),
        Number(r.FIELD_PRECISION),
        Number(r.FIELD_SCALE)
      ),
      length: Number(r.FIELD_LENGTH),
      precision: Number(r.FIELD_PRECISION),
      scale: Number(r.FIELD_SCALE),
      isNullable: Number(r.NULL_FLAG) === 0,
      defaultValue: r.DEFAULT_VALUE || null,
      isPrimaryKey: Number(r.IS_PRIMARY_KEY) === 1
    }));

    const triggers = trigRows.map((t) => ({
      name: t.NAME,
      type: String(t.TYPE),
      inactive: Number(t.INACTIVE) === 1
    }));

    // Group indices by name
    const indicesMap = new Map<string, { name: string; unique: boolean; fields: string[] }>();
    for (const row of idxRows) {
      if (!indicesMap.has(row.INDEX_NAME)) {
        indicesMap.set(row.INDEX_NAME, {
          name: row.INDEX_NAME,
          unique: Number(row.UNIQUE_FLAG) === 1,
          fields: []
        });
      }
      indicesMap.get(row.INDEX_NAME)!.fields.push(row.FIELD_NAME);
    }

    // Generate basic DDL for table
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
