import React, { useState, useEffect, useCallback } from 'react';
import { ConnectionConfig, QueryTab, QueryResult, QueryHistoryItem } from './types';
import { Navbar } from './components/Navbar';
import { ObjectTree } from './components/Sidebar/ObjectTree';
import { TabBar } from './components/Editor/TabBar';
import { SqlEditor } from './components/Editor/SqlEditor';
import { OutputPanel } from './components/Grid/OutputPanel';
import { ConnectionModal } from './components/Modals/ConnectionModal';
import { TableDetailsModal } from './components/Modals/TableDetailsModal';
import { Database, Plus, Sparkles } from 'lucide-react';

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
        }
      }
    } catch (err) {
      console.error('Error fetching schema:', err);
    } finally {
      setIsLoadingSchema(false);
    }
  }, [isConnected]);

  useEffect(() => {
    loadSavedConnections();
  }, [loadSavedConnections]);

  useEffect(() => {
    if (isConnected) {
      refreshSchema();
    } else {
      setSchemaObjects(null);
    }
  }, [isConnected, refreshSchema]);

  // Connect action
  const handleConnect = async (config: ConnectionConfig) => {
    if (window.electronAPI?.connect) {
      const res = await window.electronAPI.connect(config);
      if (!res.success) {
        throw new Error(res.error || 'No se pudo establecer la conexión');
      }
      setActiveConfig(config);
      setIsConnected(true);
    }
  };

  // Disconnect action
  const handleDisconnect = async () => {
    if (window.electronAPI?.disconnect) {
      await window.electronAPI.disconnect();
    }
    setIsConnected(false);
    setActiveConfig(null);
    setSchemaObjects(null);
  };

  // Update tab sql
  const handleSqlChange = (newSql: string) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, sql: newSql } : t));
  };

  // Execute active query
  const handleExecuteQuery = async (selectedOnly: boolean = false) => {
    if (!isConnected) {
      setIsConnectionModalOpen(true);
      return;
    }

    const currentTab = tabs.find(t => t.id === activeTabId);
    if (!currentTab) return;

    const queryToRun = currentTab.sql.trim();
    if (!queryToRun) return;

    // Set tab running state
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isRunning: true, error: null } : t));

    const startTime = Date.now();

    try {
      if (window.electronAPI?.executeQuery) {
        const res = await window.electronAPI.executeQuery(queryToRun, maxRows);
        const duration = Date.now() - startTime;

        if (res.success && res.data) {
          const queryResult = res.data;
          setTabs(prev => prev.map(t => 
            t.id === activeTabId 
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
            t.id === activeTabId 
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
        t.id === activeTabId 
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
  };

  // Add new tab
  const handleAddTab = () => {
    const newId = 'tab_' + (tabs.length + 1) + '_' + Date.now();
    const newTab: QueryTab = {
      id: newId,
      title: `Consulta ${tabs.length + 1}`,
      sql: 'SELECT * FROM RDB$DATABASE;',
      result: null,
      isRunning: false,
      error: null,
      activeResultTab: 'grid'
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Close tab
  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    const remaining = tabs.filter(t => t.id !== id);
    setTabs(remaining);
    if (activeTabId === id) {
      setActiveTabId(remaining[0].id);
    }
  };

  // Rename tab
  const handleRenameTab = (id: string, newTitle: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, title: newTitle } : t));
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

  // Keyboard shortcut listener for F9 and Ctrl+N
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        handleExecuteQuery(false);
      } else if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleAddTab();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConnected, activeTabId, tabs]);

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans select-none">
      
      {/* Top Navbar */}
      <Navbar
        isConnected={isConnected}
        activeConfig={activeConfig}
        onOpenConnectionModal={() => setIsConnectionModalOpen(true)}
        onDisconnect={handleDisconnect}
        onNewQuery={handleAddTab}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Pane: Database Object Tree (260px - 300px) */}
        <div className="w-72 shrink-0 h-full border-r border-zinc-800 bg-zinc-900 flex flex-col">
          {isConnected ? (
            <ObjectTree
              objects={schemaObjects}
              isLoading={isLoadingSchema}
              onRefresh={refreshSchema}
              onSelectObjectSql={handleSelectObjectSql}
              onShowTableDetails={(tbl) => setSelectedTableForDetails(tbl)}
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
                  Conéctate a una base de datos Firebird para explorar sus tablas, vistas, triggers y procedimientos.
                </p>
              </div>
              <button
                onClick={() => setIsConnectionModalOpen(true)}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg text-xs transition-colors shadow-md shadow-amber-500/10"
              >
                <Plus className="w-3.5 h-3.5" />
                Conectar Ahora
              </button>
            </div>
          )}
        </div>

        {/* Right Pane: Split (Top = SQL Editor, Bottom = Grid / Output) */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
          
          {/* Query Tab Bar */}
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={(id) => setActiveTabId(id)}
            onAddTab={handleAddTab}
            onCloseTab={handleCloseTab}
            onRenameTab={handleRenameTab}
          />

          {/* Top Half: SQL Editor */}
          <div className="h-[48%] min-h-[160px] border-b border-zinc-800 flex flex-col">
            <SqlEditor
              sql={activeTab.sql}
              onChange={handleSqlChange}
              onExecute={handleExecuteQuery}
              isRunning={activeTab.isRunning}
              maxRows={maxRows}
              onChangeMaxRows={setMaxRows}
            />
          </div>

          {/* Bottom Half: Data Grid & Output Panel */}
          <div className="flex-1 min-h-[180px] flex flex-col overflow-hidden">
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
        activeConfigId={activeConfig?.id}
      />

      {/* Table Details Modal */}
      <TableDetailsModal
        tableName={selectedTableForDetails}
        onClose={() => setSelectedTableForDetails(null)}
      />

    </div>
  );
};
