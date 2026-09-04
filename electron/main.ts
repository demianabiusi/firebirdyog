import { app, BrowserWindow, ipcMain, dialog, nativeImage, NativeImage, Menu, shell, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { FirebirdService } from './firebird-service';
import { StorageService } from './storage-service';
import { DumpService, DumpOptions, DumpProgress } from './dump-service';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

const firebirdService = new FirebirdService();
const storageService = new StorageService();
const dumpService = new DumpService(firebirdService);

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

function loadWindowState(): WindowState {
  const defaultState: WindowState = {
    width: 1300,
    height: 850,
    isMaximized: false
  };

  try {
    const userDataPath = app.getPath('userData');
    const stateFile = path.join(userDataPath, 'window-state.json');
    if (fs.existsSync(stateFile)) {
      const data = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      return { ...defaultState, ...data };
    }
  } catch (err) {
    console.error('Error loading window state:', err);
  }
  return defaultState;
}

function saveWindowState(win: BrowserWindow) {
  try {
    const userDataPath = app.getPath('userData');
    const stateFile = path.join(userDataPath, 'window-state.json');
    const isMaximized = win.isMaximized();
    const bounds = (isMaximized && (win as any).getNormalBounds) ? (win as any).getNormalBounds() : win.getBounds();

    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized
    };
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving window state:', err);
  }
}

function getAppIcon(): NativeImage | string | undefined {
  const isWin = process.platform === 'win32';

  const possiblePaths = app.isPackaged
    ? [
        // En producción: los íconos están junto al .exe, fuera del .asar
        path.join(process.resourcesPath, '..', isWin ? 'icon.ico' : 'icon.png'),
        path.join(path.dirname(app.getPath('exe')), isWin ? 'icon.ico' : 'icon.png'),
        path.join(process.resourcesPath, isWin ? 'icon.ico' : 'icon.png'),
      ]
    : [
        // En desarrollo: public/
        path.join(__dirname, '../public', isWin ? 'icon.ico' : 'icon.png'),
        path.join(process.cwd(), 'public', isWin ? 'icon.ico' : 'icon.png'),
        path.join(__dirname, '../public/icon.png'),
        path.join(process.cwd(), 'public/icon.png'),
      ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const img = nativeImage.createFromPath(p);
        if (!img.isEmpty()) {
          return img;
        }
      } catch {
        return p;
      }
    }
  }
  return undefined;
}

function createWindow() {
  const appIcon = getAppIcon();
  const windowState = loadWindowState();

  // Validate that saved position falls within any currently connected display
  let hasValidPosition = false;
  if (typeof windowState.x === 'number' && typeof windowState.y === 'number') {
    const displays = screen.getAllDisplays();
    hasValidPosition = displays.some(display => {
      const { x, y, width, height } = display.bounds;
      return (
        windowState.x! >= x &&
        windowState.x! < x + width &&
        windowState.y! >= y &&
        windowState.y! < y + height
      );
    });
  }

  // Disable default native Electron menu
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: windowState.width || 1300,
    height: windowState.height || 850,
    ...(hasValidPosition ? { x: windowState.x, y: windowState.y } : {}),
    minWidth: 900,
    minHeight: 600,
    title: 'FirebirdYog - Firebird Database Client',
    icon: appIcon,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }
  mainWindow.show();

  if (appIcon && typeof appIcon !== 'string') {
    mainWindow.setIcon(appIcon);
  }

  let saveTimer: NodeJS.Timeout | null = null;
  const debouncedSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        saveWindowState(mainWindow);
      }
    }, 500);
  };

  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);
  mainWindow.on('close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      saveWindowState(mainWindow);
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
  app.setName('FirebirdYog');
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

// IPC: App Settings
ipcMain.handle('app:get-settings', async () => {
  try {
    return storageService.getSettings();
  } catch (err: any) {
    console.error('Error getting app settings:', err);
    return { lastActiveConnectionId: null, autoConnectOnStartup: true };
  }
});

ipcMain.handle('app:save-settings', async (_, patch) => {
  try {
    return storageService.saveSettings(patch);
  } catch (err: any) {
    console.error('Error saving app settings:', err);
    return storageService.getSettings();
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
    const data = await firebirdService.executeScript(script);
    return { success: true, data };
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

// IPC: Database Dump / Export (mysqldump style)
ipcMain.handle('fb:start-dump', async (_, options: DumpOptions) => {
  try {
    const res = await dumpService.exportDatabase(options, (progress: DumpProgress) => {
      if (mainWindow) {
        mainWindow.webContents.send('fb:dump-progress', progress);
      }
    });
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al exportar base de datos' };
  }
});

ipcMain.handle('fb:cancel-dump', async () => {
  dumpService.cancel();
  return { success: true };
});

ipcMain.handle('dialog:select-dump-file', async (_, defaultFilename?: string) => {
  if (!mainWindow) return null;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Ubicación para el Dump SQL de Firebird (.sql)',
    defaultPath: defaultFilename || 'firebird_dump.sql',
    filters: [
      { name: 'SQL Script (*.sql)', extensions: ['sql'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (canceled || !filePath) return null;
  return filePath;
});

ipcMain.handle('shell:show-item-in-folder', async (_, fullPath: string) => {
  if (fullPath && fs.existsSync(fullPath)) {
    shell.showItemInFolder(fullPath);
    return true;
  }
  return false;
});

// IPC: Database Import / Streaming Dump Loader
ipcMain.handle('fb:start-import', async (_, options: any) => {
  try {
    const res = await dumpService.importDatabase(options, (progress: any) => {
      if (mainWindow) {
        mainWindow.webContents.send('fb:import-progress', progress);
      }
    });
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al importar base de datos' };
  }
});

ipcMain.handle('fb:cancel-import', async () => {
  dumpService.cancel();
  return { success: true };
});

ipcMain.handle('dialog:select-import-file', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar archivo de Dump SQL para importar (.sql)',
    properties: ['openFile'],
    filters: [
      { name: 'SQL Script (*.sql)', extensions: ['sql'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (canceled || filePaths.length === 0) return null;
  const filePath = filePaths[0];
  const stat = fs.statSync(filePath);
  return { filePath, size: stat.size, name: path.basename(filePath) };
});


