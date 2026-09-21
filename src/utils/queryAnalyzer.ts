/**
 * Query Analyzer utility to determine if a SQL query result is safely editable in-grid.
 */

export interface QueryCandidate {
  isCandidate: boolean;
  tableName: string | null;
  reason?: string;
}

export interface QueryUpdatability {
  isUpdatable: boolean;
  tableName: string | null;
  primaryKeyColumns: string[];
  readOnlyReason?: string;
}

/**
 * Parses a SQL statement to determine if it is a single-table SELECT eligible for in-grid editing.
 */
export function analyzeQueryCandidate(sql: string): QueryCandidate {
  if (!sql || !sql.trim()) {
    return { isCandidate: false, tableName: null, reason: 'Consulta vacía' };
  }

  // 1. Strip block comments /* ... */
  let sanitized = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // 2. Strip line comments -- ...
  sanitized = sanitized.replace(/--.*$/gm, ' ');
  // 3. Replace single-quoted string literals with empty strings so keywords inside literals aren't falsely detected
  sanitized = sanitized.replace(/'(?:''|[^'])*'/g, "''");
  // Trim and collapse whitespace
  sanitized = sanitized.trim();

  // Explicit check for EXECUTE PROCEDURE
  if (/^\s*EXECUTE\s+PROCEDURE\b/i.test(sanitized)) {
    const match = sanitized.match(/^\s*EXECUTE\s+PROCEDURE\s+([a-zA-Z0-9_$#"]+)/i);
    const procName = match ? match[1].replace(/^"|"$/g, '').trim().toUpperCase() : '';
    return {
      isCandidate: false,
      tableName: procName || null,
      reason: procName
        ? `"${procName}" es un procedimiento almacenado (los procedimientos son de solo lectura)`
        : 'Los procedimientos almacenados son de solo lectura'
    };
  }

  // 4. Must start with SELECT (not INSERT, UPDATE, DELETE, EXECUTE, WITH, SHOW, etc.)
  if (!/^\s*SELECT\b/i.test(sanitized)) {
    return { isCandidate: false, tableName: null, reason: 'Solo consultas SELECT son editables' };
  }

  // 5. Check for complex SQL constructs that prevent safe 1:1 row updates
  if (/\b(?:INNER|LEFT|RIGHT|FULL|CROSS|NATURAL)?\s*JOIN\b/i.test(sanitized)) {
    return { isCandidate: false, tableName: null, reason: 'Consultas con JOIN no son editables directamente' };
  }
  if (/\bGROUP\s+BY\b/i.test(sanitized)) {
    return { isCandidate: false, tableName: null, reason: 'Consultas con agregaciones (GROUP BY) no son editables' };
  }
  if (/\bHAVING\b/i.test(sanitized)) {
    return { isCandidate: false, tableName: null, reason: 'Consultas con HAVING no son editables' };
  }
  if (/\bUNION\b/i.test(sanitized)) {
    return { isCandidate: false, tableName: null, reason: 'Consultas con UNION no son editables' };
  }
  if (/^\s*SELECT\s+DISTINCT\b/i.test(sanitized)) {
    return { isCandidate: false, tableName: null, reason: 'Consultas con DISTINCT no son editables' };
  }

  // 6. Extract the FROM clause
  const fromIndex = sanitized.search(/\bFROM\b/i);
  if (fromIndex === -1) {
    return { isCandidate: false, tableName: null, reason: 'No se encontró la cláusula FROM' };
  }

  const afterFrom = sanitized.slice(fromIndex + 4).trim();
  const delimiterMatch = afterFrom.search(/\b(?:WHERE|ORDER\s+BY|ROWS|PLAN|FOR\s+UPDATE)\b|[;]/i);
  const fromClause = (delimiterMatch !== -1 ? afterFrom.slice(0, delimiterMatch) : afterFrom).trim();

  if (!fromClause) {
    return { isCandidate: false, tableName: null, reason: 'Cláusula FROM vacía' };
  }

  // Check if FROM is a procedure call with arguments: FROM SP_NAME(...)
  const procCallMatch = fromClause.match(/^([a-zA-Z0-9_$#"]+)\s*\(/);
  if (procCallMatch) {
    const procName = procCallMatch[1].replace(/^"|"$/g, '').trim().toUpperCase();
    return {
      isCandidate: false,
      tableName: procName,
      reason: `"${procName}" es un procedimiento almacenado (los procedimientos son de solo lectura)`
    };
  }

  if (fromClause.includes(',') || fromClause.includes('(')) {
    return { isCandidate: false, tableName: null, reason: 'Consultas con múltiples tablas o subconsultas en FROM no son editables' };
  }

  const tokens = fromClause.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { isCandidate: false, tableName: null, reason: 'Tabla no especificada' };
  }

  // Allow: TABLE, TABLE ALIAS, TABLE AS ALIAS
  if (tokens.length > 3 || (tokens.length === 3 && tokens[1].toUpperCase() !== 'AS')) {
    return { isCandidate: false, tableName: null, reason: 'Cláusula FROM no reconocida' };
  }

  const rawTableName = tokens[0].replace(/^"|"$/g, '').trim();
  if (!rawTableName) {
    return { isCandidate: false, tableName: null, reason: 'Nombre de tabla no reconocido' };
  }

  return {
    isCandidate: true,
    tableName: rawTableName.toUpperCase()
  };
}

/**
 * Asynchronously checks whether the query result can be safely edited directly on the grid.
 */
export async function checkQueryUpdatability(
  sql: string,
  resultColumns: string[],
  schemaObjects?: { tables?: string[]; views?: string[]; procedures?: Array<{ name: string } | string> } | null
): Promise<QueryUpdatability> {
  const candidate = analyzeQueryCandidate(sql);
  if (!candidate.isCandidate || !candidate.tableName) {
    return {
      isUpdatable: false,
      tableName: null,
      primaryKeyColumns: [],
      readOnlyReason: candidate.reason
    };
  }

  const tableName = candidate.tableName;

  // Check if it is a view
  if (schemaObjects?.views?.some(v => v.toUpperCase() === tableName)) {
    return {
      isUpdatable: false,
      tableName,
      primaryKeyColumns: [],
      readOnlyReason: `"${tableName}" es una vista (las vistas son de solo lectura)`
    };
  }

  // Check if it is a stored procedure
  if (schemaObjects?.procedures?.some((p: any) => {
    const name = typeof p === 'string' ? p : p.name;
    return name?.toUpperCase() === tableName;
  })) {
    return {
      isUpdatable: false,
      tableName,
      primaryKeyColumns: [],
      readOnlyReason: `"${tableName}" es un procedimiento almacenado (los procedimientos son de solo lectura)`
    };
  }

  try {
    if (!window.electronAPI?.getTableDetails) {
      return {
        isUpdatable: false,
        tableName,
        primaryKeyColumns: [],
        readOnlyReason: 'Servicio de base de datos no disponible'
      };
    }

    const res = await window.electronAPI.getTableDetails(tableName);
    if (!res.success || !res.data) {
      return {
        isUpdatable: false,
        tableName,
        primaryKeyColumns: [],
        readOnlyReason: `No se pudieron cargar los metadatos de la tabla "${tableName}"`
      };
    }

    const details = res.data;
    const pkColumns = details.columns
      .filter((c: any) => c.isPrimaryKey)
      .map((c: any) => c.columnName.toUpperCase());

    if (pkColumns.length === 0) {
      return {
        isUpdatable: false,
        tableName,
        primaryKeyColumns: [],
        readOnlyReason: `La tabla "${tableName}" no tiene clave primaria (Primary Key)`
      };
    }

    // Check if all PK columns are present in resultColumns
    const resultColsUpper = resultColumns.map(c => c.toUpperCase());
    const missingPks = pkColumns.filter(pk => !resultColsUpper.includes(pk));

    if (missingPks.length > 0) {
      return {
        isUpdatable: false,
        tableName,
        primaryKeyColumns: pkColumns,
        readOnlyReason: `Falta incluir en el SELECT la(s) clave(s) primaria(s): ${missingPks.join(', ')}`
      };
    }

    return {
      isUpdatable: true,
      tableName,
      primaryKeyColumns: pkColumns
    };
  } catch (err: any) {
    return {
      isUpdatable: false,
      tableName,
      primaryKeyColumns: [],
      readOnlyReason: err.message || 'Error al validar la tabla'
    };
  }
}
