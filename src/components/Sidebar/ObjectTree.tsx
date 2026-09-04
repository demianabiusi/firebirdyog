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
  Layers,
  Check
} from 'lucide-react';

interface SchemaObjects {
  tables: string[];
  views: string[];
  procedures: { name: string; inputs: number; outputs: number; inputParams?: string[] }[];
  triggers: { name: string; table: string; inactive: boolean }[];
  generators: string[];
  domains: string[];
  exceptions: string[];
}

interface ObjectTreeProps {
  objects: SchemaObjects | null;
  isLoading: boolean;
  onRefresh: () => void;
  onSelectObjectSql: (sql: string, executeImmediately?: boolean) => void;
  onShowTableDetails: (tableName: string) => void;
  onEditObject: (type: 'PROCEDURE' | 'TRIGGER' | 'VIEW' | 'TABLE', name: string) => void;
  onCreateTable?: () => void;
  onDesignTable?: (tableName: string) => void;
  onCreateProcedure?: () => void;
  onCreateView?: () => void;
  onCreateTrigger?: () => void;
  databaseName?: string;
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
      .filter((p): p is { name: string; inputs: number; outputs: number } => Boolean(p && typeof p.name === 'string'))
      .filter(p => p.name.toLowerCase().includes(filterText));
  }, [objects?.procedures, filterText]);

  const filteredTriggers = useMemo(() => {
    if (!objects?.triggers || !Array.isArray(objects.triggers)) return [];
    return objects.triggers
      .filter((t): t is { name: string; table: string; inactive: boolean } => Boolean(t && typeof t.name === 'string'))
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
            <div className="ml-4 pl-1.5 border-l border-zinc-800 space-y-0.5 mt-0.5">
              {filteredTables.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1 pl-2 italic">Sin tablas</div>
              ) : (
                filteredTables.map((table) => (
                  <div
                    key={table}
                    onContextMenu={(e) => openContextMenu(e, 'TABLE', table)}
                    className="group flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-zinc-100 transition-colors"
                  >
                    <div
                      className="flex items-center gap-2 min-w-0 flex-1 truncate"
                      onClick={() => onSelectObjectSql(`SELECT * FROM ${table} ROWS 100;`, true)}
                      title={`Clic: consultar | Clic derecho: menú contextual`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      <span className="truncate font-mono text-[11.5px]">{table}</span>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                ))
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
            <div className="ml-4 pl-1.5 border-l border-zinc-800 space-y-0.5 mt-0.5">
              {filteredViews.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1 pl-2 italic">Sin vistas</div>
              ) : (
                filteredViews.map((view) => (
                  <div
                    key={view}
                    onContextMenu={(e) => openContextMenu(e, 'VIEW', view)}
                    className="group flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-teal-300 transition-colors"
                  >
                    <div
                      className="flex items-center gap-2 min-w-0 flex-1 truncate"
                      onClick={() => onSelectObjectSql(`SELECT * FROM ${view} ROWS 100;`, true)}
                      title={`Clic: consultar | Clic derecho: menú contextual`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                      <span className="truncate font-mono text-[11.5px]">{view}</span>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                ))
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
            <div className="ml-4 pl-1.5 border-l border-zinc-800 space-y-0.5 mt-0.5">
              {filteredProcedures.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1 pl-2 italic">Sin procedimientos</div>
              ) : (
                filteredProcedures.map((proc) => (
                  <div
                    key={proc.name}
                    onContextMenu={(e) => openContextMenu(e, 'PROCEDURE', proc.name, proc)}
                    className="group flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-amber-300 transition-colors"
                  >
                    <div
                      className="flex items-center gap-2 min-w-0 flex-1 truncate"
                      onClick={() => {
                        const { sql } = buildProcedureCall(proc);
                        onSelectObjectSql(sql, false);
                      }}
                      onDoubleClick={() => onEditObject('PROCEDURE', proc.name)}
                      title={`Clic: consultar plantilla | Clic derecho: menú contextual`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="truncate font-mono text-[11.5px]">{proc.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-zinc-500 mr-1 group-hover:hidden">
                        in:{proc.inputs} out:{proc.outputs}
                      </span>
                      
                      <div className="hidden group-hover:flex items-center gap-1">
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
                            // If procedure expects input parameters, don't auto-execute so user can fill them in
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
                ))
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
            <div className="ml-4 pl-1.5 border-l border-zinc-800 space-y-0.5 mt-0.5">
              {filteredTriggers.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1 pl-2 italic">Sin triggers</div>
              ) : (
                filteredTriggers.map((trig) => (
                  <div
                    key={trig.name}
                    onContextMenu={(e) => openContextMenu(e, 'TRIGGER', trig.name, trig)}
                    className="group flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-yellow-300 transition-colors"
                  >
                    <div
                      className="flex items-center gap-2 min-w-0 flex-1 truncate"
                      onClick={() => onEditObject('TRIGGER', trig.name)}
                      title={`Clic: editar trigger | Clic derecho: menú contextual`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${trig.inactive ? 'bg-zinc-600' : 'bg-yellow-500'} shrink-0`} />
                      <span className="truncate font-mono text-[11.5px]">{trig.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
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
                ))
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
                    title={`Clic: consultar valor actual | Clic derecho: opciones`}
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
                filteredDomains.map((domain) => (
                  <div
                    key={domain}
                    onContextMenu={(e) => openContextMenu(e, 'DOMAIN', domain)}
                    className="flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-pink-300 transition-colors"
                    title={`Clic derecho: opciones`}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />
                      <span className="truncate font-mono text-[11.5px]">{domain}</span>
                    </div>
                  </div>
                ))
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
            <div className="ml-4 pl-1.5 border-l border-zinc-800 space-y-0.5 mt-0.5">
              {filteredExceptions.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1 pl-2 italic">Sin excepciones</div>
              ) : (
                filteredExceptions.map((ex) => (
                  <div
                    key={ex}
                    onContextMenu={(e) => openContextMenu(e, 'EXCEPTION', ex)}
                    className="flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-rose-300 transition-colors"
                    title={`Clic derecho: opciones`}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span className="truncate font-mono text-[11.5px]">{ex}</span>
                    </div>
                  </div>
                ))
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
