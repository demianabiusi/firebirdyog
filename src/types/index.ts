export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  role?: string;
  charset: string;
  dialect?: number;
  pageSize?: number;
  createdAt?: string;
}

export type DbObjectType = 
  | 'TABLE' 
  | 'VIEW' 
  | 'PROCEDURE' 
  | 'TRIGGER' 
  | 'GENERATOR' 
  | 'DOMAIN' 
  | 'EXCEPTION';

export interface DbObjectItem {
  name: string;
  type: DbObjectType;
  extraInfo?: string;
  parentTable?: string;
}

export interface ColumnInfo {
  columnName: string;
  position: number;
  domainName: string;
  fieldType: string;
  length?: number;
  precision?: number;
  scale?: number;
  isNullable: boolean;
  defaultValue?: string | null;
  isPrimaryKey: boolean;
}

export interface TableDetails {
  tableName: string;
  columns: ColumnInfo[];
  triggers: { name: string; type: string; inactive: boolean }[];
  indices: { name: string; unique: boolean; fields: string[] }[];
  ddl?: string;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  affectedRows?: number;
  executionTimeMs: number;
  sql: string;
  hasMore?: boolean;
}

export interface QueryTab {
  id: string;
  title: string;
  sql: string;
  result: QueryResult | null;
  isRunning: boolean;
  error: string | null;
  activeResultTab: 'grid' | 'messages' | 'ddl' | 'history';
}

export interface QueryHistoryItem {
  id: string;
  sql: string;
  timestamp: string;
  durationMs: number;
  status: 'success' | 'error';
  rowCount?: number;
  error?: string;
}

export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Window Electron API interface
export interface ElectronAPI {
  // Connection management
  getSavedConnections: () => Promise<ConnectionConfig[]>;
  saveConnection: (config: ConnectionConfig) => Promise<ConnectionConfig>;
  deleteConnection: (id: string) => Promise<boolean>;
  testConnection: (config: ConnectionConfig) => Promise<IpcResponse<{ message: string; pingMs: number }>>;
  connect: (config: ConnectionConfig) => Promise<IpcResponse<{ database: string }>>;
  disconnect: () => Promise<IpcResponse<boolean>>;
  getConnectionStatus: () => Promise<{ isConnected: boolean; config: ConnectionConfig | null }>;
  
  // Metadata
  getSchemaObjects: () => Promise<IpcResponse<{
    tables: string[];
    views: string[];
    procedures: { name: string; inputs: number; outputs: number; inputParams?: string[] }[];
    triggers: { name: string; table: string; inactive: boolean }[];
    generators: string[];
    domains: string[];
    exceptions: string[];
  }>>;
  getTableDetails: (tableName: string) => Promise<IpcResponse<TableDetails>>;
  getObjectDdl: (type: string, name: string) => Promise<IpcResponse<{ ddl: string; name: string; type: string }>>;
  
  // Query execution
  executeQuery: (sql: string, maxRows?: number) => Promise<IpcResponse<QueryResult>>;
  executeScript: (script: string) => Promise<IpcResponse<{ statementsExecuted: number; results: QueryResult[] }>>;
  
  // File dialogs & utilities
  selectDatabaseFile: () => Promise<string | null>;
  selectNewDatabaseFile: (defaultFilename?: string) => Promise<string | null>;
  createDatabase: (config: ConnectionConfig) => Promise<IpcResponse<{ database: string }>>;
  saveSqlFile: (content: string, defaultPath?: string) => Promise<boolean>;
  openSqlFile: () => Promise<{ content: string; filePath: string } | null>;
  exportData: (data: string, defaultFilename: string, type: 'csv' | 'json' | 'sql') => Promise<boolean>;

  // Database Dump / Export
  selectDumpFile: (defaultFilename?: string) => Promise<string | null>;
  startDump: (options: DumpOptions) => Promise<IpcResponse<{ filePath: string; totalStatements: number; durationMs: number }>>;
  cancelDump: () => Promise<{ success: boolean }>;
  showItemInFolder: (path: string) => Promise<boolean>;
  onDumpProgress: (callback: (progress: DumpProgress) => void) => () => void;

  // Database Import / Streaming Dump Loader
  selectImportFile: () => Promise<{ filePath: string; size: number; name: string } | null>;
  startImport: (options: ImportOptions) => Promise<IpcResponse<ImportResult>>;
  cancelImport: () => Promise<{ success: boolean }>;
  onImportProgress: (callback: (progress: ImportProgress) => void) => () => void;
}

export interface DumpOptions {
  outputPath: string;
  includeStructure: boolean;
  includeData: boolean;
  includeGenerators: boolean;
  includeViews: boolean;
  includeProcedures: boolean;
  includeTriggers: boolean;
  includeForeignKeys: boolean;
  selectedTables: string[];
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

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
