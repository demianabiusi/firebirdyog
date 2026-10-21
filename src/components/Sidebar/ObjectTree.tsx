import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/I18nContext';
import { 
  Table as TableIcon, 
  Eye, 
  Cog, 
  Zap, 
  Hash, 
  Tag, 
  AlertTriangle, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  RefreshCw, 
  Database,
  Code,
  Info,
  Play,
  Plus,
  Sliders,
  Copy,
  Trash2,
  FileText,
  Check,
  Network,
  Key,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react';

interface ProcedureParamDetail {
  name: string;
  type: string;
}

interface TableColumnDetail {
  name: string;
  type: string;
  notNull: boolean;
  isPk: boolean;
}

interface SchemaObjects {
  tables: string[];
  views: string[];
  procedures: {
    name: string;
    inputs: number;
    outputs: number;
    inputParams?: string[];
    inputParamDetails?: ProcedureParamDetail[];
    outputParamDetails?: ProcedureParamDetail[];
  }[];
  triggers: {
    name: string;
    table: string;
    inactive: boolean;
    event?: string;
    sequence?: number;
  }[];
  generators: string[];
  domains: string[];
  exceptions: string[];
  columnsByTable?: Record<string, string[]>;
  tableColumnDetails?: Record<string, TableColumnDetail[]>;
  domainDetails?: Record<string, { type: string; notNull: boolean }>;
  exceptionDetails?: Record<string, string>;
}

interface ObjectTreeProps {
  objects: SchemaObjects | null;
  isLoading: boolean;
  onRefresh: () => void;
  onSelectObjectSql: (sql: string, executeImmediately?: boolean) => void;
  onShowTableDetails: (tableName: string) => void;
  onShowDependencies?: (objectName: string, objectType: string) => void;
  onEditObject: (type: 'PROCEDURE' | 'TRIGGER' | 'VIEW' | 'TABLE', name: string) => void;
  onCreateTable?: () => void;
  onDesignTable?: (tableName: string) => void;
  onCreateProcedure?: () => void;
  onCreateView?: () => void;
  onCreateTrigger?: () => void;
  databaseName?: string;
}

function formatCompactType(typeStr: string): string {
  if (!typeStr) return '';
  return typeStr
    .replace('BLOB SUB_TYPE TEXT', 'BLOB TEXT')
    .replace('BLOB SUB_TYPE BINARY', 'BLOB BIN')
    .replace('DOUBLE PRECISION', 'DOUBLE');
}

function buildProcedureCall(proc: { name: string; inputs: number; outputs: number; inputParams?: string[] }): { sql: string; hasInputParams: boolean } {
  const isSelectable = (proc.outputs || 0) > 0;
  const numInputs = proc.inputs || 0;
  
  let argsStr = '';
  if (numInputs > 0) {
    if (proc.inputParams && proc.inputParams.length > 0) {
      argsStr = `(${proc.inputParams.join(', ')})`;
    } else {
      const placeholders = Array.from({ length: numInputs }, (_, i) => `:P${i + 1}`);
      argsStr = `(${placeholders.join(', ')})`;
    }
  }

  const sql = isSelectable
    ? `SELECT * FROM ${proc.name}${argsStr};`
    : `EXECUTE PROCEDURE ${proc.name}${argsStr ? ` ${argsStr}` : ''};`;

  return { sql, hasInputParams: numInputs > 0 };
}

type ContextMenuItemType = 
  | 'TABLE' 
  | 'TABLE_SECTION' 
  | 'VIEW' 
  | 'VIEW_SECTION' 
  | 'PROCEDURE' 
  | 'PROCEDURE_SECTION' 
  | 'TRIGGER' 
  | 'TRIGGER_SECTION' 
  | 'GENERATOR' 
  | 'GENERATOR_SECTION' 
  | 'DOMAIN' 
  | 'EXCEPTION';

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  itemType: ContextMenuItemType;
  name: string;
  meta?: any;
}

export const ObjectTree: React.FC<ObjectTreeProps> = ({
  objects,
  isLoading,
  onRefresh,
  onSelectObjectSql,
  onShowTableDetails,
  onShowDependencies,
  onEditObject,
  onCreateTable,
  onDesignTable,
  onCreateProcedure,
  onCreateView,
  onCreateTrigger,
  databaseName
}) => {
  const { t } = useTranslation();
  const [searchFilter, setSearchFilter] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    tables: false,
    views: false,
    procedures: true,
    triggers: true,
    generators: true,
    domains: true,
    exceptions: true
  });
  const [expandedObjects, setExpandedObjects] = useState<Record<string, boolean>>({});

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    if (contextMenu?.isOpen) {
      window.addEventListener('mousedown', handleOutsideClick);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleObjectExpand = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    setExpandedObjects(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const openContextMenu = (e: React.MouseEvent, itemType: ContextMenuItemType, name: string = '', meta?: any) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 240;
    const menuHeight = 320;
    const clickX = e.clientX;
    const clickY = e.clientY;

    const x = clickX + menuWidth > window.innerWidth ? Math.max(10, clickX - menuWidth) : clickX;
    const y = clickY + menuHeight > window.innerHeight ? Math.max(10, clickY - menuHeight) : clickY;

    setContextMenu({
      isOpen: true,
      x,
      y,
      itemType,
      name,
      meta
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNotification(`Copiado: ${text}`);
    setTimeout(() => setCopiedNotification(null), 2000);
    setContextMenu(null);
  };

  const filterText = (searchFilter || '').toLowerCase().trim();

  const filteredTables = useMemo(() => {
    if (!objects?.tables || !Array.isArray(objects.tables)) return [];
    return objects.tables
      .filter((t): t is string => typeof t === 'string' && Boolean(t))
      .filter(t => t.toLowerCase().includes(filterText));
  }, [objects?.tables, filterText]);

  const filteredViews = useMemo(() => {
    if (!objects?.views || !Array.isArray(objects.views)) return [];
    return objects.views
      .filter((v): v is string => typeof v === 'string' && Boolean(v))
      .filter(v => v.toLowerCase().includes(filterText));
  }, [objects?.views, filterText]);

  const filteredProcedures = useMemo(() => {
    if (!objects?.procedures || !Array.isArray(objects.procedures)) return [];
    return objects.procedures
      .filter((p): p is SchemaObjects['procedures'][number] => Boolean(p && typeof p.name === 'string'))
      .filter(p => p.name.toLowerCase().includes(filterText));
  }, [objects?.procedures, filterText]);

  const filteredTriggers = useMemo(() => {
    if (!objects?.triggers || !Array.isArray(objects.triggers)) return [];
    return objects.triggers
      .filter((t): t is SchemaObjects['triggers'][number] => Boolean(t && typeof t.name === 'string'))
      .filter(t => 
        t.name.toLowerCase().includes(filterText) || 
        (typeof t.table === 'string' && t.table.toLowerCase().includes(filterText))
      );
  }, [objects?.triggers, filterText]);

  const filteredGenerators = useMemo(() => {
    if (!objects?.generators || !Array.isArray(objects.generators)) return [];
    return objects.generators
      .filter((g): g is string => typeof g === 'string' && Boolean(g))
      .filter(g => g.toLowerCase().includes(filterText));
  }, [objects?.generators, filterText]);

  const filteredDomains = useMemo(() => {
    if (!objects?.domains || !Array.isArray(objects.domains)) return [];
    return objects.domains
      .filter((d): d is string => typeof d === 'string' && Boolean(d))
      .filter(d => d.toLowerCase().includes(filterText));
  }, [objects?.domains, filterText]);

  const filteredExceptions = useMemo(() => {
    if (!objects?.exceptions || !Array.isArray(objects.exceptions)) return [];
    return objects.exceptions
      .filter((e): e is string => typeof e === 'string' && Boolean(e))
      .filter(e => e.toLowerCase().includes(filterText));
  }, [objects?.exceptions, filterText]);

  const displayDbName = useMemo(() => {
    if (!databaseName || typeof databaseName !== 'string') return 'Explorador Firebird';
    const clean = databaseName.replace(/\\/g, '/');
    return clean.split('/').filter(Boolean).pop() || 'Explorador Firebird';
  }, [databaseName]);

  const getColumnsForRelation = (relationName: string): TableColumnDetail[] => {
    const detailed = objects?.tableColumnDetails?.[relationName];
    if (detailed && detailed.length > 0) return detailed;
    const names = objects?.columnsByTable?.[relationName] || [];
    return names.map(name => ({ name, type: '', notNull: false, isPk: false }));
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-r border-zinc-800 select-none text-zinc-300 relative">
      
      {/* Header bar */}
      <div className="p-3 border-b border-zinc-800/80 bg-zinc-950/40 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Database className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-zinc-200 truncate uppercase tracking-wider">
              {displayDbName}
            </span>
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            title={t('common.refresh')}
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={t('sidebar.searchPlaceholder')}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 transition-colors"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 hover:text-zinc-300 px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
        
        {/* Section: Tables */}
        <div>
          <div
            onClick={() => toggleSection('tables')}
            onContextMenu={(e) => openContextMenu(e, 'TABLE_SECTION', t('sidebar.tables'))}
            className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-zinc-800/60 cursor-pointer text-zinc-300 font-medium group transition-colors"
          >
            <div className="flex items-center gap-1.5">
              {collapsedSections.tables ? (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              )}
              <TableIcon className="w-3.5 h-3.5 text-blue-400" />
              <span>{t('sidebar.tables')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {onCreateTable && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateTable();
                  }}
                  title={t('sidebar.createTable')}
                  className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-emerald-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
                {filteredTables.length}
              </span>
            </div>
          </div>

          {!collapsedSections.tables && (
            <div className="ml-3 pl-1.5 border-l border-zinc-800 space-y-0.5 mt-0.5">
              {filteredTables.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1 pl-2 italic">Sin tablas</div>
              ) : (
                filteredTables.map((table) => {
                  const objKey = `table:${table}`;
                  const isExpanded = Boolean(expandedObjects[objKey]);
                  const cols = getColumnsForRelation(table);

                  return (
                    <div key={table} className="space-y-0.5">
                      <div
                        onContextMenu={(e) => openContextMenu(e, 'TABLE', table)}
                        className="group flex items-center justify-between py-1 px-1.5 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-zinc-100 transition-colors"
                      >
                        <div className="flex items-center gap-1 min-w-0 flex-1 truncate">
                          <button
                            type="button"
                            onClick={(e) => toggleObjectExpand(e, objKey)}
                            title={isExpanded ? 'Ocultar campos' : `Mostrar campos (${cols.length})`}
                            className="p-0.5 rounded hover:bg-zinc-700/80 text-zinc-500 hover:text-blue-400 transition-colors shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3 text-blue-400" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </button>

                          <div
                            className="flex items-center gap-1.5 min-w-0 flex-1 truncate"
                            onClick={() => onSelectObjectSql(`SELECT * FROM ${table} ROWS 100;`, true)}
                            title="Clic: consultar primeros 100 | Flecha: ver campos | Clic derecho: menú"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            <span className="truncate font-mono text-[11.5px]">{table}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {cols.length > 0 && (
                            <span className="text-[9px] text-zinc-500 font-mono mr-0.5 group-hover:hidden">
                              {cols.length}
                            </span>
                          )}
                          <div className="hidden group-hover:flex items-center gap-0.5">
                            {onDesignTable && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDesignTable(table);
                                }}
                                title="Diseñar / Modificar Tabla"
                                className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-amber-400 rounded"
                              >
                                <Sliders className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onShowTableDetails(table);
                              }}
                              title="Ver Detalles e Índices"
                              className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-blue-300 rounded"
                            >
                              <Info className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectObjectSql(`SELECT * FROM ${table} ROWS 100;`, true);
                              }}
                              title="Consultar Primeros 100 Registros"
                              className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-emerald-400 rounded"
                            >
                              <Play className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="ml-3.5 pl-2 border-l border-blue-500/25 py-0.5 space-y-0.5 bg-zinc-950/35 rounded-r-md">
                          {cols.length === 0 ? (
                            <div className="text-[10px] text-zinc-500 italic px-1.5 py-0.5">
                              Sin columnas
                            </div>
                          ) : (
                            cols.map((col) => (
                              <div
                                key={col.name}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(col.name);
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  onSelectObjectSql(`SELECT ${col.name} FROM ${table} ROWS 100;`, true);
                                }}
                                title={`${col.name} — ${col.type}${col.notNull ? ' NOT NULL' : ''}${col.isPk ? ' (Primary Key)' : ''}\nClic: copiar nombre | Doble clic: consultar columna`}
                                className="flex items-center justify-between gap-2 px-1.5 py-0.5 rounded hover:bg-zinc-800/70 cursor-pointer text-[11px] group/col transition-colors"
                              >
                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                  {col.isPk ? (
                                    <Key className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                  ) : (
                                    <span className="w-1 h-1 rounded-full bg-zinc-600 group-hover/col:bg-blue-400 shrink-0 ml-0.5 mr-0.5" />
                                  )}
                                  <span className={`font-mono truncate ${col.isPk ? 'text-amber-200 font-medium' : 'text-zinc-300 group-hover/col:text-zinc-100'}`}>
                                    {col.name}
                                  </span>
                                  {col.notNull && (
                                    <span className="text-[9px] text-amber-500/80 font-bold shrink-0" title="NOT NULL">
                                      *
                                    </span>
                                  )}
                                </div>
                                {col.type && (
                                  <span className="text-[9.5px] font-mono text-blue-300/80 bg-zinc-900/90 border border-zinc-800 px-1.5 py-0.2 rounded shrink-0">
                                    {formatCompactType(col.type)}
                                  </span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Section: Views */}
        <div>
          <div
            onClick={() => toggleSection('views')}
            onContextMenu={(e) => openContextMenu(e, 'VIEW_SECTION', 'Vistas')}
            className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-zinc-800/60 cursor-pointer text-zinc-300 font-medium group transition-colors"
          >
            <div className="flex items-center gap-1.5">
              {collapsedSections.views ? (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              )}
              <Eye className="w-3.5 h-3.5 text-teal-400" />
              <span>Vistas</span>
            </div>
            <div className="flex items-center gap-1.5">
              {onCreateView && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateView();
                  }}
                  title="Crear Nueva Vista..."
                  className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-teal-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
                {filteredViews.length}
              </span>
            </div>
          </div>

          {!collapsedSections.views && (
            <div className="ml-3 pl-1.5 border-l border-zinc-800 space-y-0.5 mt-0.5">
              {filteredViews.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1 pl-2 italic">Sin vistas</div>
              ) : (
                filteredViews.map((view) => {
                  const objKey = `view:${view}`;
                  const isExpanded = Boolean(expandedObjects[objKey]);
                  const cols = getColumnsForRelation(view);

                  return (
                    <div key={view} className="space-y-0.5">
                      <div
                        onContextMenu={(e) => openContextMenu(e, 'VIEW', view)}
                        className="group flex items-center justify-between py-1 px-1.5 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-teal-300 transition-colors"
                      >
                        <div className="flex items-center gap-1 min-w-0 flex-1 truncate">
                          <button
                            type="button"
                            onClick={(e) => toggleObjectExpand(e, objKey)}
                            title={isExpanded ? 'Ocultar campos' : `Mostrar campos (${cols.length})`}
                            className="p-0.5 rounded hover:bg-zinc-700/80 text-zinc-500 hover:text-teal-400 transition-colors shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3 text-teal-400" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </button>

                          <div
                            className="flex items-center gap-1.5 min-w-0 flex-1 truncate"
                            onClick={() => onSelectObjectSql(`SELECT * FROM ${view} ROWS 100;`, true)}
                            title="Clic: consultar primeros 100 | Flecha: ver campos | Clic derecho: menú"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                            <span className="truncate font-mono text-[11.5px]">{view}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {cols.length > 0 && (
                            <span className="text-[9px] text-zinc-500 font-mono mr-0.5 group-hover:hidden">
                              {cols.length}
                            </span>
                          )}
                          <div className="hidden group-hover:flex items-center gap-0.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditObject('VIEW', view);
                              }}
                              title="Editar / Ver DDL de la Vista"
                              className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-teal-300 rounded"
                            >
                              <Code className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectObjectSql(`SELECT * FROM ${view} ROWS 100;`, true);
                              }}
                              title="Ejecutar SELECT"
                              className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-emerald-400 rounded"
                            >
                              <Play className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="ml-3.5 pl-2 border-l border-teal-500/25 py-0.5 space-y-0.5 bg-zinc-950/35 rounded-r-md">
                          {cols.length === 0 ? (
                            <div className="text-[10px] text-zinc-500 italic px-1.5 py-0.5">
                              Sin columnas
                            </div>
                          ) : (
                            cols.map((col) => (
                              <div
                                key={col.name}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(col.name);
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  onSelectObjectSql(`SELECT ${col.name} FROM ${view} ROWS 100;`, true);
                                }}
                                title={`${col.name} — ${col.type}\nClic: copiar nombre | Doble clic: consultar columna`}
                                className="flex items-center justify-between gap-2 px-1.5 py-0.5 rounded hover:bg-zinc-800/70 cursor-pointer text-[11px] group/col transition-colors"
                              >
                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                  <span className="w-1 h-1 rounded-full bg-zinc-600 group-hover/col:bg-teal-400 shrink-0 ml-0.5 mr-0.5" />
                                  <span className="font-mono truncate text-zinc-300 group-hover/col:text-zinc-100">
                                    {col.name}
                                  </span>
                                </div>
                                {col.type && (
                                  <span className="text-[9.5px] font-mono text-teal-300/80 bg-zinc-900/90 border border-zinc-800 px-1.5 py-0.2 rounded shrink-0">
                                    {formatCompactType(col.type)}
                                  </span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Section: Stored Procedures */}
        <div>
          <div
            onClick={() => toggleSection('procedures')}
            onContextMenu={(e) => openContextMenu(e, 'PROCEDURE_SECTION', 'Procedimientos')}
            className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-zinc-800/60 cursor-pointer text-zinc-300 font-medium group transition-colors"
          >
            <div className="flex items-center gap-1.5">
              {collapsedSections.procedures ? (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              )}
              <Cog className="w-3.5 h-3.5 text-amber-400" />
              <span>Procedimientos</span>
            </div>
            <div className="flex items-center gap-1.5">
              {onCreateProcedure && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateProcedure();
                  }}
                  title="Crear Nuevo Procedimiento Almacenado..."
                  className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-amber-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
                {filteredProcedures.length}
              </span>
            </div>
          </div>

          {!collapsedSections.procedures && (
            <div className="ml-3 pl-1.5 border-l border-zinc-800 space-y-0.5 mt-0.5">
              {filteredProcedures.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1 pl-2 italic">Sin procedimientos</div>
              ) : (
                filteredProcedures.map((proc) => {
                  const objKey = `proc:${proc.name}`;
                  const isExpanded = Boolean(expandedObjects[objKey]);
                  const inParams = proc.inputParamDetails || (proc.inputParams || []).map(p => ({ name: p, type: '' }));
                  const outParams = proc.outputParamDetails || [];

                  return (
                    <div key={proc.name} className="space-y-0.5">
                      <div
                        onContextMenu={(e) => openContextMenu(e, 'PROCEDURE', proc.name, proc)}
                        className="group flex items-center justify-between py-1 px-1.5 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-amber-300 transition-colors"
                      >
                        <div className="flex items-center gap-1 min-w-0 flex-1 truncate">
                          <button
                            type="button"
                            onClick={(e) => toggleObjectExpand(e, objKey)}
                            title={isExpanded ? 'Ocultar parámetros' : 'Mostrar parámetros de entrada y salida'}
                            className="p-0.5 rounded hover:bg-zinc-700/80 text-zinc-500 hover:text-amber-400 transition-colors shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3 text-amber-400" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </button>

                          <div
                            className="flex items-center gap-1.5 min-w-0 flex-1 truncate"
                            onClick={() => {
                              const { sql } = buildProcedureCall(proc);
                              onSelectObjectSql(sql, false);
                            }}
                            onDoubleClick={() => onEditObject('PROCEDURE', proc.name)}
                            title="Clic: cargar plantilla SQL | Doble clic: editar DDL | Flecha: ver parámetros"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span className="truncate font-mono text-[11.5px]">{proc.name}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[9px] text-zinc-500 mr-1 group-hover:hidden font-mono">
                            in:{proc.inputs} out:{proc.outputs}
                          </span>
                          
                          <div className="hidden group-hover:flex items-center gap-0.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditObject('PROCEDURE', proc.name);
                              }}
                              title="Editar / Ver Código (DDL)"
                              className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-amber-300 rounded"
                            >
                              <Code className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const { sql, hasInputParams } = buildProcedureCall(proc);
                                onSelectObjectSql(sql, !hasInputParams);
                              }}
                              title="Ejecutar"
                              className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-emerald-400 rounded"
                            >
                              <Play className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="ml-3.5 pl-2 border-l border-amber-500/25 py-1 space-y-1.5 bg-zinc-950/35 rounded-r-md">
                          {/* Input Parameters */}
                          <div>
                            <div className="flex items-center gap-1 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-sky-400/90">
                              <ArrowDownRight className="w-3 h-3 shrink-0" />
                              <span>Entrada (IN: {inParams.length})</span>
                            </div>
                            {inParams.length === 0 ? (
                              <div className="text-[10px] text-zinc-500 italic pl-5 py-0.5">
                                Sin parámetros de entrada
                              </div>
                            ) : (
                              <div className="space-y-0.5 mt-0.5">
                                {inParams.map((param) => (
                                  <div
                                    key={`in-${param.name}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(param.name);
                                    }}
                                    title={`Parámetro de entrada: ${param.name} (${param.type}) — Clic para copiar`}
                                    className="flex items-center justify-between gap-2 pl-4 pr-1.5 py-0.5 rounded hover:bg-zinc-800/70 cursor-pointer text-[11px] group/param transition-colors"
                                  >
                                    <span className="font-mono truncate text-zinc-300 group-hover/param:text-sky-200">
                                      {param.name}
                                    </span>
                                    {param.type && (
                                      <span className="text-[9.5px] font-mono text-sky-300/90 bg-sky-950/40 border border-sky-800/40 px-1.5 py-0.2 rounded shrink-0">
                                        {formatCompactType(param.type)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Output Parameters */}
                          <div>
                            <div className="flex items-center gap-1 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-emerald-400/90">
                              <ArrowUpRight className="w-3 h-3 shrink-0" />
                              <span>Salida (OUT: {outParams.length})</span>
                            </div>
                            {outParams.length === 0 ? (
                              <div className="text-[10px] text-zinc-500 italic pl-5 py-0.5">
                                Sin parámetros de salida
                              </div>
                            ) : (
                              <div className="space-y-0.5 mt-0.5">
                                {outParams.map((param) => (
                                  <div
                                    key={`out-${param.name}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(param.name);
                                    }}
                                    title={`Parámetro de salida: ${param.name} (${param.type}) — Clic para copiar`}
                                    className="flex items-center justify-between gap-2 pl-4 pr-1.5 py-0.5 rounded hover:bg-zinc-800/70 cursor-pointer text-[11px] group/param transition-colors"
                                  >
                                    <span className="font-mono truncate text-zinc-300 group-hover/param:text-emerald-200">
                                      {param.name}
                                    </span>
                                    {param.type && (
                                      <span className="text-[9.5px] font-mono text-emerald-300/90 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.2 rounded shrink-0">
                                        {formatCompactType(param.type)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Section: Triggers */}
        <div>
          <div
            onClick={() => toggleSection('triggers')}
            onContextMenu={(e) => openContextMenu(e, 'TRIGGER_SECTION', 'Triggers')}
            className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-zinc-800/60 cursor-pointer text-zinc-300 font-medium group transition-colors"
          >
            <div className="flex items-center gap-1.5">
              {collapsedSections.triggers ? (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              )}
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span>Triggers</span>
            </div>
            <div className="flex items-center gap-1.5">
              {onCreateTrigger && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateTrigger();
                  }}
                  title="Crear Nuevo Trigger..."
                  className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-yellow-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
                {filteredTriggers.length}
              </span>
            </div>
          </div>

          {!collapsedSections.triggers && (
            <div className="ml-3 pl-1.5 border-l border-zinc-800 space-y-0.5 mt-0.5">
              {filteredTriggers.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1 pl-2 italic">Sin triggers</div>
              ) : (
                filteredTriggers.map((trig) => {
                  const objKey = `trig:${trig.name}`;
                  const isExpanded = Boolean(expandedObjects[objKey]);

                  return (
                    <div key={trig.name} className="space-y-0.5">
                      <div
                        onContextMenu={(e) => openContextMenu(e, 'TRIGGER', trig.name, trig)}
                        className="group flex items-center justify-between py-1 px-1.5 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-yellow-300 transition-colors"
                      >
                        <div className="flex items-center gap-1 min-w-0 flex-1 truncate">
                          <button
                            type="button"
                            onClick={(e) => toggleObjectExpand(e, objKey)}
                            title={isExpanded ? 'Ocultar detalle' : 'Mostrar detalle del trigger'}
                            className="p-0.5 rounded hover:bg-zinc-700/80 text-zinc-500 hover:text-yellow-400 transition-colors shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3 text-yellow-400" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </button>

                          <div
                            className="flex items-center gap-1.5 min-w-0 flex-1 truncate"
                            onClick={() => onEditObject('TRIGGER', trig.name)}
                            title="Clic: editar trigger | Flecha: ver detalle | Clic derecho: menú"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${trig.inactive ? 'bg-zinc-600' : 'bg-yellow-500'} shrink-0`} />
                            <span className="truncate font-mono text-[11.5px]">{trig.name}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {trig.table && (
                            <span className="text-[9px] text-zinc-500 font-mono truncate max-w-[80px] group-hover:hidden">
                              {trig.table}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditObject('TRIGGER', trig.name);
                            }}
                            title="Editar / Ver Código (DDL)"
                            className="hidden group-hover:block p-1 hover:bg-zinc-700 text-zinc-400 hover:text-yellow-300 rounded"
                          >
                            <Code className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="ml-3.5 pl-2 border-l border-yellow-500/25 py-1 px-2 space-y-1 bg-zinc-950/35 rounded-r-md text-[10.5px]">
                          {trig.table && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-zinc-500">Tabla:</span>
                              <span className="font-mono text-zinc-200 truncate">{trig.table}</span>
                            </div>
                          )}
                          {trig.event && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-zinc-500">Evento:</span>
                              <span className="font-mono text-[9.5px] bg-yellow-950/40 text-yellow-300 border border-yellow-800/40 px-1.5 py-0.2 rounded">
                                {trig.event}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-zinc-500">Estado:</span>
                            <span className={`text-[9.5px] font-medium px-1.5 py-0.2 rounded ${
                              trig.inactive
                                ? 'bg-zinc-800 text-zinc-400'
                                : 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/40'
                            }`}>
                              {trig.inactive ? 'Inactivo' : `Activo (Pos. ${trig.sequence ?? 0})`}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Section: Generators / Sequences */}
        <div>
          <div
            onClick={() => toggleSection('generators')}
            onContextMenu={(e) => openContextMenu(e, 'GENERATOR_SECTION', 'Generadores')}
            className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-zinc-800/60 cursor-pointer text-zinc-300 font-medium group transition-colors"
          >
            <div className="flex items-center gap-1.5">
              {collapsedSections.generators ? (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              )}
              <Hash className="w-3.5 h-3.5 text-purple-400" />
              <span>Generadores / Secuencias</span>
            </div>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
              {filteredGenerators.length}
            </span>
          </div>

          {!collapsedSections.generators && (
            <div className="ml-4 pl-1.5 border-l border-zinc-800 space-y-0.5 mt-0.5">
              {filteredGenerators.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1 pl-2 italic">Sin generadores</div>
              ) : (
                filteredGenerators.map((gen) => (
                  <div
                    key={gen}
                    onContextMenu={(e) => openContextMenu(e, 'GENERATOR', gen)}
                    onClick={() => onSelectObjectSql(`SELECT GEN_ID(${gen}, 0) AS VALOR_ACTUAL FROM RDB$DATABASE;`, true)}
                    className="flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-purple-300 transition-colors"
                    title="Clic: consultar valor actual | Clic derecho: opciones"
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                      <span className="truncate font-mono text-[11.5px]">{gen}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Section: Domains */}
        <div>
          <div
            onClick={() => toggleSection('domains')}
            className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-zinc-800/60 cursor-pointer text-zinc-300 font-medium group transition-colors"
          >
            <div className="flex items-center gap-1.5">
              {collapsedSections.domains ? (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              )}
              <Tag className="w-3.5 h-3.5 text-pink-400" />
              <span>Dominios</span>
            </div>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
              {filteredDomains.length}
            </span>
          </div>

          {!collapsedSections.domains && (
            <div className="ml-4 pl-1.5 border-l border-zinc-800 space-y-0.5 mt-0.5">
              {filteredDomains.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1 pl-2 italic">Sin dominios personalizados</div>
              ) : (
                filteredDomains.map((domain) => {
                  const detail = objects?.domainDetails?.[domain];
                  return (
                    <div
                      key={domain}
                      onContextMenu={(e) => openContextMenu(e, 'DOMAIN', domain)}
                      onClick={() => copyToClipboard(domain)}
                      className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-pink-300 transition-colors"
                      title={detail ? `${domain}: ${detail.type}${detail.notNull ? ' NOT NULL' : ''} — Clic para copiar` : 'Clic derecho: opciones'}
                    >
                      <div className="flex items-center gap-2 min-w-0 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />
                        <span className="truncate font-mono text-[11.5px]">{domain}</span>
                        {detail?.notNull && (
                          <span className="text-[9px] text-pink-400 font-bold shrink-0" title="NOT NULL">*</span>
                        )}
                      </div>
                      {detail?.type && (
                        <span className="text-[9.5px] font-mono text-pink-300/80 bg-zinc-950/80 border border-zinc-800 px-1.5 py-0.2 rounded shrink-0">
                          {formatCompactType(detail.type)}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Section: Exceptions */}
        <div>
          <div
            onClick={() => toggleSection('exceptions')}
            className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-zinc-800/60 cursor-pointer text-zinc-300 font-medium group transition-colors"
          >
            <div className="flex items-center gap-1.5">
              {collapsedSections.exceptions ? (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              )}
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Excepciones</span>
            </div>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
              {filteredExceptions.length}
            </span>
          </div>

          {!collapsedSections.exceptions && (
            <div className="ml-3 pl-1.5 border-l border-zinc-800 space-y-0.5 mt-0.5">
              {filteredExceptions.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1 pl-2 italic">Sin excepciones</div>
              ) : (
                filteredExceptions.map((ex) => {
                  const objKey = `ex:${ex}`;
                  const isExpanded = Boolean(expandedObjects[objKey]);
                  const msg = objects?.exceptionDetails?.[ex];

                  return (
                    <div key={ex} className="space-y-0.5">
                      <div
                        onContextMenu={(e) => openContextMenu(e, 'EXCEPTION', ex)}
                        onClick={(e) => toggleObjectExpand(e, objKey)}
                        className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-rose-300 transition-colors"
                        title={msg ? `Mensaje: "${msg}" — Clic para ver/ocultar` : 'Clic derecho: opciones'}
                      >
                        <div className="flex items-center gap-1 min-w-0 truncate">
                          <span className="p-0.5 text-zinc-500 shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3 text-rose-400" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                          <span className="truncate font-mono text-[11.5px]">{ex}</span>
                        </div>
                      </div>
                      {isExpanded && msg && (
                        <div className="ml-3.5 pl-2 border-l border-rose-500/25 py-1 px-2 bg-zinc-950/35 rounded-r-md text-[10.5px] text-rose-200/80 italic break-words">
                          "{msg}"
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

      </div>

      {/* Floating Copied Notification */}
      {copiedNotification && (
        <div className="absolute bottom-3 left-3 right-3 bg-zinc-950 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-2 shadow-xl animate-in fade-in slide-in-from-bottom-2 z-50">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate font-mono">{copiedNotification}</span>
        </div>
      )}

      {/* Context Menu Popup */}
      {contextMenu?.isOpen && (
        <div
          ref={menuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 bg-zinc-900/95 border border-zinc-700/80 shadow-2xl rounded-xl backdrop-blur-md p-1 min-w-[220px] text-xs text-zinc-200 animate-in fade-in zoom-in-95 duration-100 divide-y divide-zinc-800/80"
          onClick={() => setContextMenu(null)}
        >
          {/* Header of Context Menu */}
          <div className="px-2.5 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span className="truncate max-w-[170px] font-mono text-zinc-300">
              {contextMenu.name || contextMenu.itemType}
            </span>
            <span className="text-zinc-500 text-[9px]">Menú</span>
          </div>

          {/* TABLE Actions */}
          {contextMenu.itemType === 'TABLE' && (
            <div className="py-1 space-y-0.5">
              <button
                onClick={() => onSelectObjectSql(`SELECT * FROM ${contextMenu.name} ROWS 100;`, true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-emerald-400 rounded-md text-left transition-colors"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Consultar Primeros 100</span>
              </button>

              <button
                onClick={() => onShowTableDetails(contextMenu.name)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-blue-400 rounded-md text-left transition-colors"
              >
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span>Ver Detalles e Índices...</span>
              </button>

              {onShowDependencies && (
                <button
                  onClick={() => {
                    onShowDependencies(contextMenu.name, 'TABLE');
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-cyan-400 rounded-md text-left transition-colors"
                >
                  <Network className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ver Dependencias...</span>
                </button>
              )}

              {onDesignTable && (
                <button
                  onClick={() => onDesignTable(contextMenu.name)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-amber-400 rounded-md text-left transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Diseñar / Modificar Tabla...</span>
                </button>
              )}

              <button
                onClick={() => copyToClipboard(contextMenu.name)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded-md text-left transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copiar Nombre de Tabla</span>
              </button>

              <div className="pt-1 mt-1 border-t border-zinc-800">
                <div className="px-2 py-0.5 text-[10px] text-zinc-500 font-semibold uppercase">Generar Plantilla SQL:</div>
                <button
                  onClick={() => onSelectObjectSql(`SELECT * FROM ${contextMenu.name};`, false)}
                  className="w-full flex items-center gap-2 px-2.5 py-1 hover:bg-zinc-800 text-zinc-300 hover:text-blue-300 rounded text-left"
                >
                  <FileText className="w-3 h-3 text-zinc-400" />
                  <span>SELECT * FROM ...</span>
                </button>
                <button
                  onClick={() => onSelectObjectSql(`INSERT INTO ${contextMenu.name} (/* campos */)\nVALUES (/* valores */);`, false)}
                  className="w-full flex items-center gap-2 px-2.5 py-1 hover:bg-zinc-800 text-zinc-300 hover:text-blue-300 rounded text-left"
                >
                  <FileText className="w-3 h-3 text-zinc-400" />
                  <span>INSERT INTO ...</span>
                </button>
                <button
                  onClick={() => onSelectObjectSql(`UPDATE ${contextMenu.name}\nSET CAMPO = VALOR\nWHERE CONDICION;`, false)}
                  className="w-full flex items-center gap-2 px-2.5 py-1 hover:bg-zinc-800 text-zinc-300 hover:text-blue-300 rounded text-left"
                >
                  <FileText className="w-3 h-3 text-zinc-400" />
                  <span>UPDATE ...</span>
                </button>
                <button
                  onClick={() => onSelectObjectSql(`DELETE FROM ${contextMenu.name}\nWHERE CONDICION;`, false)}
                  className="w-full flex items-center gap-2 px-2.5 py-1 hover:bg-zinc-800 text-red-300 hover:text-red-200 rounded text-left"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                  <span>DELETE FROM ...</span>
                </button>
              </div>
            </div>
          )}

          {/* TABLE SECTION Actions */}
          {contextMenu.itemType === 'TABLE_SECTION' && (
            <div className="py-1 space-y-0.5">
              {onCreateTable && (
                <button
                  onClick={onCreateTable}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-emerald-400 rounded-md text-left transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Crear Nueva Tabla...</span>
                </button>
              )}
              <button
                onClick={onRefresh}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded-md text-left transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                <span>Refrescar Lista de Tablas</span>
              </button>
            </div>
          )}

          {/* VIEW Actions */}
          {contextMenu.itemType === 'VIEW' && (
            <div className="py-1 space-y-0.5">
              <button
                onClick={() => onSelectObjectSql(`SELECT * FROM ${contextMenu.name} ROWS 100;`, true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-emerald-400 rounded-md text-left transition-colors"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Consultar Primeros 100</span>
              </button>

              {onShowDependencies && (
                <button
                  onClick={() => {
                    onShowDependencies(contextMenu.name, 'VIEW');
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-cyan-400 rounded-md text-left transition-colors"
                >
                  <Network className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ver Dependencias...</span>
                </button>
              )}

              <button
                onClick={() => onEditObject('VIEW', contextMenu.name)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-teal-400 rounded-md text-left transition-colors"
              >
                <Code className="w-3.5 h-3.5 text-teal-400" />
                <span>Editar / Ver DDL de la Vista</span>
              </button>

              <button
                onClick={() => copyToClipboard(contextMenu.name)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded-md text-left transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copiar Nombre</span>
              </button>

              <button
                onClick={() => onSelectObjectSql(`DROP VIEW ${contextMenu.name};`, false)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 text-red-300 hover:text-red-200 rounded-md text-left transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Eliminar (DROP VIEW)</span>
              </button>
            </div>
          )}

          {/* VIEW SECTION Actions */}
          {contextMenu.itemType === 'VIEW_SECTION' && (
            <div className="py-1 space-y-0.5">
              {onCreateView && (
                <button
                  onClick={onCreateView}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-teal-400 rounded-md text-left transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-teal-400" />
                  <span>Crear Nueva Vista...</span>
                </button>
              )}
              <button
                onClick={onRefresh}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded-md text-left transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                <span>Refrescar Lista</span>
              </button>
            </div>
          )}

          {/* PROCEDURE Actions */}
          {contextMenu.itemType === 'PROCEDURE' && (
            <div className="py-1 space-y-0.5">
              <button
                onClick={() => onEditObject('PROCEDURE', contextMenu.name)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-amber-400 rounded-md text-left transition-colors"
              >
                <Code className="w-3.5 h-3.5 text-amber-400" />
                <span>Editar / Ver Código (DDL)</span>
              </button>

              {onShowDependencies && (
                <button
                  onClick={() => {
                    onShowDependencies(contextMenu.name, 'PROCEDURE');
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-cyan-400 rounded-md text-left transition-colors"
                >
                  <Network className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ver Dependencias...</span>
                </button>
              )}

              <button
                onClick={() => {
                  const meta = contextMenu.meta || { name: contextMenu.name, inputs: 0, outputs: 0 };
                  const { sql, hasInputParams } = buildProcedureCall({
                    name: contextMenu.name,
                    inputs: meta.inputs || 0,
                    outputs: meta.outputs || 0,
                    inputParams: meta.inputParams
                  });
                  onSelectObjectSql(sql, !hasInputParams);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-emerald-400 rounded-md text-left transition-colors"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ejecutar Procedimiento</span>
              </button>

              <button
                onClick={() => copyToClipboard(contextMenu.name)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded-md text-left transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copiar Nombre</span>
              </button>

              <button
                onClick={() => onSelectObjectSql(`DROP PROCEDURE ${contextMenu.name};`, false)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 text-red-300 hover:text-red-200 rounded-md text-left transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Eliminar (DROP PROCEDURE)</span>
              </button>
            </div>
          )}

          {/* PROCEDURE SECTION Actions */}
          {contextMenu.itemType === 'PROCEDURE_SECTION' && (
            <div className="py-1 space-y-0.5">
              {onCreateProcedure && (
                <button
                  onClick={onCreateProcedure}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-amber-400 rounded-md text-left transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Crear Nuevo Procedimiento...</span>
                </button>
              )}
              <button
                onClick={onRefresh}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded-md text-left transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                <span>Refrescar Lista</span>
              </button>
            </div>
          )}

          {/* TRIGGER Actions */}
          {contextMenu.itemType === 'TRIGGER' && (
            <div className="py-1 space-y-0.5">
              <button
                onClick={() => onEditObject('TRIGGER', contextMenu.name)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-yellow-400 rounded-md text-left transition-colors"
              >
                <Code className="w-3.5 h-3.5 text-yellow-400" />
                <span>Editar / Ver Código (DDL)</span>
              </button>

              {onShowDependencies && (
                <button
                  onClick={() => {
                    onShowDependencies(contextMenu.name, 'TRIGGER');
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-cyan-400 rounded-md text-left transition-colors"
                >
                  <Network className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ver Dependencias...</span>
                </button>
              )}

              <button
                onClick={() => copyToClipboard(contextMenu.name)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded-md text-left transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copiar Nombre</span>
              </button>

              <button
                onClick={() => onSelectObjectSql(`DROP TRIGGER ${contextMenu.name};`, false)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 text-red-300 hover:text-red-200 rounded-md text-left transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Eliminar (DROP TRIGGER)</span>
              </button>
            </div>
          )}

          {/* TRIGGER SECTION Actions */}
          {contextMenu.itemType === 'TRIGGER_SECTION' && (
            <div className="py-1 space-y-0.5">
              {onCreateTrigger && (
                <button
                  onClick={onCreateTrigger}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-yellow-400 rounded-md text-left transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Crear Nuevo Trigger...</span>
                </button>
              )}
              <button
                onClick={onRefresh}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded-md text-left transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                <span>Refrescar Lista</span>
              </button>
            </div>
          )}

          {/* GENERATOR Actions */}
          {contextMenu.itemType === 'GENERATOR' && (
            <div className="py-1 space-y-0.5">
              <button
                onClick={() => onSelectObjectSql(`SELECT GEN_ID(${contextMenu.name}, 0) AS VALOR_ACTUAL FROM RDB$DATABASE;`, true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-purple-400 rounded-md text-left transition-colors"
              >
                <Play className="w-3.5 h-3.5 text-purple-400" />
                <span>Consultar Valor Actual (GEN_ID, 0)</span>
              </button>

              <button
                onClick={() => onSelectObjectSql(`SELECT GEN_ID(${contextMenu.name}, 1) AS NUEVO_VALOR FROM RDB$DATABASE;`, true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-purple-400 rounded-md text-left transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-purple-400" />
                <span>Incrementar en +1 (GEN_ID, 1)</span>
              </button>

              {onShowDependencies && (
                <button
                  onClick={() => {
                    onShowDependencies(contextMenu.name, 'GENERATOR');
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-cyan-400 rounded-md text-left transition-colors"
                >
                  <Network className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ver Dependencias...</span>
                </button>
              )}

              <button
                onClick={() => copyToClipboard(contextMenu.name)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded-md text-left transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copiar Nombre</span>
              </button>

              <button
                onClick={() => onSelectObjectSql(`DROP SEQUENCE ${contextMenu.name};`, false)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 text-red-300 hover:text-red-200 rounded-md text-left transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Eliminar (DROP SEQUENCE)</span>
              </button>
            </div>
          )}

          {/* DOMAIN / EXCEPTION Actions */}
          {(contextMenu.itemType === 'DOMAIN' || contextMenu.itemType === 'EXCEPTION') && (
            <div className="py-1 space-y-0.5">
              {onShowDependencies && (
                <button
                  onClick={() => {
                    onShowDependencies(contextMenu.name, contextMenu.itemType);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-cyan-400 rounded-md text-left transition-colors"
                >
                  <Network className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ver Dependencias...</span>
                </button>
              )}

              <button
                onClick={() => copyToClipboard(contextMenu.name)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded-md text-left transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copiar Nombre</span>
              </button>

              <button
                onClick={() => onSelectObjectSql(`DROP ${contextMenu.itemType === 'DOMAIN' ? 'DOMAIN' : 'EXCEPTION'} ${contextMenu.name};`, false)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 text-red-300 hover:text-red-200 rounded-md text-left transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Eliminar ({contextMenu.itemType === 'DOMAIN' ? 'DROP DOMAIN' : 'DROP EXCEPTION'})</span>
              </button>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
