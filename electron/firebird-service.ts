import * as FirebirdRaw from 'node-firebird';
import type FirebirdType from 'node-firebird';
import { SshTunnelConfig, SshTunnelInstance, sshTunnelService } from './ssh-tunnel-service';

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
  ssh?: SshTunnelConfig;
}

export class FirebirdService {
  private activeDb: FirebirdType.Database | null = null;
  private activeTunnel: SshTunnelInstance | null = null;
  private currentConfig: any = null;

  public isConnected(): boolean {
    return this.activeDb !== null;
  }

  public getCurrentConfig(): any {
    return this.currentConfig;
  }

  public async testConnection(options: FirebirdConnectionOptions): Promise<{ success: boolean; message: string; pingMs: number }> {
    const start = Date.now();
    let tempTunnel: SshTunnelInstance | null = null;

    try {
      let host = options.host || '127.0.0.1';
      let port = Number(options.port) || 3050;

      if (options.ssh && options.ssh.enabled) {
        tempTunnel = await sshTunnelService.createTunnel(options.ssh, host, port);
        host = tempTunnel.localHost;
        port = tempTunnel.localPort;
      }

      const normalizeCharset = (cs?: string): string => {
        const raw = (cs || 'UTF8').trim().toUpperCase();
        if (raw === 'ISO-8859-1' || raw === 'ISO_8859_1' || raw === 'ISO8859-1') return 'ISO8859_1';
        return raw;
      };

      const fbOptions: FirebirdType.Options = {
        host,
        port,
        database: options.database,
        user: options.user || 'SYSDBA',
        password: options.password || 'masterkey',
        role: options.role || undefined,
        encoding: normalizeCharset(options.charset) as any,
        blobAsText: true,
        lowercase_keys: false
      };

      return await new Promise((resolve) => {
        Firebird.attach(fbOptions, (err, db) => {
          const pingMs = Date.now() - start;
          if (err) {
            resolve({
              success: false,
              message: (options.ssh?.enabled ? '[Túnel SSH OK] ' : '') + (err.message || String(err)),
              pingMs
            });
          } else {
            db.detach((detachErr) => {
              if (detachErr) {
                console.warn('Error during detach after test:', detachErr);
              }
              resolve({
                success: true,
                message: options.ssh?.enabled
                  ? '¡Conexión exitosa a Firebird a través del túnel SSH!'
                  : '¡Conexión exitosa a la base de datos Firebird!',
                pingMs
              });
            });
          }
        });
      });
    } catch (err: any) {
      const pingMs = Date.now() - start;
      return {
        success: false,
        message: `Error de túnel SSH: ${err.message || String(err)}`,
        pingMs
      };
    } finally {
      if (tempTunnel) {
        try {
          await tempTunnel.close();
        } catch (closeErr) {
          console.warn('Error closing test SSH tunnel:', closeErr);
        }
      }
    }
  }

  public async connect(options: FirebirdConnectionOptions): Promise<void> {
    if (this.activeDb || this.activeTunnel) {
      await this.disconnect();
    }

    let host = options.host || '127.0.0.1';
    let port = Number(options.port) || 3050;

    if (options.ssh && options.ssh.enabled) {
      try {
        this.activeTunnel = await sshTunnelService.createTunnel(options.ssh, host, port);
        host = this.activeTunnel.localHost;
        port = this.activeTunnel.localPort;
      } catch (err: any) {
        throw new Error(`Error al iniciar túnel SSH: ${err.message || String(err)}`);
      }
    }

    const normalizeCharset = (cs?: string): string => {
      const raw = (cs || 'UTF8').trim().toUpperCase();
      if (raw === 'ISO-8859-1' || raw === 'ISO_8859_1' || raw === 'ISO8859-1') return 'ISO8859_1';
      return raw;
    };

    const fbOptions: FirebirdType.Options = {
      host,
      port,
      database: options.database,
      user: options.user || 'SYSDBA',
      password: options.password || 'masterkey',
      role: options.role || undefined,
      encoding: normalizeCharset(options.charset) as any,
      blobAsText: true,
      lowercase_keys: false
    };

    return new Promise((resolve, reject) => {
      Firebird.attach(fbOptions, async (err, db) => {
        if (err) {
          if (this.activeTunnel) {
            try {
              await this.activeTunnel.close();
            } catch {}
            this.activeTunnel = null;
          }
          return reject(err);
        }
        this.activeDb = db;
        this.currentConfig = options;
        resolve();
      });
    });
  }

  public async createDatabase(options: FirebirdConnectionOptions): Promise<{ database: string }> {
    if (this.activeDb || this.activeTunnel) {
      await this.disconnect();
    }

    let host = options.host || '127.0.0.1';
    let port = Number(options.port) || 3050;

    if (options.ssh && options.ssh.enabled) {
      try {
        this.activeTunnel = await sshTunnelService.createTunnel(options.ssh, host, port);
        host = this.activeTunnel.localHost;
        port = this.activeTunnel.localPort;
      } catch (err: any) {
        throw new Error(`Error al iniciar túnel SSH: ${err.message || String(err)}`);
      }
    }

    const normalizeCharset = (cs?: string): string => {
      const raw = (cs || 'UTF8').trim().toUpperCase();
      if (raw === 'ISO-8859-1' || raw === 'ISO_8859_1' || raw === 'ISO8859-1') return 'ISO8859_1';
      return raw;
    };

    const fbOptions: FirebirdType.Options = {
      host,
      port,
      database: options.database,
      user: options.user || 'SYSDBA',
      password: options.password || 'masterkey',
      role: options.role || undefined,
      pageSize: options.pageSize || 16384,
      encoding: normalizeCharset(options.charset) as any,
      blobAsText: true,
      lowercase_keys: false
    };

    return new Promise((resolve, reject) => {
      Firebird.create(fbOptions, async (err, db) => {
        if (err) {
          if (this.activeTunnel) {
            try {
              await this.activeTunnel.close();
            } catch {}
            this.activeTunnel = null;
          }
          return reject(err);
        }
        this.activeDb = db;
        this.currentConfig = options;
        resolve({ database: options.database });
      });
    });
  }

  public async disconnect(): Promise<void> {
    const detachPromise = new Promise<void>((resolve) => {
      if (!this.activeDb) return resolve();
      try {
        this.activeDb.detach((err) => {
          if (err) {
            console.warn('Error detaching database:', err);
          }
          this.activeDb = null;
          resolve();
        });
      } catch (e) {
        this.activeDb = null;
        resolve();
      }
    });

    await detachPromise;

    if (this.activeTunnel) {
      try {
        await this.activeTunnel.close();
      } catch (err) {
        console.warn('Error closing active SSH tunnel:', err);
      }
      this.activeTunnel = null;
    }

    this.currentConfig = null;
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

    // Handle client directives / transaction statements that cannot be passed as DSQL to db.query()
    if (/^(COMMIT|ROLLBACK)(\s+WORK)?$/i.test(cleanedSql) || /^SET\s+(TRANSACTION|AUTODDL|NAMES|SQL\s+DIALECT|HEADING|ECHO|STATS)/i.test(cleanedSql)) {
      return {
        columns: ['RESULT'],
        rows: [{ RESULT: `Comando ejecutado exitosamente (${cleanedSql})` }],
        rowCount: 1,
        affectedRows: 0,
        executionTimeMs: 0,
        sql: cleanedSql
      };
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

  public async updateTableRows(
    tableName: string,
    updates: Array<{
      primaryKeyValues: Record<string, any>;
      updatedValues: Record<string, any>;
    }>
  ): Promise<{ affectedRows: number }> {
    if (!this.activeDb) {
      throw new Error('No hay conexión activa a la base de datos Firebird.');
    }

    if (!tableName || !tableName.trim()) {
      throw new Error('Nombre de tabla inválido.');
    }

    if (!updates || updates.length === 0) {
      return { affectedRows: 0 };
    }

    const cleanTableName = tableName.trim().toUpperCase();
    const tableDetails = await this.getTableDetails(cleanTableName);

    if (!tableDetails || !tableDetails.columns || tableDetails.columns.length === 0) {
      throw new Error(`No se encontró la tabla "${cleanTableName}" en la base de datos.`);
    }

    const columnMap = new Map<string, any>();
    tableDetails.columns.forEach((c: any) => columnMap.set(c.columnName.toUpperCase(), c));

    const pkColumns = tableDetails.columns
      .filter((c: any) => c.isPrimaryKey)
      .map((c: any) => c.columnName.toUpperCase());

    if (pkColumns.length === 0) {
      throw new Error(
        `La tabla "${cleanTableName}" no posee una Clave Primaria (Primary Key) definida. Por seguridad e integridad de datos, no se permiten ediciones directas.`
      );
    }

    const castValue = (colName: string, val: any): any => {
      if (val === null || val === undefined) return null;
      const col = columnMap.get(colName.toUpperCase());
      const fieldType = (col?.fieldType || '').toUpperCase();

      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.toUpperCase() === '(NULL)' || trimmed.toUpperCase() === 'NULL' || (trimmed === '' && col?.isNullable)) {
          return null;
        }

        if (
          fieldType.includes('INT') ||
          fieldType.includes('SMALLINT') ||
          fieldType.includes('BIGINT')
        ) {
          if (trimmed === '') return col?.isNullable ? null : 0;
          const parsed = parseInt(trimmed, 10);
          return isNaN(parsed) ? val : parsed;
        }

        if (
          fieldType.includes('FLOAT') ||
          fieldType.includes('DOUBLE') ||
          fieldType.includes('NUMERIC') ||
          fieldType.includes('DECIMAL')
        ) {
          if (trimmed === '') return col?.isNullable ? null : 0;
          const parsed = parseFloat(trimmed.replace(',', '.'));
          return isNaN(parsed) ? val : parsed;
        }

        if (fieldType.includes('BOOLEAN')) {
          if (trimmed === '') return col?.isNullable ? null : false;
          return trimmed.toLowerCase() === 'true' || trimmed === '1';
        }

        return val;
      }

      return val;
    };

    const isolation = (Firebird as any).ISOLATION_READ_COMMITTED || (FirebirdRaw as any).ISOLATION_READ_COMMITTED;

    return new Promise((resolve, reject) => {
      const executeUpdates = (dbOrTx: any, isTx: boolean) => {
        (async () => {
          let totalAffected = 0;

          for (const update of updates) {
            const setEntries = Object.entries(update.updatedValues);
            if (setEntries.length === 0) continue;

            const setClauses: string[] = [];
            const queryParams: any[] = [];

            for (const [rawCol, rawVal] of setEntries) {
              const matchedCol = tableDetails.columns.find(
                (c: any) => c.columnName.toUpperCase() === rawCol.toUpperCase()
              );
              const exactColName = matchedCol ? matchedCol.columnName : rawCol.toUpperCase();

              setClauses.push(`"${exactColName.replace(/"/g, '""')}" = ?`);
              queryParams.push(castValue(exactColName, rawVal));
            }

            const whereClauses: string[] = [];
            for (const pkCol of pkColumns) {
              const matchedPk = tableDetails.columns.find(
                (c: any) => c.columnName.toUpperCase() === pkCol.toUpperCase()
              );
              const exactPkName = matchedPk ? matchedPk.columnName : pkCol.toUpperCase();

              const pkMatchKey = Object.keys(update.primaryKeyValues).find(
                (k) => k.toUpperCase() === pkCol
              );

              if (!pkMatchKey || update.primaryKeyValues[pkMatchKey] === undefined) {
                throw new Error(
                  `Falta el valor de la clave primaria "${exactPkName}" para identificar unívocamente la fila.`
                );
              }

              whereClauses.push(`"${exactPkName.replace(/"/g, '""')}" = ?`);
              queryParams.push(castValue(exactPkName, update.primaryKeyValues[pkMatchKey]));
            }

            const exactTableName = tableDetails.tableName || cleanTableName;
            const sql = `UPDATE "${exactTableName.replace(/"/g, '""')}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;

            await new Promise<void>((stmtRes, stmtRej) => {
              dbOrTx.query(sql, queryParams, (qErr: any, qRes: any) => {
                if (qErr) return stmtRej(qErr);
                totalAffected += typeof qRes === 'number' ? qRes : 1;
                stmtRes();
              });
            });
          }

          if (isTx) {
            dbOrTx.commit((cErr: any) => {
              if (cErr) return reject(cErr);
              resolve({ affectedRows: totalAffected });
            });
          } else {
            resolve({ affectedRows: totalAffected });
          }
        })().catch((err) => {
          if (isTx) {
            dbOrTx.rollback(() => {
              reject(err);
            });
          } else {
            reject(err);
          }
        });
      };

      if (typeof (this.activeDb as any).transaction === 'function') {
        (this.activeDb as any).transaction(isolation, (tErr: any, tx: any) => {
          if (tErr) return reject(tErr);
          executeUpdates(tx, true);
        });
      } else {
        executeUpdates(this.activeDb, false);
      }
    });
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
    procedures: { name: string; inputs: number; outputs: number; inputParams?: string[] }[];
    triggers: { name: string; table: string; inactive: boolean }[];
    generators: string[];
    domains: string[];
    exceptions: string[];
    columnsByTable?: Record<string, string[]>;
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

    const procParamsQuery = `
      SELECT 
        TRIM(RDB$PROCEDURE_NAME) AS PROC_NAME,
        TRIM(RDB$PARAMETER_NAME) AS PARAM_NAME,
        COALESCE(RDB$PARAMETER_NUMBER, 0) AS PARAM_NUM
      FROM RDB$PROCEDURE_PARAMETERS
      WHERE RDB$PARAMETER_TYPE = 0
      ORDER BY RDB$PROCEDURE_NAME, RDB$PARAMETER_NUMBER
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

    const columnsQuery = `
      SELECT 
        TRIM(RF.RDB$RELATION_NAME) AS TABLE_NAME,
        TRIM(RF.RDB$FIELD_NAME) AS COLUMN_NAME
      FROM RDB$RELATION_FIELDS RF
      JOIN RDB$RELATIONS R ON R.RDB$RELATION_NAME = RF.RDB$RELATION_NAME
      WHERE (R.RDB$SYSTEM_FLAG = 0 OR R.RDB$SYSTEM_FLAG IS NULL)
      ORDER BY RF.RDB$RELATION_NAME, RF.RDB$FIELD_POSITION
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
      const [tables, views, procs, procParams, triggers, gens, domains, exceptions, colRows] = await Promise.all([
        queryAsync(tablesQuery),
        queryAsync(viewsQuery),
        queryAsync(proceduresQuery),
        queryAsync(procParamsQuery),
        queryAsync(triggersQuery),
        queryAsync(generatorsQuery),
        queryAsync(domainsQuery),
        queryAsync(exceptionsQuery),
        queryAsync(columnsQuery)
      ]);

      const paramsByProc: Record<string, string[]> = {};
      for (const row of procParams) {
        const procName = this.extractString(row, 'PROC_NAME', 'RDB$PROCEDURE_NAME');
        const paramName = this.extractString(row, 'PARAM_NAME', 'RDB$PARAMETER_NAME');
        if (procName && paramName) {
          if (!paramsByProc[procName]) paramsByProc[procName] = [];
          paramsByProc[procName].push(paramName);
        }
      }

      const columnsByTable: Record<string, string[]> = {};
      for (const row of colRows) {
        const tbl = this.extractString(row, 'TABLE_NAME', 'RDB$RELATION_NAME');
        const col = this.extractString(row, 'COLUMN_NAME', 'RDB$FIELD_NAME');
        if (tbl && col) {
          if (!columnsByTable[tbl]) {
            columnsByTable[tbl] = [];
          }
          columnsByTable[tbl].push(col);
        }
      }

      return {
        tables: tables.map(r => this.extractString(r, 'NAME', 'RDB$RELATION_NAME')).filter(Boolean),
        views: views.map(r => this.extractString(r, 'NAME', 'RDB$RELATION_NAME')).filter(Boolean),
        procedures: procs.map(r => {
          const name = this.extractString(r, 'NAME', 'RDB$PROCEDURE_NAME');
          return {
            name,
            inputs: this.extractNumber(r, 'INPUTS', 'RDB$PROCEDURE_INPUTS'),
            outputs: this.extractNumber(r, 'OUTPUTS', 'RDB$PROCEDURE_OUTPUTS'),
            inputParams: paramsByProc[name] || []
          };
        }).filter(p => Boolean(p.name)),
        triggers: triggers.map(r => ({
          name: this.extractString(r, 'NAME', 'RDB$TRIGGER_NAME'),
          table: this.extractString(r, 'TABLE_NAME', 'RDB$RELATION_NAME'),
          inactive: this.extractNumber(r, 'INACTIVE', 'RDB$TRIGGER_INACTIVE') === 1
        })).filter(t => Boolean(t.name)),
        generators: gens.map(r => this.extractString(r, 'NAME', 'RDB$GENERATOR_NAME')).filter(Boolean),
        domains: domains.map(r => this.extractString(r, 'NAME', 'RDB$FIELD_NAME')).filter(Boolean),
        exceptions: exceptions.map(r => this.extractString(r, 'NAME', 'RDB$EXCEPTION_NAME')).filter(Boolean),
        columnsByTable
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

    if (typeUpper === 'GENERATOR' || typeUpper === 'SEQUENCE') {
      const q = `SELECT GEN_ID(${cleanName}, 0) AS VAL FROM RDB$DATABASE;`;
      const rows = await queryParamsAsync(q, []);
      const val = rows.length > 0 ? (rows[0].VAL ?? 0) : 0;
      const ddl = `CREATE SEQUENCE ${cleanName};\nALTER SEQUENCE ${cleanName} RESTART WITH ${val};\n`;
      return { ddl, name: cleanName, type: 'GENERATOR' };
    }

    if (typeUpper === 'EXCEPTION') {
      const q = `SELECT TRIM(RDB$MESSAGE) AS MSG FROM RDB$EXCEPTIONS WHERE TRIM(RDB$EXCEPTION_NAME) = ?`;
      const rows = await queryParamsAsync(q, [cleanName]);
      const msg = rows.length > 0 ? (rows[0].MSG || '') : '';
      const ddl = `CREATE EXCEPTION ${cleanName} '${msg}';\n`;
      return { ddl, name: cleanName, type: 'EXCEPTION' };
    }

    if (typeUpper === 'DOMAIN') {
      const q = `
        SELECT 
          F.RDB$FIELD_TYPE AS FIELD_TYPE_CODE,
          F.RDB$FIELD_SUB_TYPE AS FIELD_SUB_TYPE,
          F.RDB$FIELD_LENGTH AS FIELD_LENGTH,
          F.RDB$FIELD_PRECISION AS FIELD_PRECISION,
          F.RDB$FIELD_SCALE AS FIELD_SCALE,
          F.RDB$NULL_FLAG AS NULL_FLAG,
          F.RDB$DEFAULT_SOURCE AS DEFAULT_SOURCE,
          F.RDB$VALIDATION_SOURCE AS CHECK_SOURCE
        FROM RDB$FIELDS F
        WHERE TRIM(F.RDB$FIELD_NAME) = ?
      `;
      const rows = await queryParamsAsync(q, [cleanName]);
      if (rows.length === 0) {
        throw new Error(`No se encontró el dominio '${cleanName}'.`);
      }
      const r = rows[0];
      const typeStr = this.resolveFieldType(
        Number(r.FIELD_TYPE_CODE),
        Number(r.FIELD_SUB_TYPE),
        Number(r.FIELD_LENGTH),
        Number(r.FIELD_PRECISION),
        Number(r.FIELD_SCALE)
      );
      let ddl = `CREATE DOMAIN ${cleanName} AS ${typeStr}`;
      const def = await this.readBlobValue(r.DEFAULT_SOURCE);
      if (def && def.trim()) ddl += ` ${def.trim()}`;
      if (Number(r.NULL_FLAG) === 1) ddl += ' NOT NULL';
      const check = await this.readBlobValue(r.CHECK_SOURCE);
      if (check && check.trim()) ddl += `\n  CHECK (${check.trim()})`;
      ddl += ';\n';
      return { ddl, name: cleanName, type: 'DOMAIN' };
    }

    throw new Error(`Tipo de objeto '${objectType}' no soportado para generación de DDL.`);
  }

  public async getObjectDependencies(objectName: string, objectType?: string): Promise<{
    objectName: string;
    objectType: string;
    dependsOn: Array<{
      objectName: string;
      objectType: string;
      fieldName?: string | null;
      fields?: string[];
      detail?: string;
    }>;
    dependedOnBy: Array<{
      objectName: string;
      objectType: string;
      fieldName?: string | null;
      fields?: string[];
      detail?: string;
    }>;
  }> {
    if (!this.activeDb) {
      throw new Error('No hay conexión activa a la base de datos.');
    }

    const cleanName = objectName.trim().toUpperCase();

    const queryParamsAsync = (sql: string, params: any[]): Promise<any[]> => {
      return new Promise((res, rej) => {
        this.activeDb!.query(sql, params, (err, rows) => {
          if (err) return rej(err);
          res(Array.isArray(rows) ? rows : []);
        });
      });
    };

    // 1. Differentiate tables vs views
    const relationsQuery = `
      SELECT 
        TRIM(RDB$RELATION_NAME) AS NAME,
        CASE WHEN RDB$VIEW_BLR IS NOT NULL THEN 'VIEW' ELSE 'TABLE' END AS TYPE
      FROM RDB$RELATIONS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
    `;

    // 2. Query RDB$DEPENDENCIES in both directions
    const dependsOnQuery = `
      SELECT 
        TRIM(D.RDB$DEPENDED_ON_NAME) AS OBJ_NAME,
        D.RDB$DEPENDED_ON_TYPE AS TYPE_CODE,
        TRIM(D.RDB$FIELD_NAME) AS FIELD_NAME
      FROM RDB$DEPENDENCIES D
      WHERE TRIM(D.RDB$DEPENDENT_NAME) = ?
    `;

    const dependedOnByQuery = `
      SELECT 
        TRIM(D.RDB$DEPENDENT_NAME) AS OBJ_NAME,
        D.RDB$DEPENDENT_TYPE AS TYPE_CODE,
        TRIM(D.RDB$FIELD_NAME) AS FIELD_NAME
      FROM RDB$DEPENDENCIES D
      WHERE TRIM(D.RDB$DEPENDED_ON_NAME) = ?
    `;

    // 3. Foreign Keys (if table)
    const fkQuery = `
      SELECT 
        TRIM(RC.RDB$CONSTRAINT_NAME) AS CONSTRAINT_NAME,
        TRIM(RC.RDB$RELATION_NAME) AS SOURCE_TABLE,
        TRIM(RC_PK.RDB$RELATION_NAME) AS TARGET_TABLE,
        TRIM(ISG_SRC.RDB$FIELD_NAME) AS SOURCE_FIELD,
        TRIM(ISG_TGT.RDB$FIELD_NAME) AS TARGET_FIELD
      FROM RDB$RELATION_CONSTRAINTS RC
      JOIN RDB$REF_CONSTRAINTS REF ON RC.RDB$CONSTRAINT_NAME = REF.RDB$CONSTRAINT_NAME
      JOIN RDB$RELATION_CONSTRAINTS RC_PK ON REF.RDB$CONST_NAME_UQ = RC_PK.RDB$CONSTRAINT_NAME
      LEFT JOIN RDB$INDEX_SEGMENTS ISG_SRC ON RC.RDB$INDEX_NAME = ISG_SRC.RDB$INDEX_NAME
      LEFT JOIN RDB$INDEX_SEGMENTS ISG_TGT ON RC_PK.RDB$INDEX_NAME = ISG_TGT.RDB$INDEX_NAME
        AND ISG_SRC.RDB$FIELD_POSITION = ISG_TGT.RDB$FIELD_POSITION
      WHERE RC.RDB$CONSTRAINT_TYPE = 'FOREIGN KEY'
        AND (TRIM(RC.RDB$RELATION_NAME) = ? OR TRIM(RC_PK.RDB$RELATION_NAME) = ?)
      ORDER BY RC.RDB$CONSTRAINT_NAME, ISG_SRC.RDB$FIELD_POSITION
    `;

    // 4. Domains (fields using domains)
    const domainQuery = `
      SELECT 
        TRIM(RF.RDB$RELATION_NAME) AS TABLE_NAME,
        TRIM(RF.RDB$FIELD_NAME) AS COLUMN_NAME,
        TRIM(RF.RDB$FIELD_SOURCE) AS DOMAIN_NAME
      FROM RDB$RELATION_FIELDS RF
      JOIN RDB$FIELDS F ON RF.RDB$FIELD_SOURCE = F.RDB$FIELD_NAME
      WHERE (TRIM(RF.RDB$RELATION_NAME) = ? OR TRIM(RF.RDB$FIELD_SOURCE) = ?)
        AND RF.RDB$FIELD_SOURCE NOT STARTING WITH 'RDB$'
    `;

    // 5. Triggers for table
    const tableTriggersQuery = `
      SELECT 
        TRIM(RDB$TRIGGER_NAME) AS TRIGGER_NAME,
        RDB$TRIGGER_TYPE AS TRIG_TYPE,
        COALESCE(RDB$TRIGGER_INACTIVE, 0) AS INACTIVE
      FROM RDB$TRIGGERS
      WHERE TRIM(RDB$RELATION_NAME) = ?
        AND (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
    `;

    const [relations, rawDependsOn, rawDependedOnBy, rawFks, rawDomains, rawTableTriggers] = await Promise.all([
      queryParamsAsync(relationsQuery, []).catch(() => []),
      queryParamsAsync(dependsOnQuery, [cleanName]).catch(() => []),
      queryParamsAsync(dependedOnByQuery, [cleanName]).catch(() => []),
      queryParamsAsync(fkQuery, [cleanName, cleanName]).catch(() => []),
      queryParamsAsync(domainQuery, [cleanName, cleanName]).catch(() => []),
      queryParamsAsync(tableTriggersQuery, [cleanName]).catch(() => [])
    ]);

    const relationMap = new Map<string, string>();
    for (const rel of relations) {
      const name = this.extractString(rel, 'NAME');
      const type = this.extractString(rel, 'TYPE');
      if (name) relationMap.set(name, type);
    }

    const resolveType = (code: number, name: string): string => {
      switch (code) {
        case 0:
          return relationMap.get(name) || 'TABLE';
        case 1: return 'VIEW';
        case 2: return 'TRIGGER';
        case 3: return 'COMPUTED_FIELD';
        case 4: return 'VALIDATION';
        case 5: return 'PROCEDURE';
        case 6: return 'EXPRESSION_INDEX';
        case 7: return 'EXCEPTION';
        case 8: return 'USER';
        case 9: return 'COLUMN';
        case 10: return 'INDEX';
        case 14: return 'GENERATOR';
        case 15: return 'FUNCTION';
        case 18: return 'PACKAGE';
        default: return 'OTHER';
      }
    };

    // Helper map for dependsOn
    const dependsOnMap = new Map<string, {
      objectName: string;
      objectType: string;
      fieldName?: string | null;
      fields: string[];
      detail?: string;
    }>();

    // Helper map for dependedOnBy
    const dependedOnByMap = new Map<string, {
      objectName: string;
      objectType: string;
      fieldName?: string | null;
      fields: string[];
      detail?: string;
    }>();

    // Process rawDependsOn from RDB$DEPENDENCIES
    for (const row of rawDependsOn) {
      const objName = this.extractString(row, 'OBJ_NAME');
      if (!objName || objName === cleanName || objName.startsWith('RDB$')) continue;
      const typeCode = this.extractNumber(row, 'TYPE_CODE');
      const fieldName = this.extractString(row, 'FIELD_NAME');
      const objType = resolveType(typeCode, objName);

      const key = `${objType}:${objName}`;
      if (!dependsOnMap.has(key)) {
        dependsOnMap.set(key, {
          objectName: objName,
          objectType: objType,
          fields: [],
          fieldName: fieldName || null,
          detail: 'Referencia en definición'
        });
      }
      if (fieldName && !dependsOnMap.get(key)!.fields.includes(fieldName)) {
        dependsOnMap.get(key)!.fields.push(fieldName);
      }
    }

    // Process rawDependedOnBy from RDB$DEPENDENCIES
    for (const row of rawDependedOnBy) {
      const objName = this.extractString(row, 'OBJ_NAME');
      if (!objName || objName === cleanName || objName.startsWith('RDB$')) continue;
      const typeCode = this.extractNumber(row, 'TYPE_CODE');
      const fieldName = this.extractString(row, 'FIELD_NAME');
      const objType = resolveType(typeCode, objName);

      const key = `${objType}:${objName}`;
      if (!dependedOnByMap.has(key)) {
        dependedOnByMap.set(key, {
          objectName: objName,
          objectType: objType,
          fields: [],
          fieldName: fieldName || null,
          detail: 'Depende de este objeto'
        });
      }
      if (fieldName && !dependedOnByMap.get(key)!.fields.includes(fieldName)) {
        dependedOnByMap.get(key)!.fields.push(fieldName);
      }
    }

    // Process Foreign Keys
    for (const fk of rawFks) {
      const constraintName = this.extractString(fk, 'CONSTRAINT_NAME');
      const srcTable = this.extractString(fk, 'SOURCE_TABLE');
      const tgtTable = this.extractString(fk, 'TARGET_TABLE');
      const srcField = this.extractString(fk, 'SOURCE_FIELD');
      const tgtField = this.extractString(fk, 'TARGET_FIELD');

      if (srcTable === cleanName && tgtTable && tgtTable !== cleanName) {
        const key = `TABLE:${tgtTable}`;
        const fkDesc = `Clave foránea ${constraintName} (${srcField} -> ${tgtTable}.${tgtField})`;
        if (!dependsOnMap.has(key)) {
          dependsOnMap.set(key, {
            objectName: tgtTable,
            objectType: 'TABLE',
            fields: [tgtField],
            fieldName: tgtField,
            detail: fkDesc
          });
        } else {
          dependsOnMap.get(key)!.detail = fkDesc;
        }
      } else if (tgtTable === cleanName && srcTable && srcTable !== cleanName) {
        const key = `TABLE:${srcTable}`;
        const fkDesc = `Referenciado por clave foránea ${constraintName} (${srcTable}.${srcField} -> ${tgtField})`;
        if (!dependedOnByMap.has(key)) {
          dependedOnByMap.set(key, {
            objectName: srcTable,
            objectType: 'TABLE',
            fields: [srcField],
            fieldName: srcField,
            detail: fkDesc
          });
        } else {
          dependedOnByMap.get(key)!.detail = fkDesc;
        }
      }
    }

    // Process Domains
    for (const dom of rawDomains) {
      const tbl = this.extractString(dom, 'TABLE_NAME');
      const col = this.extractString(dom, 'COLUMN_NAME');
      const domName = this.extractString(dom, 'DOMAIN_NAME');

      if (tbl === cleanName && domName) {
        const key = `DOMAIN:${domName}`;
        if (!dependsOnMap.has(key)) {
          dependsOnMap.set(key, {
            objectName: domName,
            objectType: 'DOMAIN',
            fields: [col],
            fieldName: col,
            detail: `Dominio utilizado en columna ${col}`
          });
        } else {
          if (!dependsOnMap.get(key)!.fields.includes(col)) {
            dependsOnMap.get(key)!.fields.push(col);
          }
        }
      } else if (domName === cleanName && tbl) {
        const key = `TABLE:${tbl}`;
        if (!dependedOnByMap.has(key)) {
          dependedOnByMap.set(key, {
            objectName: tbl,
            objectType: relationMap.get(tbl) || 'TABLE',
            fields: [col],
            fieldName: col,
            detail: `Columna ${col}`
          });
        } else {
          if (!dependedOnByMap.get(key)!.fields.includes(col)) {
            dependedOnByMap.get(key)!.fields.push(col);
          }
        }
      }
    }

    // Process Table Triggers
    for (const trig of rawTableTriggers) {
      const trigName = this.extractString(trig, 'TRIGGER_NAME');
      if (trigName) {
        const key = `TRIGGER:${trigName}`;
        const trigTypeNum = this.extractNumber(trig, 'TRIG_TYPE');
        const trigTypeDesc = this.decodeTriggerType(trigTypeNum);
        if (!dependedOnByMap.has(key)) {
          dependedOnByMap.set(key, {
            objectName: trigName,
            objectType: 'TRIGGER',
            fields: [],
            detail: `Trigger de la tabla (${trigTypeDesc})`
          });
        }
      }
    }

    // Update details if multiple fields
    for (const item of dependsOnMap.values()) {
      if (item.fields.length > 0 && item.detail === 'Referencia en definición') {
        item.detail = `Campos referenciados: ${item.fields.join(', ')}`;
      }
    }
    for (const item of dependedOnByMap.values()) {
      if (item.fields.length > 0 && item.detail === 'Depende de este objeto') {
        item.detail = `Campos: ${item.fields.join(', ')}`;
      }
    }

    let detectedType = objectType?.toUpperCase();
    if (!detectedType || detectedType === 'OBJECT') {
      if (relationMap.has(cleanName)) {
        detectedType = relationMap.get(cleanName)!;
      } else {
        detectedType = 'OBJECT';
      }
    }

    return {
      objectName: cleanName,
      objectType: detectedType,
      dependsOn: Array.from(dependsOnMap.values()),
      dependedOnBy: Array.from(dependedOnByMap.values())
    };
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

  /**
   * Internal query helper to run SQL queries returning an array of objects.
   */
  public async queryInternal(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.activeDb) {
      throw new Error('No hay conexión activa a la base de datos Firebird.');
    }
    return new Promise((resolve, reject) => {
      this.activeDb!.query(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(Array.isArray(rows) ? rows : []);
      });
    });
  }

  /**
   * Fetches real-time server and session monitoring metrics from MON$ tables.
   */
  public async getMonitoringData(): Promise<any> {
    if (!this.activeDb) {
      throw new Error('No hay conexión activa a la base de datos Firebird.');
    }

    // 1. Current connection ID
    let currentConnId = 0;
    try {
      const connRows: any[] = await this.queryInternal('SELECT CURRENT_CONNECTION AS CURRENT_CONN FROM RDB$DATABASE');
      if (connRows.length > 0) {
        currentConnId = this.extractNumber(connRows[0], 'CURRENT_CONN');
      }
    } catch (e) {
      console.warn('Could not get CURRENT_CONNECTION:', e);
    }

    // 2. Database info & transaction stats from MON$DATABASE
    const dbSql = `
      SELECT
        d.MON$DATABASE_NAME AS DATABASE_NAME,
        d.MON$PAGE_SIZE AS PAGE_SIZE,
        d.MON$ODS_MAJOR AS ODS_MAJOR,
        d.MON$ODS_MINOR AS ODS_MINOR,
        d.MON$OLDEST_TRANSACTION AS OIT,
        d.MON$OLDEST_ACTIVE AS OAT,
        d.MON$OLDEST_SNAPSHOT AS OST,
        d.MON$NEXT_TRANSACTION AS NEXT_TX,
        d.MON$SWEEP_INTERVAL AS SWEEP_INTERVAL,
        d.MON$PAGES AS TOTAL_PAGES,
        d.MON$PAGE_BUFFERS AS PAGE_BUFFERS,
        d.MON$SQL_DIALECT AS SQL_DIALECT,
        d.MON$SHUTDOWN_MODE AS SHUTDOWN_MODE
      FROM MON$DATABASE d
    `;
    const dbRows: any[] = await this.queryInternal(dbSql);
    const dbRow = dbRows[0] || {};
    const pageSize = this.extractNumber(dbRow, 'PAGE_SIZE') || 4096;
    const totalPages = this.extractNumber(dbRow, 'TOTAL_PAGES');
    const sizeMb = Number(((totalPages * pageSize) / (1024 * 1024)).toFixed(2));
    const nextTx = this.extractNumber(dbRow, 'NEXT_TX');
    const oat = this.extractNumber(dbRow, 'OAT');
    const oit = this.extractNumber(dbRow, 'OIT');
    const ost = this.extractNumber(dbRow, 'OST');
    const sweepInterval = this.extractNumber(dbRow, 'SWEEP_INTERVAL');

    const dbInfo = {
      databaseName: this.extractString(dbRow, 'DATABASE_NAME'),
      pageSize,
      odsMajor: this.extractNumber(dbRow, 'ODS_MAJOR'),
      odsMinor: this.extractNumber(dbRow, 'ODS_MINOR'),
      oit,
      oat,
      ost,
      nextTx,
      txActiveGap: Math.max(0, nextTx - oat),
      txSweepGap: Math.max(0, nextTx - oit),
      sweepInterval,
      totalPages,
      pageBuffers: this.extractNumber(dbRow, 'PAGE_BUFFERS'),
      sizeMb,
      sqlDialect: this.extractNumber(dbRow, 'SQL_DIALECT'),
      currentAttachmentId: currentConnId,
    };

    // 3. Attachments (Sessions) from MON$ATTACHMENTS
    const attSql = `
      SELECT
        a.MON$ATTACHMENT_ID AS ATTACHMENT_ID,
        a.MON$SERVER_PID AS SERVER_PID,
        a.MON$STATE AS STATE,
        a.MON$ATTACHMENT_NAME AS ATTACHMENT_NAME,
        a.MON$USER AS USER_NAME,
        a.MON$ROLE AS ROLE_NAME,
        a.MON$REMOTE_PROTOCOL AS REMOTE_PROTOCOL,
        a.MON$REMOTE_ADDRESS AS REMOTE_ADDRESS,
        a.MON$REMOTE_PID AS REMOTE_PID,
        a.MON$REMOTE_PROCESS AS REMOTE_PROCESS,
        a.MON$TIMESTAMP AS CONNECTED_AT
      FROM MON$ATTACHMENTS a
      ORDER BY a.MON$STATE DESC, a.MON$TIMESTAMP DESC
    `;
    const attRows: any[] = await this.queryInternal(attSql);

    // 4. Statements (Queries) from MON$STATEMENTS
    const stmtsSql = `
      SELECT
        s.MON$STATEMENT_ID AS STATEMENT_ID,
        s.MON$ATTACHMENT_ID AS ATTACHMENT_ID,
        a.MON$USER AS USER_NAME,
        a.MON$REMOTE_ADDRESS AS REMOTE_ADDRESS,
        a.MON$REMOTE_PROCESS AS REMOTE_PROCESS,
        s.MON$STATE AS STATE,
        s.MON$TIMESTAMP AS STARTED_AT,
        s.MON$SQL_TEXT AS SQL_TEXT,
        s.MON$TRANSACTION_ID AS TRANSACTION_ID,
        COALESCE(i.MON$PAGE_READS, 0) AS PAGE_READS,
        COALESCE(i.MON$PAGE_WRITES, 0) AS PAGE_WRITES,
        COALESCE(i.MON$PAGE_FETCHES, 0) AS PAGE_FETCHES,
        COALESCE(i.MON$PAGE_MARKS, 0) AS PAGE_MARKS
      FROM MON$STATEMENTS s
      LEFT JOIN MON$ATTACHMENTS a ON a.MON$ATTACHMENT_ID = s.MON$ATTACHMENT_ID
      LEFT JOIN MON$IO_STATS i ON i.MON$STAT_ID = s.MON$STAT_ID
      ORDER BY s.MON$STATE DESC, s.MON$TIMESTAMP DESC
    `;
    const stmtsRows: any[] = await this.queryInternal(stmtsSql);

    // Process statements: read blob if SQL_TEXT is blob/function
    const statements = await Promise.all(
      stmtsRows.map(async (row) => {
        let sqlText = '';
        if (typeof row.SQL_TEXT === 'function' || Buffer.isBuffer(row.SQL_TEXT)) {
          sqlText = await this.readBlobValue(row.SQL_TEXT);
        } else if (typeof row.SQL_TEXT === 'string') {
          sqlText = row.SQL_TEXT;
        } else {
          sqlText = this.extractString(row, 'SQL_TEXT');
        }

        const startedAt = row.STARTED_AT ? new Date(row.STARTED_AT).toISOString() : '';
        const elapsedMs = row.STARTED_AT ? Math.max(0, Date.now() - new Date(row.STARTED_AT).getTime()) : 0;

        return {
          statementId: this.extractNumber(row, 'STATEMENT_ID'),
          attachmentId: this.extractNumber(row, 'ATTACHMENT_ID'),
          userName: this.extractString(row, 'USER_NAME'),
          remoteAddress: this.extractString(row, 'REMOTE_ADDRESS'),
          remoteProcess: this.extractString(row, 'REMOTE_PROCESS'),
          state: this.extractNumber(row, 'STATE'),
          startedAt,
          sqlText: sqlText.trim(),
          transactionId: this.extractNumber(row, 'TRANSACTION_ID'),
          pageReads: this.extractNumber(row, 'PAGE_READS'),
          pageWrites: this.extractNumber(row, 'PAGE_WRITES'),
          pageFetches: this.extractNumber(row, 'PAGE_FETCHES'),
          pageMarks: this.extractNumber(row, 'PAGE_MARKS'),
          elapsedMs,
        };
      })
    );

    // Map statement counts per attachment
    const stmtCountByAttachment = new Map<number, number>();
    for (const stmt of statements) {
      if (stmt.state === 1) {
        stmtCountByAttachment.set(stmt.attachmentId, (stmtCountByAttachment.get(stmt.attachmentId) || 0) + 1);
      }
    }

    // 5. Transactions from MON$TRANSACTIONS
    const txSql = `
      SELECT
        t.MON$TRANSACTION_ID AS TRANSACTION_ID,
        t.MON$ATTACHMENT_ID AS ATTACHMENT_ID,
        a.MON$USER AS USER_NAME,
        a.MON$REMOTE_ADDRESS AS REMOTE_ADDRESS,
        a.MON$REMOTE_PROCESS AS REMOTE_PROCESS,
        t.MON$STATE AS STATE,
        t.MON$TIMESTAMP AS STARTED_AT,
        t.MON$TOP_TRANSACTION AS TOP_TX,
        t.MON$OLDEST_TRANSACTION AS OLDEST_TX,
        t.MON$ISOLATION_MODE AS ISOLATION_MODE,
        t.MON$READ_ONLY AS READ_ONLY
      FROM MON$TRANSACTIONS t
      LEFT JOIN MON$ATTACHMENTS a ON a.MON$ATTACHMENT_ID = t.MON$ATTACHMENT_ID
      ORDER BY t.MON$TRANSACTION_ID ASC
    `;
    const txRows: any[] = await this.queryInternal(txSql);

    const txCountByAttachment = new Map<number, number>();
    const transactions = txRows.map((row) => {
      const attId = this.extractNumber(row, 'ATTACHMENT_ID');
      txCountByAttachment.set(attId, (txCountByAttachment.get(attId) || 0) + 1);
      const startedAt = row.STARTED_AT ? new Date(row.STARTED_AT).toISOString() : '';
      const elapsedMs = row.STARTED_AT ? Math.max(0, Date.now() - new Date(row.STARTED_AT).getTime()) : 0;

      return {
        transactionId: this.extractNumber(row, 'TRANSACTION_ID'),
        attachmentId: attId,
        userName: this.extractString(row, 'USER_NAME'),
        remoteAddress: this.extractString(row, 'REMOTE_ADDRESS'),
        remoteProcess: this.extractString(row, 'REMOTE_PROCESS'),
        state: this.extractNumber(row, 'STATE'),
        startedAt,
        topTx: this.extractNumber(row, 'TOP_TX'),
        oldestTx: this.extractNumber(row, 'OLDEST_TX'),
        isolationMode: this.extractNumber(row, 'ISOLATION_MODE'),
        readOnly: this.extractNumber(row, 'READ_ONLY') === 1,
        elapsedMs,
      };
    });

    const attachments = attRows.map((row) => {
      const attId = this.extractNumber(row, 'ATTACHMENT_ID');
      const connectedAt = row.CONNECTED_AT ? new Date(row.CONNECTED_AT).toISOString() : '';
      return {
        attachmentId: attId,
        serverPid: this.extractNumber(row, 'SERVER_PID'),
        state: this.extractNumber(row, 'STATE'),
        attachmentName: this.extractString(row, 'ATTACHMENT_NAME'),
        userName: this.extractString(row, 'USER_NAME'),
        roleName: this.extractString(row, 'ROLE_NAME'),
        remoteProtocol: this.extractString(row, 'REMOTE_PROTOCOL'),
        remoteAddress: this.extractString(row, 'REMOTE_ADDRESS'),
        remotePid: this.extractNumber(row, 'REMOTE_PID'),
        remoteProcess: this.extractString(row, 'REMOTE_PROCESS'),
        connectedAt,
        statementCount: stmtCountByAttachment.get(attId) || 0,
        transactionCount: txCountByAttachment.get(attId) || 0,
        isCurrent: attId === currentConnId,
      };
    });

    return {
      database: dbInfo,
      attachments,
      statements,
      transactions,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Kills/cancels an actively executing statement via DELETE FROM MON$STATEMENTS.
   */
  public async killStatement(statementId: number): Promise<boolean> {
    if (!this.activeDb) {
      throw new Error('No hay conexión activa a la base de datos.');
    }
    const cleanId = Number(statementId);
    if (!cleanId || cleanId <= 0) {
      throw new Error('ID de consulta inválido.');
    }
    await this.queryInternal(`DELETE FROM MON$STATEMENTS WHERE MON$STATEMENT_ID = ${cleanId}`);
    return true;
  }

  /**
   * Disconnects/terminates an active attachment session via DELETE FROM MON$ATTACHMENTS.
   */
  public async killAttachment(attachmentId: number): Promise<boolean> {
    if (!this.activeDb) {
      throw new Error('No hay conexión activa a la base de datos.');
    }
    const cleanId = Number(attachmentId);
    if (!cleanId || cleanId <= 0) {
      throw new Error('ID de conexión inválido.');
    }
    await this.queryInternal(`DELETE FROM MON$ATTACHMENTS WHERE MON$ATTACHMENT_ID = ${cleanId}`);
    return true;
  }
}
