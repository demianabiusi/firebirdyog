import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ObjectDependenciesResult, 
  ObjectDependencyItem 
} from '../../types';
import { 
  Table, 
  Eye, 
  Cog, 
  Zap, 
  Hash, 
  Tag, 
  AlertTriangle, 
  X, 
  RefreshCw, 
  Copy, 
  Check, 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  Play, 
  Code, 
  Network,
  ExternalLink,
  Layers,
  Link2
} from 'lucide-react';

interface ObjectDependenciesModalProps {
  objectName: string | null;
  objectType?: string;
  onClose: () => void;
  onSelectObjectSql?: (sql: string, executeImmediately?: boolean) => void;
  onEditObject?: (type: 'PROCEDURE' | 'TRIGGER' | 'VIEW' | 'TABLE', name: string) => void;
}

interface HistoryEntry {
  name: string;
  type?: string;
}

export const ObjectDependenciesModal: React.FC<ObjectDependenciesModalProps> = ({
  objectName,
  objectType = 'OBJECT',
  onClose,
  onSelectObjectSql,
  onEditObject
}) => {
  const [currentObject, setCurrentObject] = useState<{ name: string; type?: string } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const [data, setData] = useState<ObjectDependenciesResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab & Filter state
  const [activeTab, setActiveTab] = useState<'both' | 'dependsOn' | 'dependedOnBy'>('both');
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [copiedName, setCopiedName] = useState<string | null>(null);

  // Initialize or reset when objectName changes from props
  useEffect(() => {
    if (objectName) {
      setCurrentObject({ name: objectName, type: objectType });
      setHistory([{ name: objectName, type: objectType }]);
      setHistoryIndex(0);
      setSearchFilter('');
      setTypeFilter('ALL');
    } else {
      setCurrentObject(null);
      setHistory([]);
      setHistoryIndex(-1);
      setData(null);
    }
  }, [objectName, objectType]);

  // Fetch dependencies when currentObject changes
  const loadDependencies = useCallback(async (name: string, type?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      if (window.electronAPI?.getObjectDependencies) {
        const res = await window.electronAPI.getObjectDependencies(name, type);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error || 'Error al obtener dependencias');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión al obtener dependencias');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentObject?.name) {
      loadDependencies(currentObject.name, currentObject.type);
    }
  }, [currentObject, loadDependencies]);

  // History navigation (drilling down into dependencies)
  const navigateTo = (name: string, type?: string) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push({ name, type });
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    setCurrentObject({ name, type });
    setSearchFilter('');
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setCurrentObject(prev);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setCurrentObject(next);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedName(text);
    setTimeout(() => setCopiedName(null), 1500);
  };

  if (!objectName && !currentObject) return null;

  // Icon & color helper by object type
  const getTypeBadge = (type: string) => {
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'TABLE':
        return {
          label: 'TABLA',
          icon: <Table className="w-3.5 h-3.5" />,
          bgColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
        };
      case 'VIEW':
        return {
          label: 'VISTA',
          icon: <Eye className="w-3.5 h-3.5" />,
          bgColor: 'bg-teal-500/10 text-teal-400 border-teal-500/30'
        };
      case 'PROCEDURE':
        return {
          label: 'PROCEDIMIENTO',
          icon: <Cog className="w-3.5 h-3.5" />,
          bgColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        };
      case 'TRIGGER':
        return {
          label: 'TRIGGER',
          icon: <Zap className="w-3.5 h-3.5" />,
          bgColor: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
        };
      case 'GENERATOR':
      case 'SEQUENCE':
        return {
          label: 'GENERADOR',
          icon: <Hash className="w-3.5 h-3.5" />,
          bgColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30'
        };
      case 'DOMAIN':
        return {
          label: 'DOMINIO',
          icon: <Tag className="w-3.5 h-3.5" />,
          bgColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
        };
      case 'EXCEPTION':
        return {
          label: 'EXCEPCIÓN',
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
          bgColor: 'bg-red-500/10 text-red-400 border-red-500/30'
        };
      default:
        return {
          label: t || 'OBJETO',
          icon: <Layers className="w-3.5 h-3.5" />,
          bgColor: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
        };
    }
  };

  const currentTypeBadge = getTypeBadge(data?.objectType || currentObject?.type || 'OBJECT');

  // Filter items
  const filterList = (list: ObjectDependencyItem[] = []) => {
    const q = searchFilter.trim().toLowerCase();
    return list.filter(item => {
      if (typeFilter !== 'ALL' && item.objectType.toUpperCase() !== typeFilter) {
        return false;
      }
      if (!q) return true;
      const matchName = item.objectName.toLowerCase().includes(q);
      const matchDetail = (item.detail || '').toLowerCase().includes(q);
      const matchField = (item.fieldName || '').toLowerCase().includes(q);
      const matchFields = (item.fields || []).some(f => f.toLowerCase().includes(q));
      return matchName || matchDetail || matchField || matchFields;
    });
  };

  const filteredDependsOn = filterList(data?.dependsOn || []);
  const filteredDependedOnBy = filterList(data?.dependedOnBy || []);

  const allAvailableTypes = useMemo(() => {
    const types = new Set<string>();
    data?.dependsOn?.forEach(d => types.add(d.objectType.toUpperCase()));
    data?.dependedOnBy?.forEach(d => types.add(d.objectType.toUpperCase()));
    return Array.from(types).sort();
  }, [data]);

  const renderDependencyRow = (item: ObjectDependencyItem, isDependsOn: boolean) => {
    const badge = getTypeBadge(item.objectType);
    const isNavigable = ['TABLE', 'VIEW', 'PROCEDURE', 'TRIGGER', 'GENERATOR', 'DOMAIN', 'EXCEPTION'].includes(
      item.objectType.toUpperCase()
    );

    return (
      <div 
        key={`${item.objectType}:${item.objectName}:${item.fieldName || ''}`}
        className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-800/40 transition-colors group"
      >
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {/* Badge Icon */}
          <div className={`p-1.5 rounded-md border shrink-0 mt-0.5 ${badge.bgColor}`}>
            {badge.icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${badge.bgColor}`}>
                {badge.label}
              </span>
              
              {isNavigable ? (
                <button
                  onClick={() => navigateTo(item.objectName, item.objectType)}
                  className="text-xs font-mono font-bold text-zinc-100 hover:text-amber-400 hover:underline flex items-center gap-1 transition-colors text-left"
                  title="Click para ver dependencias de este objeto"
                >
                  <span>{item.objectName}</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-zinc-400 transition-opacity" />
                </button>
              ) : (
                <span className="text-xs font-mono font-bold text-zinc-200">
                  {item.objectName}
                </span>
              )}
            </div>

            {/* Context / Field / Detail */}
            {item.detail && (
              <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1 font-sans">
                <Link2 className="w-3 h-3 text-zinc-500 shrink-0" />
                <span className="truncate">{item.detail}</span>
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
          {/* Query first 100 for Table or View */}
          {(item.objectType.toUpperCase() === 'TABLE' || item.objectType.toUpperCase() === 'VIEW') && onSelectObjectSql && (
            <button
              onClick={() => onSelectObjectSql(`SELECT * FROM ${item.objectName} ROWS 100;`, true)}
              title="Consultar primeros 100"
              className="p-1 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700/60 rounded transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Edit / DDL for View, Procedure, Trigger, Table */}
          {['PROCEDURE', 'TRIGGER', 'VIEW', 'TABLE'].includes(item.objectType.toUpperCase()) && onEditObject && (
            <button
              onClick={() => onEditObject(item.objectType.toUpperCase() as any, item.objectName)}
              title="Ver DDL / Código"
              className="p-1 text-zinc-400 hover:text-blue-400 hover:bg-zinc-700/60 rounded transition-colors"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Copy Name */}
          <button
            onClick={() => handleCopy(item.objectName)}
            title="Copiar nombre"
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/60 rounded transition-colors"
          >
            {copiedName === item.objectName ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    );
  };

  const totalDependsOn = data?.dependsOn?.length || 0;
  const totalDependedOnBy = data?.dependedOnBy?.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden text-zinc-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3 min-w-0">
            {/* History Back/Forward */}
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg shrink-0">
              <button
                onClick={handleBack}
                disabled={historyIndex <= 0}
                title="Volver atrás en el historial"
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleForward}
                disabled={historyIndex >= history.length - 1}
                title="Avanzar en el historial"
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Current Object Icon & Badge */}
            <div className={`p-1.5 rounded-md border shrink-0 ${currentTypeBadge.bgColor}`}>
              {currentTypeBadge.icon}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${currentTypeBadge.bgColor}`}>
                  {currentTypeBadge.label}
                </span>
                <h3 className="text-sm font-bold text-zinc-100 font-mono truncate">
                  {currentObject?.name}
                </h3>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                Explorador de Dependencias de Firebird ({totalDependsOn} dependencias / {totalDependedOnBy} dependientes)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => currentObject && loadDependencies(currentObject.name, currentObject.type)}
              disabled={isLoading}
              title="Refrescar dependencias"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              title="Cerrar (Esc)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar: Search, Filter, Views */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-zinc-950/60 border-b border-zinc-800 text-xs">
          
          {/* Tab Selector */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg">
            <button
              onClick={() => setActiveTab('both')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'both'
                  ? 'bg-amber-500 text-black shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Vista Dividida
            </button>
            <button
              onClick={() => setActiveTab('dependsOn')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'dependsOn'
                  ? 'bg-amber-500 text-black shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Depende de</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'dependsOn' ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-300'
              }`}>
                {totalDependsOn}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('dependedOnBy')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'dependedOnBy'
                  ? 'bg-amber-500 text-black shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Utilizado por</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'dependedOnBy' ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-300'
              }`}>
                {totalDependedOnBy}
              </span>
            </button>
          </div>

          {/* Search and Type Filter */}
          <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtrar por nombre o campo..."
                className="w-full bg-zinc-900 border border-zinc-800 pl-8 pr-3 py-1 rounded-md text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-amber-500/60"
              />
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {allAvailableTypes.length > 0 && (
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-md text-xs text-zinc-300 focus:outline-hidden focus:border-amber-500/60"
              >
                <option value="ALL">Todos los tipos</option>
                {allAvailableTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 bg-zinc-950/20">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-2">
              <RefreshCw className="w-7 h-7 animate-spin text-amber-500" />
              <span className="text-xs">Consultando dependencias de {currentObject?.name}...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-950/30 border border-red-800/60 rounded-xl text-red-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-semibold text-red-300">Error al consultar dependencias</p>
                <p className="mt-1 text-red-400/90">{error}</p>
              </div>
            </div>
          ) : (
            <div className="h-full">
              {activeTab === 'both' ? (
                /* Split View */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                  
                  {/* Left Column: Depends On */}
                  <div className="flex flex-col bg-zinc-900/50 border border-zinc-800/80 rounded-xl overflow-hidden p-3.5">
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-zinc-800">
                      <div className="flex items-center gap-2">
                        <Network className="w-4 h-4 text-blue-400" />
                        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                          Depende de ({filteredDependsOn.length})
                        </h4>
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        Objetos que {currentObject?.name} necesita
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {filteredDependsOn.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500 text-xs">
                          {searchFilter || typeFilter !== 'ALL'
                            ? 'No hay dependencias que coincidan con el filtro.'
                            : 'Este objeto no depende de ningún otro elemento registrado.'}
                        </div>
                      ) : (
                        filteredDependsOn.map((item) => renderDependencyRow(item, true))
                      )}
                    </div>
                  </div>

                  {/* Right Column: Depended On By */}
                  <div className="flex flex-col bg-zinc-900/50 border border-zinc-800/80 rounded-xl overflow-hidden p-3.5">
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-zinc-800">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                          Utilizado por ({filteredDependedOnBy.length})
                        </h4>
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        Objetos que dependen de {currentObject?.name}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {filteredDependedOnBy.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500 text-xs">
                          {searchFilter || typeFilter !== 'ALL'
                            ? 'No hay dependientes que coincidan con el filtro.'
                            : 'Ningún otro objeto depende directamente de este elemento.'}
                        </div>
                      ) : (
                        filteredDependedOnBy.map((item) => renderDependencyRow(item, false))
                      )}
                    </div>
                  </div>

                </div>
              ) : activeTab === 'dependsOn' ? (
                /* Single List: Depends On */
                <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4">
                  <div className="pb-3 mb-3 border-b border-zinc-800">
                    <h4 className="text-sm font-bold text-zinc-200">
                      Objetos de los que depende {currentObject?.name} ({filteredDependsOn.length})
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Si alguno de estos objetos cambia o se elimina, {currentObject?.name} podría verse afectado.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {filteredDependsOn.length === 0 ? (
                      <div className="text-center py-16 text-zinc-500 text-xs">
                        No se encontraron dependencias para mostrar.
                      </div>
                    ) : (
                      filteredDependsOn.map((item) => renderDependencyRow(item, true))
                    )}
                  </div>
                </div>
              ) : (
                /* Single List: Depended On By */
                <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4">
                  <div className="pb-3 mb-3 border-b border-zinc-800">
                    <h4 className="text-sm font-bold text-zinc-200">
                      Objetos que dependen de {currentObject?.name} ({filteredDependedOnBy.length})
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Impacto directo: estos objetos requieren a {currentObject?.name} para su funcionamiento o integridad referencial.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {filteredDependedOnBy.length === 0 ? (
                      <div className="text-center py-16 text-zinc-500 text-xs">
                        No se encontraron objetos dependientes para mostrar.
                      </div>
                    ) : (
                      filteredDependedOnBy.map((item) => renderDependencyRow(item, false))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Haz clic en cualquier objeto vinculado para explorar sus dependencias interactivamente</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
