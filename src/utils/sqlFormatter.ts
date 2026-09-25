import { formatDialect, postgresql } from 'sql-formatter';

/**
 * Customized Firebird SQL dialect for sql-formatter.
 * Adds support for Firebird parameters (:var), $ characters in identifiers (RDB$...),
 * Firebird clauses (FIRST, SKIP, ROWS, STARTING WITH, CONTAINING, etc.),
 * and stored procedure blocks (EXECUTE BLOCK, SUSPEND, etc.).
 */
export const firebirdDialect = {
  ...postgresql,
  tokenizerOptions: {
    ...postgresql.tokenizerOptions,
    identChars: { first: '$', rest: '$' },
    paramTypes: { positional: true, named: [':', '?'] },
    reservedKeywords: [
      ...postgresql.tokenizerOptions.reservedKeywords,
      'FIRST',
      'SKIP',
      'ROWS',
      'TO',
      'CONTAINING',
      'STARTING',
      'GEN_ID',
      'PLAN',
      'SUSPEND',
      'EXECUTE',
      'BLOCK',
      'PROCEDURE',
      'TRIGGER',
      'GENERATOR',
      'SEQUENCE',
      'DOMAIN',
      'EXCEPTION',
      'RECREATE',
      'RETURNING',
      'AUTONOMOUS',
      'TRANSACTION',
      'LEAVE',
      'BREAK',
      'RDB$DATABASE',
    ],
    reservedKeywordPhrases: [
      ...postgresql.tokenizerOptions.reservedKeywordPhrases,
      'STARTING WITH',
      'NEXT VALUE FOR',
      'EXECUTE BLOCK',
      'EXECUTE PROCEDURE',
      'FOR UPDATE',
      'PRIMARY KEY',
      'FOREIGN KEY',
    ],
    reservedFunctionNames: [
      ...postgresql.tokenizerOptions.reservedFunctionNames,
      'GEN_ID',
      'IIF',
      'LIST',
      'DATEADD',
      'DATEDIFF',
      'COALESCE',
      'NULLIF',
    ],
  },
};

/**
 * Fallback keyword capitalization for scenarios where SQL contains syntax
 * that the strict parser cannot parse (e.g. while actively drafting invalid syntax).
 */
function fallbackFormat(sql: string): string {
  return sql.replace(
    /\b(select|from|where|and|or|order\s+by|group\s+by|insert\s+into|values|update|set|delete|left\s+join|inner\s+join|right\s+join|full\s+join|cross\s+join|join|having|rows|to|first|skip|containing|starting\s+with|create\s+table|drop\s+table|alter\s+table|begin|end|execute\s+block|execute\s+procedure|suspend|returning|as|distinct|case|when|then|else|union\s+all|union|not|null|is|in|exists|between|like)\b/gi,
    (match) => match.toUpperCase()
  );
}

export interface FormatSqlOptions {
  tabWidth?: number;
  useTabs?: boolean;
  keywordCase?: 'upper' | 'lower' | 'preserve';
  linesBetweenQueries?: number;
}

/**
 * Formats a SQL query string using the Firebird dialect.
 * Preserves comments, variables, and Firebird-specific constructs.
 */
export function formatSql(sql: string, options?: FormatSqlOptions): string {
  if (!sql || !sql.trim()) return sql;

  try {
    return formatDialect(sql, {
      dialect: firebirdDialect,
      keywordCase: options?.keywordCase || 'upper',
      dataTypeCase: 'upper',
      functionCase: 'upper',
      tabWidth: options?.tabWidth ?? 2,
      useTabs: options?.useTabs ?? false,
      linesBetweenQueries: options?.linesBetweenQueries ?? 1,
    });
  } catch (err) {
    console.warn('SQL format parser notice (using fallback uppercase):', err);
    return fallbackFormat(sql);
  }
}
