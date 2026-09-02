import React from 'react';
import { QueryResult, QueryHistoryItem } from '../../types';
import { useTranslation } from '../../i18n/I18nContext';
import { DataGrid } from './DataGrid';
import { 
  Table as TableIcon, 
  Terminal, 
  History, 
  AlertCircle, 
  CheckCircle, 
  Copy, 
  Trash2 
} from 'lucide-react';

interface OutputPanelProps {
  result: QueryResult | null;
  isRunning: boolean;
  error: string | null;
  activeTab: 'grid' | 'messages' | 'history';
  onSelectTab: (tab: 'grid' | 'messages' | 'history') => void;
  history: QueryHistoryItem[];
  onSelectHistorySql: (sql: string) => void;
  onClearHistory: () => void;
}

export const OutputPanel: React.FC<OutputPanelProps> = ({
  result,
  isRunning,
  error,
  activeTab,
  onSelectTab,
  history,
  onSelectHistorySql,
  onClearHistory
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-t border-zinc-800 overflow-hidden">
      
      {/* Bottom Panel Tab Header */}
      <div className="flex items-center justify-between bg-zinc-950 px-3 border-b border-zinc-800 select-none">
        
        <div className="flex items-center gap-1">
          {/* Results Tab */}
          <button
            onClick={() => onSelectTab('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'grid'
                ? 'border-amber-500 text-amber-400 bg-zinc-900/60'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>{t('grid.gridTab')}</span>
            {result?.rowCount !== undefined && (
              <span className="text-[10px] bg-zinc-800 px-1.5 py-0.2 rounded text-zinc-300 font-mono">
                {result.rowCount}
              </span>
            )}
          </button>

          {/* Messages / Console Tab */}
          <button
            onClick={() => onSelectTab('messages')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'messages'
                ? error
                  ? 'border-red-500 text-red-400 bg-zinc-900/60'
                  : 'border-amber-500 text-amber-400 bg-zinc-900/60'
                : error
                  ? 'border-transparent text-red-400 hover:text-red-300'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>{t('grid.messagesTab')}</span>
            {error && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>

          {/* History Tab */}
          <button
            onClick={() => onSelectTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-amber-500 text-amber-400 bg-zinc-900/60'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{t('grid.historyTab')} ({history.length})</span>
          </button>
        </div>

      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'grid' && (
          <DataGrid result={result} isRunning={isRunning} />
        )}

        {activeTab === 'messages' && (
          <div className="h-full p-4 overflow-auto font-mono text-xs select-text bg-zinc-950/60">
            {error ? (
              <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-red-300 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>Error de Ejecución Firebird:</span>
                </div>
                <div className="whitespace-pre-wrap pl-6 text-red-200/90 text-xs">
                  {error}
                </div>
              </div>
            ) : result ? (
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-lg text-emerald-300 space-y-1">
                <div className="flex items-center gap-2 font-semibold text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>Consulta ejecutada con éxito.</span>
                </div>
                <div className="text-zinc-400 text-[11px] pl-6 space-y-0.5">
                  <div>Tiempo de ejecución: <span className="text-zinc-200">{result.executionTimeMs} ms</span></div>
                  <div>Filas retornadas: <span className="text-zinc-200">{result.rowCount}</span></div>
                  {result.affectedRows !== undefined && (
                    <div>Filas afectadas: <span className="text-zinc-200">{result.affectedRows}</span></div>
                  )}
                  <div className="mt-2 text-zinc-500 font-mono text-[11px]">SQL: {result.sql}</div>
                </div>
              </div>
            ) : (
              <div className="text-zinc-600 text-center py-8">
                No hay mensajes recientes.
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="h-full flex flex-col bg-zinc-950/40">
            <div className="p-2 border-b border-zinc-800/80 flex items-center justify-between text-xs">
              <span className="text-zinc-400">{t('grid.historyTab')}</span>
              {history.length > 0 && (
                <button
                  onClick={onClearHistory}
                  className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-red-400 px-2 py-0.5 rounded transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  {t('grid.clearHistory')}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto p-2 space-y-1.5 font-mono text-xs">
              {history.length === 0 ? (
                <div className="text-zinc-600 text-center py-8">{t('grid.historyEmpty')}</div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-800/80 transition-colors flex items-start justify-between gap-3 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${item.status === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="text-[10px] text-zinc-500">{item.timestamp}</span>
                        <span className="text-[10px] text-zinc-400">{item.durationMs}ms</span>
                        {item.rowCount !== undefined && (
                          <span className="text-[10px] text-amber-500/80">({item.rowCount} {t('grid.rows')})</span>
                        )}
                      </div>
                      <div className="text-zinc-300 truncate text-[11px] select-text">
                        {item.sql}
                      </div>
                      {item.error && (
                        <div className="text-red-400 text-[10px] mt-0.5 truncate">
                          {item.error}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => onSelectHistorySql(item.sql)}
                      title={t('common.copy')}
                      className="opacity-0 group-hover:opacity-100 p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-opacity"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
