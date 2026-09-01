import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { FirebirdService } from './firebird-service';

export interface DumpOptions {
  outputPath: string;
  includeStructure: boolean;
  includeData: boolean;
  includeGenerators: boolean;
  includeViews: boolean;
  includeProcedures: boolean;
  includeTriggers: boolean;
  includeForeignKeys: boolean;
  selectedTables: string[]; // empty means all tables
  batchCommitSize?: number;
}

export interface DumpProgress {
  stage: string;
  currentTable?: string;
  totalTables?: number;
  currentTableIndex?: number;
  rowsExported?: number;
  totalRowsInTable?: number;
  percentage: number;
  message: string;
}

export interface ImportOptions {
  filePath: string;
  stopOnError: boolean;
}

export interface ImportErrorItem {
  statementIndex: number;
  statementSnippet: string;
  error: string;
  lineNumber: number;
}

export interface ImportProgress {
  bytesProcessed: number;
  totalBytes: number;
  percentage: number;
  statementsExecuted: number;
  errorsCount: number;
  currentStatementSnippet: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  totalStatements: number;
  executedStatements: number;
  errorsCount: number;
  errors: ImportErrorItem[];
  durationMs: number;
}

export class DumpService {
  private firebirdService: FirebirdService;
  private isCancelled: boolean = false;

  constructor(firebirdService: FirebirdService) {
    this.firebirdService = firebirdService;
  }

  public cancel(): void {
    this.isCancelled = true;
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

  public async exportDatabase(
    options: DumpOptions,
    onProgress: (p: DumpProgress) => void
  ): Promise<{ success: boolean; filePath: string; totalStatements: number; durationMs: number }> {
    this.isCancelled = false;
    const startTime = Date.now();

    const db = (this.firebirdService as any).activeDb;
    if (!db) {
      throw new Error('No hay una base de datos activa para exportar.');
    }

    const queryAsync = (sql: string, params: any[] = []): Promise<any[]> => {
      return new Promise((resolve, reject) => {
        db.query(sql, params, (err: any, rows: any) => {
          if (err) return reject(err);
          resolve(Array.isArray(rows) ? rows : []);
        });
      });
    };

    const extractString = (row: any, ...keys: string[]): string => {
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
    };

    const extractNumber = (row: any, ...keys: string[]): number => {
      const str = extractString(row, ...keys);
      const num = Number(str);
      return isNaN(num) ? 0 : num;
    };

    // Ensure output directory exists
    const dir = path.dirname(options.outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const writeStream = fs.createWriteStream(options.outputPath, { encoding: 'utf-8' });
    const writeLine = (line: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!writeStream.write(line + '\n')) {
          writeStream.once('drain', resolve);
        } else {
          resolve();
        }
      });
    };

    let statementCount = 0;

    try {
      const currentConfig = this.firebirdService.getCurrentConfig();
      const dbName = currentConfig?.database || 'FIREBIRD_DATABASE';

      // 1. Header
      onProgress({
        stage: 'HEADER',
        percentage: 2,
        message: 'Iniciando generación de script SQL...'
      });

      await writeLine(`/*******************************************************************************`);
      await writeLine(` * FirebirdYog Database Dump / Backup`);
      await writeLine(` * Base de Datos: ${dbName}`);
      await writeLine(` * Fecha de Generación: ${new Date().toISOString()}`);
      await writeLine(` * Dialecto: 3`);
      await writeLine(` *******************************************************************************/`);
      await writeLine(``);
      await writeLine(`SET SQL DIALECT 3;`);
      await writeLine(`SET NAMES UTF8;`);
      await writeLine(``);

      // Get Schema Objects
      const schema = await this.firebirdService.getSchemaObjects();
      const allTables = schema.tables || [];
      const tablesToExport = options.selectedTables && options.selectedTables.length > 0
        ? allTables.filter(t => options.selectedTables.includes(t))
        : allTables;

      // 2. Generators / Sequences (Creation)
      if (options.includeGenerators && schema.generators && schema.generators.length > 0) {
        if (this.isCancelled) throw new Error('Operación cancelada por el usuario.');
        onProgress({
          stage: 'GENERATORS_DEF',
          percentage: 5,
          message: 'Generando definición de generadores / secuencias...'
        });

        await writeLine(`/* ========================================================== */`);
        await writeLine(`/* GENERADORES / SECUENCIAS                                   */`);
        await writeLine(`/* ========================================================== */`);
        for (const gen of schema.generators) {
          await writeLine(`CREATE SEQUENCE ${gen};`);
          statementCount++;
        }
        await writeLine(`COMMIT;`);
        await writeLine(``);
      }

      // 3. Domains
      if (options.includeStructure && schema.domains && schema.domains.length > 0) {
        if (this.isCancelled) throw new Error('Operación cancelada por el usuario.');
        onProgress({
          stage: 'DOMAINS',
          percentage: 10,
          message: 'Generando dominios personalizados...'
        });

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
        const domRows = await queryAsync(domainsQuery);
        if (domRows.length > 0) {
          await writeLine(`/* ========================================================== */`);
          await writeLine(`/* DOMINIOS PERSONALIZADOS                                    */`);
          await writeLine(`/* ========================================================== */`);

          for (const d of domRows) {
            const domName = extractString(d, 'DOMAIN_NAME');
            const typeStr = (this.firebirdService as any).resolveFieldType(
              extractNumber(d, 'FIELD_TYPE_CODE'),
              extractNumber(d, 'FIELD_SUB_TYPE'),
              extractNumber(d, 'FIELD_LENGTH'),
              extractNumber(d, 'FIELD_PRECISION'),
              extractNumber(d, 'FIELD_SCALE')
            );
            const defVal = extractString(d, 'DEFAULT_SOURCE');
            const isNotNull = extractNumber(d, 'NULL_FLAG') === 1;

            let domDdl = `CREATE DOMAIN ${domName} AS ${typeStr}`;
            if (defVal) domDdl += ` ${defVal}`;
            if (isNotNull) domDdl += ` NOT NULL`;
            domDdl += `;`;

            await writeLine(domDdl);
            statementCount++;
          }
          await writeLine(`COMMIT;`);
          await writeLine(``);
        }
      }

      // 4. Tables Structure (without Foreign Keys to avoid ordering constraints)
      if (options.includeStructure) {
        if (this.isCancelled) throw new Error('Operación cancelada por el usuario.');
        onProgress({
          stage: 'TABLES_DEF',
          percentage: 15,
          message: 'Generando estructura de tablas...'
        });

        await writeLine(`/* ========================================================== */`);
        await writeLine(`/* TABLAS Y CLAVES PRIMARIAS                                  */`);
        await writeLine(`/* ========================================================== */`);

        for (const tbl of tablesToExport) {
          if (this.isCancelled) throw new Error('Operación cancelada por el usuario.');
          const details = await this.firebirdService.getTableDetails(tbl);
          if (details && details.columns && details.columns.length > 0) {
            let tableDdl = `CREATE TABLE ${tbl} (\n`;
            const colDefs: string[] = [];

            for (const col of details.columns) {
              let colDef = `    ${col.columnName} ${col.fieldType}`;
              if (col.defaultValue) colDef += ` ${col.defaultValue}`;
              if (!col.isNullable) colDef += ` NOT NULL`;
              colDefs.push(colDef);
            }

            const pkCols = details.columns.filter((c: any) => c.isPrimaryKey).map((c: any) => c.columnName);
            if (pkCols.length > 0) {
              colDefs.push(`    CONSTRAINT PK_${tbl} PRIMARY KEY (${pkCols.join(', ')})`);
            }

            tableDdl += colDefs.join(',\n') + '\n);';
            await writeLine(tableDdl);
            statementCount++;
          }
        }
        await writeLine(`COMMIT;`);
        await writeLine(``);
      }

      // 5. Data Export (INSERT INTO statements)
      if (options.includeData && tablesToExport.length > 0) {
        const batchCommitSize = options.batchCommitSize || 500;
        await writeLine(`/* ========================================================== */`);
        await writeLine(`/* DATOS DE TABLAS                                            */`);
        await writeLine(`/* ========================================================== */`);

        const totalTbls = tablesToExport.length;
        for (let i = 0; i < totalTbls; i++) {
          if (this.isCancelled) throw new Error('Operación cancelada por el usuario.');
          const tbl = tablesToExport[i];

          // Count rows in table
          let totalRows = 0;
          try {
            const countRows = await queryAsync(`SELECT COUNT(*) AS CNT FROM ${tbl}`);
            totalRows = extractNumber(countRows[0], 'CNT');
          } catch {
            totalRows = 0;
          }

          onProgress({
            stage: 'DATA',
            currentTable: tbl,
            totalTables: totalTbls,
            currentTableIndex: i + 1,
            rowsExported: 0,
            totalRowsInTable: totalRows,
            percentage: 20 + Math.round((i / totalTbls) * 55),
            message: `Exportando datos de tabla ${tbl} (${i + 1}/${totalTbls})...`
          });

          await writeLine(`/* Datos para ${tbl} (${totalRows} registros) */`);

          // Fetch all table column names in order
          const colQuery = `
            SELECT TRIM(RF.RDB$FIELD_NAME) AS COL_NAME
            FROM RDB$RELATION_FIELDS RF
            WHERE TRIM(RF.RDB$RELATION_NAME) = ?
            ORDER BY RF.RDB$FIELD_POSITION
          `;
          const colRows = await queryAsync(colQuery, [tbl]);
          const colNames = colRows.map(r => extractString(r, 'COL_NAME')).filter(Boolean);

          if (colNames.length > 0) {
            const chunkSize = 1000;
            let offset = 0;
            let exportedCount = 0;

            while (true) {
              if (this.isCancelled) throw new Error('Operación cancelada por el usuario.');
              
              const rowsChunk = await queryAsync(`SELECT * FROM ${tbl} ROWS ${offset + 1} TO ${offset + chunkSize}`);
              if (rowsChunk.length === 0) break;

              for (const row of rowsChunk) {
                const values = colNames.map(col => {
                  let val = undefined;
                  for (const k of Object.keys(row)) {
                    if (k.toUpperCase() === col.toUpperCase()) {
                      val = row[k];
                      break;
                    }
                  }
                  return this.formatSqlValue(val);
                });

                await writeLine(`INSERT INTO ${tbl} (${colNames.join(', ')}) VALUES (${values.join(', ')});`);
                exportedCount++;
                statementCount++;

                if (exportedCount % batchCommitSize === 0) {
                  await writeLine(`COMMIT;`);
                }
              }

              offset += rowsChunk.length;
              onProgress({
                stage: 'DATA',
                currentTable: tbl,
                totalTables: totalTbls,
                currentTableIndex: i + 1,
                rowsExported: exportedCount,
                totalRowsInTable: totalRows,
                percentage: 20 + Math.round(((i + (exportedCount / Math.max(1, totalRows))) / totalTbls) * 55),
                message: `Exportando ${tbl}: ${exportedCount} / ${totalRows} registros...`
              });

              if (rowsChunk.length < chunkSize) break;
            }

            await writeLine(`COMMIT;`);
            await writeLine(``);
          }
        }
      }

      // 6. Generators Synchronize Values (SET GENERATOR)
      if (options.includeGenerators && schema.generators && schema.generators.length > 0) {
        if (this.isCancelled) throw new Error('Operación cancelada por el usuario.');
        onProgress({
          stage: 'GENERATORS_VAL',
          percentage: 80,
          message: 'Sincronizando valores actuales de generadores / secuencias...'
        });

        await writeLine(`/* ========================================================== */`);
        await writeLine(`/* VALORES ACTUALES DE GENERADORES                            */`);
        await writeLine(`/* ========================================================== */`);

        for (const gen of schema.generators) {
          try {
            const genRows = await queryAsync(`SELECT GEN_ID(${gen}, 0) AS VAL FROM RDB$DATABASE`);
            const currentVal = extractNumber(genRows[0], 'VAL');
            await writeLine(`SET GENERATOR ${gen} TO ${currentVal};`);
            statementCount++;
          } catch (err) {
            console.error(`Error obteniendo valor de generador ${gen}:`, err);
          }
        }
        await writeLine(`COMMIT;`);
        await writeLine(``);
      }

      // 7. Foreign Keys (added after all tables and data are inserted)
      if (options.includeForeignKeys && options.includeStructure) {
        if (this.isCancelled) throw new Error('Operación cancelada por el usuario.');
        onProgress({
          stage: 'FOREIGN_KEYS',
          percentage: 85,
          message: 'Generando restricciones de clave foránea (Foreign Keys)...'
        });

        const fkQuery = `
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

        const fkRows = await queryAsync(fkQuery);
        if (fkRows.length > 0) {
          await writeLine(`/* ========================================================== */`);
          await writeLine(`/* CLAVES FORÁNEAS (FOREIGN KEYS)                             */`);
          await writeLine(`/* ========================================================== */`);

          interface FkGroup {
            name: string;
            table: string;
            fields: string[];
            refTable: string;
            refFields: string[];
            updateRule: string;
            deleteRule: string;
          }

          const fkMap = new Map<string, FkGroup>();
          for (const row of fkRows) {
            const cName = extractString(row, 'CONSTRAINT_NAME');
            const tbl = extractString(row, 'TABLE_NAME');
            const refTbl = extractString(row, 'REF_TABLE_NAME');

            // Skip FK if tables were excluded
            if (options.selectedTables.length > 0 && (!tablesToExport.includes(tbl) || !tablesToExport.includes(refTbl))) {
              continue;
            }

            if (!fkMap.has(cName)) {
              fkMap.set(cName, {
                name: cName,
                table: tbl,
                fields: [],
                refTable: refTbl,
                refFields: [],
                updateRule: extractString(row, 'UPDATE_RULE') || 'RESTRICT',
                deleteRule: extractString(row, 'DELETE_RULE') || 'RESTRICT'
              });
            }

            fkMap.get(cName)!.fields.push(extractString(row, 'FIELD_NAME'));
            fkMap.get(cName)!.refFields.push(extractString(row, 'REF_FIELD_NAME'));
          }

          for (const fk of fkMap.values()) {
            let fkDdl = `ALTER TABLE ${fk.table} ADD CONSTRAINT ${fk.name} FOREIGN KEY (${fk.fields.join(', ')}) REFERENCES ${fk.refTable} (${fk.refFields.join(', ')})`;
            if (fk.updateRule && fk.updateRule !== 'RESTRICT') fkDdl += ` ON UPDATE ${fk.updateRule}`;
            if (fk.deleteRule && fk.deleteRule !== 'RESTRICT') fkDdl += ` ON DELETE ${fk.deleteRule}`;
            fkDdl += `;`;

            await writeLine(fkDdl);
            statementCount++;
          }

          await writeLine(`COMMIT;`);
          await writeLine(``);
        }
      }

      // 8. Views
      if (options.includeViews && schema.views && schema.views.length > 0) {
        if (this.isCancelled) throw new Error('Operación cancelada por el usuario.');
        onProgress({
          stage: 'VIEWS',
          percentage: 90,
          message: 'Generando Vistas...'
        });

        await writeLine(`/* ========================================================== */`);
        await writeLine(`/* VISTAS                                                     */`);
        await writeLine(`/* ========================================================== */`);

        for (const v of schema.views) {
          try {
            const ddlRes = await this.firebirdService.getObjectDdl('VIEW', v);
            if (ddlRes && ddlRes.ddl) {
              await writeLine(ddlRes.ddl.trim());
              await writeLine(``);
              statementCount++;
            }
          } catch (err) {
            console.error(`Error generando DDL para vista ${v}:`, err);
          }
        }
        await writeLine(`COMMIT;`);
        await writeLine(``);
      }

      // 9. Stored Procedures
      if (options.includeProcedures && schema.procedures && schema.procedures.length > 0) {
        if (this.isCancelled) throw new Error('Operación cancelada por el usuario.');
        onProgress({
          stage: 'PROCEDURES',
          percentage: 93,
          message: 'Generando Procedimientos Almacenados...'
        });

        await writeLine(`/* ========================================================== */`);
        await writeLine(`/* PROCEDIMIENTOS ALMACENADOS                                 */`);
        await writeLine(`/* ========================================================== */`);

        for (const p of schema.procedures) {
          try {
            const ddlRes = await this.firebirdService.getObjectDdl('PROCEDURE', p.name);
            if (ddlRes && ddlRes.ddl) {
              await writeLine(ddlRes.ddl.trim() + ';');
              await writeLine(``);
              statementCount++;
            }
          } catch (err) {
            console.error(`Error generando DDL para procedimiento ${p.name}:`, err);
          }
        }
        await writeLine(`COMMIT;`);
        await writeLine(``);
      }

      // 10. Triggers
      if (options.includeTriggers && schema.triggers && schema.triggers.length > 0) {
        if (this.isCancelled) throw new Error('Operación cancelada por el usuario.');
        onProgress({
          stage: 'TRIGGERS',
          percentage: 96,
          message: 'Generando Triggers...'
        });

        await writeLine(`/* ========================================================== */`);
        await writeLine(`/* TRIGGERS                                                   */`);
        await writeLine(`/* ========================================================== */`);

        for (const t of schema.triggers) {
          try {
            const ddlRes = await this.firebirdService.getObjectDdl('TRIGGER', t.name);
            if (ddlRes && ddlRes.ddl) {
              await writeLine(ddlRes.ddl.trim() + ';');
              await writeLine(``);
              statementCount++;
            }
          } catch (err) {
            console.error(`Error generando DDL para trigger ${t.name}:`, err);
          }
        }
        await writeLine(`COMMIT;`);
        await writeLine(``);
      }

      // 11. Footer
      await writeLine(`/* Fin del dump de FirebirdYog */`);
      await writeLine(`COMMIT;`);

      onProgress({
        stage: 'DONE',
        percentage: 100,
        message: `¡Exportación completada exitosamente! (${statementCount} sentencias generadas)`
      });

      return {
        success: true,
        filePath: options.outputPath,
        totalStatements: statementCount,
        durationMs: Date.now() - startTime
      };
    } finally {
      writeStream.end();
    }
  }

  public async importDatabase(
    options: ImportOptions,
    onProgress: (p: ImportProgress) => void
  ): Promise<ImportResult> {
    this.isCancelled = false;
    const startTime = Date.now();

    const stat = fs.statSync(options.filePath);
    const totalBytes = stat.size;
    let bytesProcessed = 0;

    const fileStream = fs.createReadStream(options.filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentStatement = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBlockComment = false;
    let beginDepth = 0;
    let currentDelimiter = ';';

    let totalStatements = 0;
    let executedStatements = 0;
    let errorsCount = 0;
    const errors: ImportErrorItem[] = [];
    let lineNumber = 0;
    let lastProgressTime = 0;

    try {
      for await (const line of rl) {
        if (this.isCancelled) {
          fileStream.destroy();
          throw new Error('Importación cancelada por el usuario.');
        }

        lineNumber++;
        bytesProcessed += Buffer.byteLength(line, 'utf-8') + 1;

        const trimmedLine = line.trim();

        // Check SET TERM directives (e.g. SET TERM ^ ;)
        const setTermMatch = trimmedLine.match(/^SET\s+TERM\s+(\S+)/i);
        if (setTermMatch && !inSingleQuote && !inDoubleQuote && !inBlockComment) {
          currentDelimiter = setTermMatch[1];
          continue;
        }

        // Ignore client commands like SET NAMES, SET SQL DIALECT
        if (/^SET\s+(NAMES|SQL\s+DIALECT)/i.test(trimmedLine) && !inSingleQuote && !inDoubleQuote && !inBlockComment) {
          continue;
        }

        let i = 0;
        while (i < line.length) {
          const char = line[i];
          const nextChar = line[i + 1] || '';

          // Block comment
          if (!inSingleQuote && !inDoubleQuote && char === '/' && nextChar === '*') {
            inBlockComment = true;
            i += 2;
            continue;
          }
          if (inBlockComment) {
            if (char === '*' && nextChar === '/') {
              inBlockComment = false;
              i += 2;
              continue;
            }
            i++;
            continue;
          }

          // Line comment (-- ...)
          if (!inSingleQuote && !inDoubleQuote && char === '-' && nextChar === '-') {
            break;
          }

          // Single quotes
          if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
            currentStatement += char;
            i++;
            continue;
          }

          // Double quotes (identifiers)
          if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
            currentStatement += char;
            i++;
            continue;
          }

          if (!inSingleQuote && !inDoubleQuote) {
            const remaining = line.slice(i).toUpperCase();
            if (/^\bBEGIN\b/.test(remaining)) {
              beginDepth++;
            } else if (/^\bEND\b/.test(remaining)) {
              if (beginDepth > 0) beginDepth--;
            }

            // Check if current delimiter is matched
            if (line.startsWith(currentDelimiter, i) && (beginDepth === 0 || currentDelimiter !== ';')) {
              const stmtToRun = currentStatement.trim();
              currentStatement = '';
              i += currentDelimiter.length;

              if (stmtToRun) {
                totalStatements++;
                try {
                  await this.firebirdService.executeQuery(stmtToRun);
                  executedStatements++;
                } catch (err: any) {
                  errorsCount++;
                  const errMsg = err.message || String(err);
                  errors.push({
                    statementIndex: totalStatements,
                    statementSnippet: stmtToRun.length > 100 ? stmtToRun.slice(0, 100) + '...' : stmtToRun,
                    error: errMsg,
                    lineNumber
                  });

                  if (options.stopOnError) {
                    fileStream.destroy();
                    throw new Error(`Error en línea ${lineNumber}: ${errMsg}\n\nSentencia:\n${stmtToRun}`);
                  }
                }

                // Throttle progress updates to at most once per 60ms
                const now = Date.now();
                if (now - lastProgressTime > 60 || bytesProcessed >= totalBytes) {
                  lastProgressTime = now;
                  const pct = Math.min(99, Math.round((bytesProcessed / Math.max(1, totalBytes)) * 100));
                  onProgress({
                    bytesProcessed,
                    totalBytes,
                    percentage: pct,
                    statementsExecuted: executedStatements,
                    errorsCount,
                    currentStatementSnippet: stmtToRun.slice(0, 80),
                    message: `Importando... (${executedStatements} sentencias ejecutadas${errorsCount > 0 ? `, ${errorsCount} errores` : ''})`
                  });
                }
              }
              continue;
            }
          }

          currentStatement += char;
          i++;
        }

        currentStatement += '\n';
      }

      // If there is any trailing statement
      if (currentStatement.trim()) {
        const stmtToRun = currentStatement.trim();
        totalStatements++;
        try {
          await this.firebirdService.executeQuery(stmtToRun);
          executedStatements++;
        } catch (err: any) {
          errorsCount++;
          errors.push({
            statementIndex: totalStatements,
            statementSnippet: stmtToRun.slice(0, 100),
            error: err.message || String(err),
            lineNumber
          });
          if (options.stopOnError) {
            throw err;
          }
        }
      }

      onProgress({
        bytesProcessed: totalBytes,
        totalBytes,
        percentage: 100,
        statementsExecuted: executedStatements,
        errorsCount,
        currentStatementSnippet: '',
        message: `¡Importación completada! (${executedStatements} sentencias ejecutadas${errorsCount > 0 ? `, ${errorsCount} errores` : ''})`
      });

      return {
        success: errorsCount === 0 || !options.stopOnError,
        totalStatements,
        executedStatements,
        errorsCount,
        errors,
        durationMs: Date.now() - startTime
      };
    } finally {
      fileStream.destroy();
    }
  }
}
