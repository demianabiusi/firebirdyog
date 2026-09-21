export interface SshTunnelConfig {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  authType: 'password' | 'privateKey';
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
}

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
  ssh?: SshTunnelConfig;
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

export interface ObjectDependencyItem {
  objectName: string;
  objectType: string;
  fieldName?: string | null;
  fields?: string[];
  detail?: string;
}

export interface ObjectDependenciesResult {
  objectName: string;
  objectType: string;
  dependsOn: ObjectDependencyItem[];
  dependedOnBy: ObjectDependencyItem[];
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

export interface TableRowUpdate {
  primaryKeyValues: Record<string, any>;
  updatedValues: Record<string, any>;
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
export interface AppSettings {
  lastActiveConnectionId?: string | null;
  autoConnectOnStartup?: boolean;
}

export interface ElectronAPI {
  // Connection management
  getSavedConnections: () => Promise<ConnectionConfig[]>;
  saveConnection: (config: ConnectionConfig) => Promise<ConnectionConfig>;
  deleteConnection: (id: string) => Promise<boolean>;
  testConnection: (config: ConnectionConfig) => Promise<IpcResponse<{ message: string; pingMs: number }>>;
  testSshConnection: (sshConfig: SshTunnelConfig) => Promise<IpcResponse<{ message: string; pingMs: number }>>;
  selectSshKeyFile: () => Promise<string | null>;
  connect: (config: ConnectionConfig) => Promise<IpcResponse<{ database: string }>>;
  disconnect: () => Promise<IpcResponse<boolean>>;
  getConnectionStatus: () => Promise<{ isConnected: boolean; config: ConnectionConfig | null }>;
  
  // App settings & persistence
  getAppSettings: () => Promise<AppSettings>;
  saveAppSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  
  // Metadata
  getSchemaObjects: () => Promise<IpcResponse<{
    tables: string[];
    views: string[];
    procedures: { name: string; inputs: number; outputs: number; inputParams?: string[] }[];
    triggers: { name: string; table: string; inactive: boolean }[];
    generators: string[];
    domains: string[];
    exceptions: string[];
    columnsByTable?: Record<string, string[]>;
  }>>;
  getTableDetails: (tableName: string) => Promise<IpcResponse<TableDetails>>;
  getObjectDdl: (type: string, name: string) => Promise<IpcResponse<{ ddl: string; name: string; type: string }>>;
  getObjectDependencies: (objectName: string, objectType?: string) => Promise<IpcResponse<ObjectDependenciesResult>>;
  
  // Query execution & data modification
  executeQuery: (sql: string, maxRows?: number) => Promise<IpcResponse<QueryResult>>;
  executeScript: (script: string) => Promise<IpcResponse<{ statementsExecuted: number; results: QueryResult[] }>>;
  updateTableRows: (tableName: string, updates: TableRowUpdate[]) => Promise<IpcResponse<{ affectedRows: number }>>;
  
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

  // Database Compare & Synchronization
  startCompare: (options: CompareOptions) => Promise<IpcResponse<CompareResult>>;
  cancelCompare: () => Promise<{ success: boolean }>;
  generateMigrationScript: (selectedItems: CompareDiffItem[], sourceName: string, targetName: string) => Promise<IpcResponse<string>>;
  executeMigration: (targetConfig: ConnectionConfig, script: string) => Promise<IpcResponse<MigrationExecutionResult>>;
  onCompareProgress: (callback: (progress: CompareProgress) => void) => () => void;
  onMigrationProgress: (callback: (progress: { executed: number; total: number }) => void) => () => void;
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
  sourceConfig: ConnectionConfig;
  targetConfig: ConnectionConfig;
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
