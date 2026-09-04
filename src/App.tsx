import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ConnectionConfig, QueryTab, QueryResult, QueryHistoryItem } from './types';
import { Navbar } from './components/Navbar';
import { ObjectTree } from './components/Sidebar/ObjectTree';
import { TabBar } from './components/Editor/TabBar';
import { SqlEditor } from './components/Editor/SqlEditor';
import { OutputPanel } from './components/Grid/OutputPanel';
import { ConnectionModal } from './components/Modals/ConnectionModal';
import { TableDetailsModal } from './components/Modals/TableDetailsModal';
import { CreateDatabaseModal } from './components/Modals/CreateDatabaseModal';
import { TableDesignerModal } from './components/Modals/TableDesignerModal';
import { DumpDatabaseModal } from './components/Modals/DumpDatabaseModal';
import { ImportDatabaseModal } from './components/Modals/ImportDatabaseModal';
import { Database, Plus, Sparkles } from 'lucide-react';
import { useConnectionWorkspace } from './hooks/useConnectionWorkspace';

const INITIAL_QUERY = `-- Bienvenido a FirebirdYog
-- Presiona F9 o haz clic en "Ejecutar" para ejecutar consultas

SELECT 
    RDB$RELATION_NAME AS TABLA,
    RDB$SYSTEM_FLAG AS ES_SISTEMA
FROM RDB$RELATIONS
WHERE RDB$VIEW_BLR IS NULL
ORDER BY RDB$RELATION_NAME;
`;

export const App: React.FC = () => {
  // Connection states
  const [isConnected, setIsConnected] = useState(false);
  const [activeConfig, setActiveConfig] = useState<ConnectionConfig | null>(null);
  const [savedConnections, setSavedConnections] = useState<ConnectionConfig[]>([]);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isCreateDbModalOpen, setIsCreateDbModalOpen] = useState(false);
  const [isDumpModalOpen, setIsDumpModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Workspace persistence
  const { hydrateWorkspace, saveWorkspaceNow, saveWorkspaceDebounced } = useConnectionWorkspace();

  // Table Designer states
  const [isTableDesignerOpen, setIsTableDesignerOpen] = useState(false);
  const [tableDesignerName, setTableDesignerName] = useState<string | null>(null);

  // Schema metadata
  const [schemaObjects, setSchemaObjects] = useState<any | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);

  // Query tabs
  const [tabs, setTabs] = useState<QueryTab[]>([
    {
      id: 'tab_1',
      title: 'Consulta 1',
      sql: INITIAL_QUERY,
      result: null,
      isRunning: false,
      error: null,
      activeResultTab: 'grid'
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab_1');
  const [maxRows, setMaxRows] = useState<number>(1000);

  // F9/F5 key swap preference (persisted) — matches SQLyog behavior when enabled
  const [swapF9F5, setSwapF9F5] = useState<boolean>(() =>
    localStorage.getItem('firebirdyog_swap_f9f5') === 'true'
  );
  const handleToggleSwapF9F5 = () => {
    setSwapF9F5(prev => {
      const next = !prev;
      localStorage.setItem('firebirdyog_swap_f9f5', String(next));
      return next;
    });
  };

  // Refs so disconnect/save can always read the latest values without stale closures
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const maxRowsRef = useRef(maxRows);
  const activeConfigRef = useRef(activeConfig);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);
  useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);
  useEffect(() => { maxRowsRef.current = maxRows; }, [maxRows]);
  useEffect(() => { activeConfigRef.current = activeConfig; }, [activeConfig]);

  // Panel resizing states
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('firebirdyog_sidebar_width');
    return saved ? Math.max(180, Math.min(650, parseInt(saved, 10))) : 288;
  });
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);

  const [editorHeightPercent, setEditorHeightPercent] = useState<number>(() => {
    const saved = localStorage.getItem('firebirdyog_editor_height_pct');
    return saved ? Math.max(15, Math.min(85, parseFloat(saved))) : 48;
  });
  const [isDraggingEditor, setIsDraggingEditor] = useState(false);

  // History
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);

  // Modals
  const [selectedTableForDetails, setSelectedTableForDetails] = useState<string | null>(null);

  // Active Tab helper
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // Load saved connections on startup
  const loadSavedConnections = useCallback(async () => {
    try {
      if (window.electronAPI?.getSavedConnections) {
        const conns = await window.electronAPI.getSavedConnections();
        setSavedConnections(conns || []);
      }
    } catch (err) {
      console.error('Error loading connections:', err);
    }
  }, []);

  // Fetch schema objects
  const refreshSchema = useCallback(async () => {
    if (!isConnected) return;
    setIsLoadingSchema(true);
    try {
      if (window.electronAPI?.getSchemaObjects) {
        const res = await window.electronAPI.getSchemaObjects();
        if (res.success && res.data) {
          setSchemaObjects(res.data);
        } else {
          setSchemaObjects(null);
        }
      }
    } catch (err) {
      console.error('Error fetching schema:', err);
      setSchemaObjects(null);
    } finally {
      setIsLoadingSchema(false);
    }
  }, [isConnected]);

  useEffect(() => {
    loadSavedConnections();
  }, [loadSavedConnections]);

  useEffect(() => {
    if (isConnected && activeConfig) {
      refreshSchema();
    } else {
      setSchemaObjects(null);
    }
  }, [isConnected, activeConfig, refreshSchema]);

  // Connect action
  const handleConnect = async (config: ConnectionConfig) => {
    if (window.electronAPI?.connect) {
      setSchemaObjects(null);
      setIsLoadingSchema(true);
      const res = await window.electronAPI.connect(config);
      if (!res.success) {
        setIsLoadingSchema(false);
        throw new Error(res.error || 'No se pudo establecer la conexión');
      }
      setActiveConfig(config);
      setIsConnected(true);

      // Restore this connection's workspace (tabs, activeTab, maxRows)
      const workspace = hydrateWorkspace(config.id);
      setTabs(workspace.tabs);
      setActiveTabId(workspace.activeTabId);
      setMaxRows(workspace.maxRows);

      // Force instant schema retrieval for the new connection
      try {
        const schemaRes = await window.electronAPI.getSchemaObjects();
        if (schemaRes.success && schemaRes.data) {
          setSchemaObjects(schemaRes.data);
        }
      } catch (err) {
        console.error('Error fetching schema after connection change:', err);
      } finally {
        setIsLoadingSchema(false);
      }
    }
  };

  // Disconnect action
  const handleDisconnect = async () => {
    // Save workspace before clearing state
    const cfg = activeConfigRef.current;
    if (cfg) {
      saveWorkspaceNow(cfg.id, tabsRef.current, activeTabIdRef.current, maxRowsRef.current);
    }
    if (window.electronAPI?.disconnect) {
      await window.electronAPI.disconnect();
    }
    setIsConnected(false);
    setActiveConfig(null);
    setSchemaObjects(null);
  };

  // Update tab sql — also debounce-save the workspace
  const handleSqlChange = (newSql: string) => {
    setTabs(prev => {
      const next = prev.map(t => t.id === activeTabId ? { ...t, sql: newSql } : t);
      if (activeConfig) saveWorkspaceDebounced(activeConfig.id, next, activeTabId, maxRows);
      return next;
    });
  };

  const isConnectedRef = useRef(isConnected);
  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);

  // Execute active query
  const handleExecuteQuery = useCallback(async (selectedOnly: boolean = false) => {
    if (!isConnectedRef.current) {
      // If user clicked or pressed execute while not connected, prompt to connect
      setIsConnectionModalOpen(true);
      return;
    }

    const targetTabId = activeTabIdRef.current;
    const currentTab = tabsRef.current.find(t => t.id === targetTabId);
    if (!currentTab) return;

    const queryToRun = currentTab.sql.trim();
    if (!queryToRun) return;

    // Set tab running state
    setTabs(prev => prev.map(t => t.id === targetTabId ? { ...t, isRunning: true, error: null } : t));

    const startTime = Date.now();

    try {
      if (window.electronAPI?.executeQuery) {
        const res = await window.electronAPI.executeQuery(queryToRun, maxRows);
        const duration = Date.now() - startTime;

        if (res.success && res.data) {
          const queryResult = res.data;
          setTabs(prev => prev.map(t => 
            t.id === targetTabId 
              ? { 
                  ...t, 
                  result: queryResult, 
                  isRunning: false, 
                  error: null, 
                  activeResultTab: 'grid' 
                } 
              : t
          ));

          // Append to history
          setHistory(prev => [
            {
              id: 'hist_' + Date.now(),
              sql: queryToRun,
              timestamp: new Date().toLocaleTimeString(),
              durationMs: queryResult.executionTimeMs || duration,
              status: 'success',
              rowCount: queryResult.rowCount
            },
            ...prev.slice(0, 49) // keep last 50
          ]);
        } else {
          const errMsg = res.error || 'Error al ejecutar la consulta';
          setTabs(prev => prev.map(t => 
            t.id === targetTabId 
              ? { 
                  ...t, 
                  result: null, 
                  isRunning: false, 
                  error: errMsg, 
                  activeResultTab: 'messages' 
                } 
              : t
          ));

          setHistory(prev => [
            {
              id: 'hist_' + Date.now(),
              sql: queryToRun,
              timestamp: new Date().toLocaleTimeString(),
              durationMs: duration,
              status: 'error',
              error: errMsg
            },
            ...prev.slice(0, 49)
          ]);
        }
      }
    } catch (err: any) {
      const duration = Date.now() - startTime;
      const errMsg = err.message || 'Error inesperado';
      setTabs(prev => prev.map(t => 
        t.id === targetTabId 
          ? { 
              ...t, 
              result: null, 
              isRunning: false, 
              error: errMsg, 
              activeResultTab: 'messages' 
            } 
          : t
      ));

      setHistory(prev => [
        {
          id: 'hist_' + Date.now(),
          sql: queryToRun,
          timestamp: new Date().toLocaleTimeString(),
          durationMs: duration,
          status: 'error',
          error: errMsg
        },
        ...prev.slice(0, 49)
      ]);
    }
  }, [maxRows]);

  // Add new tab
  const handleAddTab = () => {
    const newId = 'tab_' + (tabs.length + 1) + '_' + Date.now();
    const newTab: QueryTab = {
      id: newId,
      title: `Consulta ${tabs.length + 1}`,
      sql: '',
      result: null,
      isRunning: false,
      error: null,
      activeResultTab: 'grid'
    };
    setTabs(prev => {
      const next = [...prev, newTab];
      if (activeConfig) saveWorkspaceDebounced(activeConfig.id, next, newId, maxRows);
      return next;
    });
    setActiveTabId(newId);
  };

  // Close tab
  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    const remaining = tabs.filter(t => t.id !== id);
    const nextActiveId = activeTabId === id ? remaining[0].id : activeTabId;
    setTabs(remaining);
    setActiveTabId(nextActiveId);
    if (activeConfig) saveWorkspaceNow(activeConfig.id, remaining, nextActiveId, maxRows);
  };

  // Rename tab
  const handleRenameTab = (id: string, newTitle: string) => {
    setTabs(prev => {
      const next = prev.map(t => t.id === id ? { ...t, title: newTitle } : t);
      if (activeConfig) saveWorkspaceDebounced(activeConfig.id, next, activeTabId, maxRows);
      return next;
    });
  };

  // When clicking on an object from tree
  const handleSelectObjectSql = (sql: string, executeImmediately: boolean = false) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, sql } : t));
    if (executeImmediately && isConnected) {
      setTimeout(() => {
        handleExecuteQuery(false);
      }, 50);
    }
  };

  // When requesting to edit a Procedure, Trigger, View, or Table
  const handleEditObject = async (type: 'PROCEDURE' | 'TRIGGER' | 'VIEW' | 'TABLE', name: string) => {
    if (!isConnected) return;
    try {
      if (window.electronAPI?.getObjectDdl) {
        const res = await window.electronAPI.getObjectDdl(type, name);
        if (res.success && res.data) {
          const newTabId = 'tab_edit_' + name + '_' + Date.now();
          const newTab: QueryTab = {
            id: newTabId,
            title: `Editar: ${name}`,
            sql: res.data.ddl,
            result: null,
            isRunning: false,
            error: null,
            activeResultTab: 'grid'
          };
          setTabs(prev => [...prev, newTab]);
          setActiveTabId(newTabId);
        } else {
          alert('No se pudo obtener el código de ' + name + ': ' + (res.error || 'Error desconocido'));
        }
      }
    } catch (err: any) {
      alert('Error al cargar código del objeto: ' + err.message);
    }
  };

  // Global keyboard shortcut handler (Capture phase to prevent browser/Electron native F5 reload)
  const swapF9F5Ref = useRef(swapF9F5);
  useEffect(() => { swapF9F5Ref.current = swapF9F5; }, [swapF9F5]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isF5 = e.key === 'F5' || e.code === 'F5' || e.keyCode === 116;
      const isF9 = e.key === 'F9' || e.code === 'F9' || e.keyCode === 120;

      // Prevent native browser refresh on F5 across the entire application
      if (isF5) {
        e.preventDefault();
        e.stopPropagation();
      }

      const isSwap = swapF9F5Ref.current;
      const isExecuteKey = isSwap ? isF5 : isF9;
      const isRefreshKey = isSwap ? isF9 : isF5;

      if (isExecuteKey) {
        e.preventDefault();
        e.stopPropagation();
        if (isConnectedRef.current) {
          handleExecuteQuery(false);
        }
      } else if (isRefreshKey) {
        e.preventDefault();
        e.stopPropagation();
        if (isConnectedRef.current) {
          refreshSchema();
        }
      } else if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleAddTab();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleExecuteQuery, refreshSchema]);

  // Handle Table Designer
  const handleOpenCreateTable = () => {
    setTableDesignerName(null);
    setIsTableDesignerOpen(true);
  };

  const handleOpenDesignTable = (tableName: string) => {
    setTableDesignerName(tableName);
    setIsTableDesignerOpen(true);
  };

  const handleTableDesignerSuccess = (tableName: string) => {
    refreshSchema();
  };

  const handleOpenInSqlEditor = (sql: string, title?: string) => {
    const newId = 'tab_' + Date.now();
    const newTab: QueryTab = {
      id: newId,
      title: title || 'Diseño Tabla',
      sql,
      result: null,
      isRunning: false,
      error: null,
      activeResultTab: 'messages'
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleCreateProcedure = () => {
    const template = `-- Procedimiento Almacenado de Firebird
-- Presiona F9 para compilar / ejecutar en la base de datos

CREATE OR ALTER PROCEDURE SP_NUEVO_PROCEDIMIENTO (
    PARAM_ID INTEGER,
    PARAM_NOMBRE VARCHAR(100)
)
RETURNS (
    RESULTADO_ID INTEGER,
    MENSAJE VARCHAR(255)
)
AS
-- Declaración de variables locales
DECLARE VARIABLE V_CONTADOR INTEGER;
BEGIN
    /* Lógica del procedimiento */
    RESULTADO_ID = :PARAM_ID;
    MENSAJE = 'Procesado con éxito: ' || COALESCE(:PARAM_NOMBRE, '');

    -- Si el procedimiento es seleccionable (para usar con SELECT * FROM SP_...), descomenta SUSPEND:
    -- SUSPEND;
END;
`;
    handleOpenInSqlEditor(template, 'Nuevo Procedimiento');
  };

  const handleCreateView = () => {
    const template = `-- Vista de Firebird
-- Presiona F9 para compilar / crear en la base de datos

CREATE OR ALTER VIEW VW_NUEVA_VISTA (
    CAMPO1,
    CAMPO2,
    CAMPO3
)
AS
SELECT 
    RDB$RELATION_NAME,
    RDB$FORMAT,
    RDB$SYSTEM_FLAG
FROM RDB$RELATIONS
WHERE RDB$SYSTEM_FLAG = 0;
`;
    handleOpenInSqlEditor(template, 'Nueva Vista');
  };

  const handleCreateTrigger = () => {
    const template = `-- Trigger de Firebird
-- Presiona F9 para compilar / crear en la base de datos

CREATE OR ALTER TRIGGER TR_NUEVO_TRIGGER FOR TABLA_OBJETIVO
ACTIVE BEFORE INSERT POSITION 0
AS
BEGIN
    /* Lógica del trigger */
    -- IF (NEW.ID IS NULL OR NEW.ID = 0) THEN
    --     NEW.ID = GEN_ID(GEN_TABLA_ID, 1);
END;
`;
    handleOpenInSqlEditor(template, 'Nuevo Trigger');
  };

  // Sidebar horizontal resize
  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSidebar(true);

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(180, Math.min(window.innerWidth * 0.55, startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setSidebarWidth(current => {
        localStorage.setItem('firebirdyog_sidebar_width', String(Math.round(current)));
        return current;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Editor vertical resize
  const handleEditorMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingEditor(true);

    const container = document.getElementById('right-pane-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerHeight = containerRect.height;
    const containerTop = containerRect.top;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const offsetY = moveEvent.clientY - containerTop;
      const pct = (offsetY / containerHeight) * 100;
      const clampedPct = Math.max(15, Math.min(85, pct));
      setEditorHeightPercent(clampedPct);
    };

    const handleMouseUp = () => {
      setIsDraggingEditor(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setEditorHeightPercent(current => {
        localStorage.setItem('firebirdyog_editor_height_pct', String(Math.round(current)));
        return current;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Handle database creation callback
  const handleCreateAndConnect = async (config: ConnectionConfig, autoConnect: boolean, autoSave: boolean) => {
    if (autoSave) {
      loadSavedConnections();
    }
    if (autoConnect) {
      await handleConnect(config);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans select-none relative">
      
      {/* Invisible overlay during drag to prevent iframe / Monaco event stealing */}
      {(isDraggingSidebar || isDraggingEditor) && (
        <div className={`fixed inset-0 z-50 ${isDraggingSidebar ? 'cursor-col-resize' : 'cursor-row-resize'}`} />
      )}

      {/* Top Navbar */}
      <Navbar
        isConnected={isConnected}
        activeConfig={activeConfig}
        onOpenConnectionModal={() => setIsConnectionModalOpen(true)}
        onOpenCreateDbModal={() => setIsCreateDbModalOpen(true)}
        onOpenDumpModal={() => setIsDumpModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onDisconnect={handleDisconnect}
        onNewQuery={handleAddTab}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Pane: Database Object Tree (Resizable Width) */}
        <div 
          style={{ width: `${sidebarWidth}px` }} 
          className="shrink-0 h-full bg-zinc-900 flex flex-col overflow-hidden"
        >
          {isConnected ? (
            <ObjectTree
              objects={schemaObjects}
              isLoading={isLoadingSchema}
              onRefresh={refreshSchema}
              onSelectObjectSql={handleSelectObjectSql}
              onShowTableDetails={(tbl) => setSelectedTableForDetails(tbl)}
              onEditObject={handleEditObject}
              onCreateTable={handleOpenCreateTable}
              onDesignTable={handleOpenDesignTable}
              onCreateProcedure={handleCreateProcedure}
              onCreateView={handleCreateView}
              onCreateTrigger={handleCreateTrigger}
              databaseName={activeConfig?.database}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 gap-3">
              <div className="p-3 bg-zinc-800/80 rounded-2xl border border-zinc-700/60 text-amber-500">
                <Database className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-300 mb-1">Sin Conexión</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Conéctate o crea una nueva base de datos Firebird para explorar sus tablas, vistas, triggers y procedimientos.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => setIsConnectionModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg text-xs transition-colors shadow-md shadow-amber-500/10"
                >
                  <Database className="w-3.5 h-3.5" />
                  Conectar
                </button>
                <button
                  onClick={() => setIsCreateDbModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition-colors shadow-md shadow-emerald-600/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Crear Nueva BD
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Horizontal Resizer Splitter (Sidebar <-> Main Pane) */}
        <div
          onMouseDown={handleSidebarMouseDown}
          onDoubleClick={() => {
            setSidebarWidth(288);
            localStorage.setItem('firebirdyog_sidebar_width', '288');
          }}
          title="Arrastra para cambiar ancho del panel (Doble clic para restablecer a 288px)"
          className={`w-1 hover:w-1.5 bg-zinc-800 hover:bg-amber-500 cursor-col-resize transition-all shrink-0 select-none relative group z-10 ${
            isDraggingSidebar ? 'w-1.5 bg-amber-500' : ''
          }`}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
        </div>

        {/* Right Pane: Split (Top = SQL Editor, Bottom = Grid / Output) */}
        <div 
          id="right-pane-container"
          className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950"
        >
          
          {/* Query Tab Bar */}
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={(id) => {
              setActiveTabId(id);
              if (activeConfig) saveWorkspaceDebounced(activeConfig.id, tabs, id, maxRows);
            }}
            onAddTab={handleAddTab}
            onCloseTab={handleCloseTab}
            onRenameTab={handleRenameTab}
          />

          {/* Top Half: SQL Editor (Resizable Height) */}
          <div 
            style={{ height: `${editorHeightPercent}%` }} 
            className="min-h-[100px] flex flex-col overflow-hidden"
          >
            <SqlEditor
              sql={activeTab.sql}
              onChange={handleSqlChange}
              onExecute={handleExecuteQuery}
              isRunning={activeTab.isRunning}
              maxRows={maxRows}
              onChangeMaxRows={setMaxRows}
              swapF9F5={swapF9F5}
              onToggleSwap={handleToggleSwapF9F5}
              schema={schemaObjects}
            />
          </div>

          {/* Vertical Resizer Splitter (SQL Editor <-> Output Panel) */}
          <div
            onMouseDown={handleEditorMouseDown}
            onDoubleClick={() => {
              setEditorHeightPercent(48);
              localStorage.setItem('firebirdyog_editor_height_pct', '48');
            }}
            title="Arrastra para cambiar altura del editor y resultados (Doble clic para restablecer a 48%)"
            className={`h-1.5 hover:h-2 bg-zinc-800/90 hover:bg-amber-500 cursor-row-resize transition-all shrink-0 select-none relative flex items-center justify-center group z-10 ${
              isDraggingEditor ? 'h-2 bg-amber-500' : ''
            }`}
          >
            <div className="w-10 h-0.5 bg-zinc-600 group-hover:bg-amber-200 rounded-full" />
            <div className="absolute -top-1 -bottom-1 inset-x-0 cursor-row-resize" />
          </div>

          {/* Bottom Half: Data Grid & Output Panel */}
          <div className="flex-1 min-h-[120px] flex flex-col overflow-hidden">
            <OutputPanel
              result={activeTab.result}
              isRunning={activeTab.isRunning}
              error={activeTab.error}
              activeTab={activeTab.activeResultTab}
              onSelectTab={(tab) => {
                setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, activeResultTab: tab } : t));
              }}
              history={history}
              onSelectHistorySql={(sql) => handleSqlChange(sql)}
              onClearHistory={() => setHistory([])}
            />
          </div>

        </div>

      </div>

      {/* Connection Manager Modal */}
      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
        onConnect={handleConnect}
        savedConnections={savedConnections}
        onRefreshConnections={loadSavedConnections}
        onOpenCreateModal={() => setIsCreateDbModalOpen(true)}
        activeConfigId={activeConfig?.id}
      />

      {/* Create Database Modal */}
      <CreateDatabaseModal
        isOpen={isCreateDbModalOpen}
        onClose={() => setIsCreateDbModalOpen(false)}
        onCreateAndConnect={handleCreateAndConnect}
      />

      {/* Table Designer Modal */}
      <TableDesignerModal
        isOpen={isTableDesignerOpen}
        tableName={tableDesignerName}
        existingGenerators={schemaObjects?.generators || []}
        onClose={() => setIsTableDesignerOpen(false)}
        onSuccess={handleTableDesignerSuccess}
        onOpenInSqlEditor={handleOpenInSqlEditor}
      />

      {/* Table Details Modal */}
      <TableDetailsModal
        tableName={selectedTableForDetails}
        onClose={() => setSelectedTableForDetails(null)}
      />

      {/* Database Dump / Export Modal */}
      <DumpDatabaseModal
        isOpen={isDumpModalOpen}
        onClose={() => setIsDumpModalOpen(false)}
        databaseName={activeConfig?.database}
        tables={schemaObjects?.tables || []}
      />

      {/* Database Import Modal */}
      <ImportDatabaseModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => refreshSchema()}
        databaseName={activeConfig?.database}
      />

    </div>
  );
};
