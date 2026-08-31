import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getSavedConnections: () => ipcRenderer.invoke('fb:get-saved-connections'),
  saveConnection: (config: any) => ipcRenderer.invoke('fb:save-connection', config),
  deleteConnection: (id: string) => ipcRenderer.invoke('fb:delete-connection', id),
  testConnection: (config: any) => ipcRenderer.invoke('fb:test-connection', config),
  connect: (config: any) => ipcRenderer.invoke('fb:connect', config),
  disconnect: () => ipcRenderer.invoke('fb:disconnect'),
  getConnectionStatus: () => ipcRenderer.invoke('fb:get-status'),
  
  getSchemaObjects: () => ipcRenderer.invoke('fb:get-schema-objects'),
  getTableDetails: (tableName: string) => ipcRenderer.invoke('fb:get-table-details', tableName),
  getObjectDdl: (type: string, name: string) => ipcRenderer.invoke('fb:get-object-ddl', type, name),
  
  executeQuery: (sql: string, maxRows?: number) => ipcRenderer.invoke('fb:execute-query', sql, maxRows),
  executeScript: (script: string) => ipcRenderer.invoke('fb:execute-script', script),
  
  selectDatabaseFile: () => ipcRenderer.invoke('dialog:select-database-file'),
  saveSqlFile: (content: string, defaultPath?: string) => ipcRenderer.invoke('dialog:save-sql-file', content, defaultPath),
  openSqlFile: () => ipcRenderer.invoke('dialog:open-sql-file'),
  exportData: (data: string, defaultFilename: string, type: 'csv' | 'json' | 'sql') => 
    ipcRenderer.invoke('dialog:export-data', data, defaultFilename, type)
});
