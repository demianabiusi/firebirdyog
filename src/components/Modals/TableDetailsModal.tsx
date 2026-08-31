import React, { useState, useEffect } from 'react';
import { TableDetails } from '../../types';
import { 
  Table, 
  Key, 
  Layers, 
  Zap, 
  Code, 
  X, 
  Copy, 
  Check, 
  RefreshCw 
} from 'lucide-react';

interface TableDetailsModalProps {
  tableName: string | null;
  onClose: () => void;
}

export const TableDetailsModal: React.FC<TableDetailsModalProps> = ({
  tableName,
  onClose
}) => {
  const [details, setDetails] = useState<TableDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'columns' | 'indices' | 'triggers' | 'ddl'>('columns');
  const [copiedDdl, setCopiedDdl] = useState(false);

  useEffect(() => {
    if (!tableName) {
      setDetails(null);
      return;
    }

    const loadDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (window.electronAPI?.getTableDetails) {
          const res = await window.electronAPI.getTableDetails(tableName);
          if (res.success && res.data) {
            setDetails(res.data);
          } else {
            setError(res.error || 'Error al obtener detalles');
          }
        }
      } catch (err: any) {
        setError(err.message || 'Error inesperado');
      } finally {
        setIsLoading(false);
      }
    };

    loadDetails();
  }, [tableName]);

  if (!tableName) return null;

  const handleCopyDdl = () => {
    if (details?.ddl) {
      navigator.clipboard.writeText(details.ddl);
      setCopiedDdl(true);
      setTimeout(() => setCopiedDdl(false), 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-zinc-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20">
              <Table className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100 font-mono">Tabla: {tableName}</h3>
              <p className="text-[11px] text-zinc-400">Estructura de campos, índices, triggers y DDL</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-zinc-950/60 px-4 border-b border-zinc-800 text-xs">
          <button
            onClick={() => setActiveTab('columns')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'columns'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Columnas ({details?.columns.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('indices')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'indices'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Índices ({details?.indices.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('triggers')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'triggers'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Triggers ({details?.triggers.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('ddl')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'ddl'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>DDL Script</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-auto p-4 bg-zinc-900/60">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span className="text-xs">Consultando metadatos de {tableName}...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-950/40 border border-red-900 text-red-300 rounded-lg text-xs font-mono">
              {error}
            </div>
          ) : !details ? (
            <div className="text-center py-8 text-zinc-500 text-xs">No se encontraron detalles.</div>
          ) : (
            <>
              {/* Tab 1: Columns */}
              {activeTab === 'columns' && (
                <div className="border border-zinc-800 rounded-lg overflow-hidden font-mono text-xs select-text">
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                      <tr>
                        <th className="p-2 border-r border-zinc-800 w-10 text-center">#</th>
                        <th className="p-2 border-r border-zinc-800">Nombre de Columna</th>
                        <th className="p-2 border-r border-zinc-800">Tipo de Dato</th>
                        <th className="p-2 border-r border-zinc-800">Nullable</th>
                        <th className="p-2 border-r border-zinc-800">PK</th>
                        <th className="p-2">Valor por Defecto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {details.columns.map((col, idx) => (
                        <tr key={col.columnName} className="hover:bg-zinc-800/40">
                          <td className="p-2 border-r border-zinc-800 text-center text-zinc-500">{idx + 1}</td>
                          <td className="p-2 border-r border-zinc-800 font-semibold text-zinc-100 flex items-center gap-1.5">
                            {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-400 shrink-0" />}
                            <span>{col.columnName}</span>
                          </td>
                          <td className="p-2 border-r border-zinc-800 text-amber-300">{col.fieldType}</td>
                          <td className="p-2 border-r border-zinc-800">
                            {col.isNullable ? (
                              <span className="text-zinc-400">SÍ</span>
                            ) : (
                              <span className="text-rose-400 font-semibold">NO</span>
                            )}
                          </td>
                          <td className="p-2 border-r border-zinc-800">
                            {col.isPrimaryKey ? (
                              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] font-bold">
                                PK
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-2 text-zinc-400 truncate max-w-xs">{col.defaultValue || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Indices */}
              {activeTab === 'indices' && (
                <div className="border border-zinc-800 rounded-lg overflow-hidden font-mono text-xs select-text">
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                      <tr>
                        <th className="p-2 border-r border-zinc-800">Nombre del Índice</th>
                        <th className="p-2 border-r border-zinc-800">Único</th>
                        <th className="p-2">Campos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {details.indices.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-zinc-500 italic">
                            No hay índices explícitos registrados.
                          </td>
                        </tr>
                      ) : (
                        details.indices.map((idx) => (
                          <tr key={idx.name} className="hover:bg-zinc-800/40">
                            <td className="p-2 border-r border-zinc-800 font-semibold text-zinc-100">{idx.name}</td>
                            <td className="p-2 border-r border-zinc-800">
                              {idx.unique ? (
                                <span className="text-emerald-400 font-semibold">UNIQUE</span>
                              ) : (
                                <span className="text-zinc-500">DUP</span>
                              )}
                            </td>
                            <td className="p-2 text-amber-300">{idx.fields.join(', ')}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 3: Triggers */}
              {activeTab === 'triggers' && (
                <div className="border border-zinc-800 rounded-lg overflow-hidden font-mono text-xs select-text">
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                      <tr>
                        <th className="p-2 border-r border-zinc-800">Nombre del Trigger</th>
                        <th className="p-2 border-r border-zinc-800">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {details.triggers.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="p-4 text-center text-zinc-500 italic">
                            No hay triggers asociados a esta tabla.
                          </td>
                        </tr>
                      ) : (
                        details.triggers.map((trig) => (
                          <tr key={trig.name} className="hover:bg-zinc-800/40">
                            <td className="p-2 border-r border-zinc-800 font-semibold text-zinc-100">{trig.name}</td>
                            <td className="p-2">
                              {trig.inactive ? (
                                <span className="text-zinc-500">INACTIVO</span>
                              ) : (
                                <span className="text-emerald-400 font-semibold">ACTIVO</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 4: DDL */}
              {activeTab === 'ddl' && (
                <div className="relative">
                  <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs text-amber-200 overflow-auto select-text">
                    {details.ddl}
                  </pre>
                  <button
                    onClick={handleCopyDdl}
                    className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs border border-zinc-700 transition-colors"
                  >
                    {copiedDdl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedDdl ? 'Copiado' : 'Copiar DDL'}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
};
