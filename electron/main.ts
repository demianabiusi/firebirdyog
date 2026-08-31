import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { FirebirdService } from './firebird-service';
import { StorageService } from './storage-service';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

const firebirdService = new FirebirdService();
const storageService = new StorageService();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    title: 'FirebirdYog - Firebird Database Client',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  try {
    await firebirdService.disconnect();
  } catch (err) {
    console.error('Error disconnecting before exit:', err);
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: Connection Management
ipcMain.handle('fb:get-saved-connections', async () => {
  try {
    return storageService.getConnections();
  } catch (err: any) {
    console.error('Error getSavedConnections:', err);
    return [];
  }
});

ipcMain.handle('fb:save-connection', async (_, config) => {
  try {
    return storageService.saveConnection(config);
  } catch (err: any) {
    throw new Error(err.message || 'Error al guardar la conexión');
  }
});

ipcMain.handle('fb:delete-connection', async (_, id: string) => {
  try {
    return storageService.deleteConnection(id);
  } catch (err: any) {
    throw new Error(err.message || 'Error al eliminar la conexión');
  }
});

ipcMain.handle('fb:test-connection', async (_, config) => {
  try {
    const res = await firebirdService.testConnection(config);
    return { success: res.success, data: { message: res.message, pingMs: res.pingMs } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error en prueba de conexión' };
  }
});

ipcMain.handle('fb:connect', async (_, config) => {
  try {
    await firebirdService.connect(config);
    return { success: true, data: { database: config.database } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al conectar con Firebird' };
  }
});

ipcMain.handle('fb:create-database', async (_, config) => {
  try {
    const res = await firebirdService.createDatabase(config);
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear la base de datos' };
  }
});

ipcMain.handle('fb:disconnect', async () => {
  try {
    await firebirdService.disconnect();
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al desconectar' };
  }
});

ipcMain.handle('fb:get-status', async () => {
  return {
    isConnected: firebirdService.isConnected(),
    config: firebirdService.getCurrentConfig()
  };
});

// IPC: Metadata
ipcMain.handle('fb:get-schema-objects', async () => {
  try {
    const data = await firebirdService.getSchemaObjects();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener objetos' };
  }
});

ipcMain.handle('fb:get-table-details', async (_, tableName: string) => {
  try {
    const data = await firebirdService.getTableDetails(tableName);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener detalles de la tabla' };
  }
});

ipcMain.handle('fb:get-object-ddl', async (_, type: string, name: string) => {
  try {
    const data = await firebirdService.getObjectDdl(type, name);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener DDL del objeto' };
  }
});

// IPC: Queries
ipcMain.handle('fb:execute-query', async (_, sql: string, maxRows?: number) => {
  try {
    const data = await firebirdService.executeQuery(sql, maxRows);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al ejecutar consulta' };
  }
});

ipcMain.handle('fb:execute-script', async (_, script: string) => {
  try {
    // Split script by semicolons (simple parser)
    const statements = script
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const results = [];
    for (const stmt of statements) {
      const res = await firebirdService.executeQuery(stmt);
      results.push(res);
    }
    return { success: true, data: { statementsExecuted: statements.length, results } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al ejecutar script' };
  }
});

// IPC: Dialogs
ipcMain.handle('dialog:select-database-file', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar base de datos Firebird (.fdb, .gdb)',
    properties: ['openFile'],
    filters: [
      { name: 'Firebird Databases', extensions: ['fdb', 'gdb', 'db'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

ipcMain.handle('dialog:select-new-database-file', async (_, defaultFilename?: string) => {
  if (!mainWindow) return null;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Ubicación para la nueva base de datos Firebird (.fdb)',
    defaultPath: defaultFilename || 'nueva_base.fdb',
    filters: [
      { name: 'Firebird Database', extensions: ['fdb'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (canceled || !filePath) return null;
  return filePath;
});

ipcMain.handle('dialog:save-sql-file', async (_, content: string, defaultPath?: string) => {
  if (!mainWindow) return false;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar archivo SQL',
    defaultPath: defaultPath || 'query.sql',
    filters: [
      { name: 'SQL Files', extensions: ['sql'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('dialog:open-sql-file', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Abrir archivo SQL',
    properties: ['openFile'],
    filters: [
      { name: 'SQL Files', extensions: ['sql'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (canceled || filePaths.length === 0) return null;
  const content = fs.readFileSync(filePaths[0], 'utf-8');
  return { content, filePath: filePaths[0] };
});

ipcMain.handle('dialog:export-data', async (_, data: string, defaultFilename: string, type: 'csv' | 'json' | 'sql') => {
  if (!mainWindow) return false;
  const extensions = type === 'csv' ? ['csv'] : type === 'json' ? ['json'] : ['sql'];
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: `Exportar resultados (${type.toUpperCase()})`,
    defaultPath: defaultFilename,
    filters: [
      { name: `${type.toUpperCase()} Files`, extensions },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, data, 'utf-8');
  return true;
});
