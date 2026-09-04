import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getSavedConnections: () => ipcRenderer.invoke('fb:get-saved-connections'),
  saveConnection: (config: any) => ipcRenderer.invoke('fb:save-connection', config),
  deleteConnection: (id: string) => ipcRenderer.invoke('fb:delete-connection', id),
  testConnection: (config: any) => ipcRenderer.invoke('fb:test-connection', config),
  connect: (config: any) => ipcRenderer.invoke('fb:connect', config),
  disconnect: () => ipcRenderer.invoke('fb:disconnect'),
  getConnectionStatus: () => ipcRenderer.invoke('fb:get-status'),
  
  getAppSettings: () => ipcRenderer.invoke('app:get-settings'),
  saveAppSettings: (patch: any) => ipcRenderer.invoke('app:save-settings', patch),
  
  getSchemaObjects: () => ipcRenderer.invoke('fb:get-schema-objects'),
  getTableDetails: (tableName: string) => ipcRenderer.invoke('fb:get-table-details', tableName),
  getObjectDdl: (type: string, name: string) => ipcRenderer.invoke('fb:get-object-ddl', type, name),
  
  executeQuery: (sql: string, maxRows?: number) => ipcRenderer.invoke('fb:execute-query', sql, maxRows),
  executeScript: (script: string) => ipcRenderer.invoke('fb:execute-script', script),
  
  selectDatabaseFile: () => ipcRenderer.invoke('dialog:select-database-file'),
  selectNewDatabaseFile: (defaultFilename?: string) => ipcRenderer.invoke('dialog:select-new-database-file', defaultFilename),
  createDatabase: (config: any) => ipcRenderer.invoke('fb:create-database', config),
  saveSqlFile: (content: string, defaultPath?: string) => ipcRenderer.invoke('dialog:save-sql-file', content, defaultPath),
  openSqlFile: () => ipcRenderer.invoke('dialog:open-sql-file'),
  exportData: (data: string, defaultFilename: string, type: 'csv' | 'json' | 'sql') => 
    ipcRenderer.invoke('dialog:export-data', data, defaultFilename, type),
  
  selectDumpFile: (defaultFilename?: string) => ipcRenderer.invoke('dialog:select-dump-file', defaultFilename),
  startDump: (options: any) => ipcRenderer.invoke('fb:start-dump', options),
  cancelDump: () => ipcRenderer.invoke('fb:cancel-dump'),
  showItemInFolder: (path: string) => ipcRenderer.invoke('shell:show-item-in-folder', path),
  onDumpProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('fb:dump-progress', handler);
    return () => ipcRenderer.removeListener('fb:dump-progress', handler);
  },

  selectImportFile: () => ipcRenderer.invoke('dialog:select-import-file'),
  startImport: (options: any) => ipcRenderer.invoke('fb:start-import', options),
  cancelImport: () => ipcRenderer.invoke('fb:cancel-import'),
  onImportProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('fb:import-progress', handler);
    return () => ipcRenderer.removeListener('fb:import-progress', handler);
  }
});
