import React, { useState, useMemo } from 'react';
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
  Play
} from 'lucide-react';

interface SchemaObjects {
  tables: string[];
  views: string[];
  procedures: { name: string; inputs: number; outputs: number }[];
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
  databaseName?: string;
}

export const ObjectTree: React.FC<ObjectTreeProps> = ({
  objects,
  isLoading,
  onRefresh,
  onSelectObjectSql,
  onShowTableDetails,
  onEditObject,
  databaseName
}) => {
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

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
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

  const totalCount = 
    (filteredTables.length || 0) +
    (filteredViews.length || 0) +
    (filteredProcedures.length || 0) +
    (filteredTriggers.length || 0) +
    (filteredGenerators.length || 0);

  const displayDbName = useMemo(() => {
    if (!databaseName || typeof databaseName !== 'string') return 'Explorador Firebird';
    const clean = databaseName.replace(/\\/g, '/');
    return clean.split('/').filter(Boolean).pop() || 'Explorador Firebird';
  }, [databaseName]);

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-r border-zinc-800 select-none text-zinc-300">
      
      {/* Header bar */}
      <div className="p-3 border-b border-zinc-800/80 bg-zinc-950/40">
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
            title="Refrescar metadatos"
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
            placeholder="Filtrar objetos..."
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
            className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-zinc-800/60 cursor-pointer text-zinc-300 font-medium group transition-colors"
          >
            <div className="flex items-center gap-1.5">
              {collapsedSections.tables ? (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
              )}
              <TableIcon className="w-3.5 h-3.5 text-blue-400" />
              <span>Tablas</span>
            </div>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
              {filteredTables.length}
            </span>
          </div>

          {!collapsedSections.tables && (
            <div className="ml-4 pl-1.5 border-l border-zinc-800 space-y-0.5 mt-0.5">
              {filteredTables.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1 pl-2 italic">Sin tablas</div>
              ) : (
                filteredTables.map((table) => (
                  <div
                    key={table}
                    className="group flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-zinc-100 transition-colors"
                  >
                    <div
                      className="flex items-center gap-2 min-w-0 flex-1 truncate"
                      onClick={() => onSelectObjectSql(`SELECT * FROM ${table} ROWS 100;`, true)}
                      title={`Clic para consultar: SELECT * FROM ${table} ROWS 100;`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      <span className="truncate font-mono text-[11.5px]">{table}</span>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowTableDetails(table);
                        }}
                        title="Ver estructura y DDL"
                        className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-amber-300 rounded"
                      >
                        <Info className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectObjectSql(`SELECT * FROM ${table} ROWS 100;`, true);
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

        {/* Section: Views */}
        <div>
          <div
            onClick={() => toggleSection('views')}
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
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
              {filteredViews.length}
            </span>
          </div>

          {!collapsedSections.views && (
            <div className="ml-4 pl-1.5 border-l border-zinc-800 space-y-0.5 mt-0.5">
              {filteredViews.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1 pl-2 italic">Sin vistas</div>
              ) : (
                filteredViews.map((view) => (
                  <div
                    key={view}
                    className="group flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-teal-300 transition-colors"
                  >
                    <div
                      className="flex items-center gap-2 min-w-0 flex-1 truncate"
                      onClick={() => onSelectObjectSql(`SELECT * FROM ${view} ROWS 100;`, true)}
                      title={`Clic para consultar: SELECT * FROM ${view} ROWS 100;`}
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
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
              {filteredProcedures.length}
            </span>
          </div>

          {!collapsedSections.procedures && (
            <div className="ml-4 pl-1.5 border-l border-zinc-800 space-y-0.5 mt-0.5">
              {filteredProcedures.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1 pl-2 italic">Sin procedimientos</div>
              ) : (
                filteredProcedures.map((proc) => (
                  <div
                    key={proc.name}
                    className="group flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-amber-300 transition-colors"
                  >
                    <div
                      className="flex items-center gap-2 min-w-0 flex-1 truncate"
                      onClick={() => {
                        if (proc.outputs > 0) {
                          onSelectObjectSql(`SELECT * FROM ${proc.name};`, false);
                        } else {
                          onSelectObjectSql(`EXECUTE PROCEDURE ${proc.name};`, false);
                        }
                      }}
                      onDoubleClick={() => onEditObject('PROCEDURE', proc.name)}
                      title={`Clic: consultar plantilla | Doble clic: editar código`}
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
                            if (proc.outputs > 0) {
                              onSelectObjectSql(`SELECT * FROM ${proc.name};`, true);
                            } else {
                              onSelectObjectSql(`EXECUTE PROCEDURE ${proc.name};`, true);
                            }
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
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
              {filteredTriggers.length}
            </span>
          </div>

          {!collapsedSections.triggers && (
            <div className="ml-4 pl-1.5 border-l border-zinc-800 space-y-0.5 mt-0.5">
              {filteredTriggers.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-1 pl-2 italic">Sin triggers</div>
              ) : (
                filteredTriggers.map((trig) => (
                  <div
                    key={trig.name}
                    className="group flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-yellow-300 transition-colors"
                  >
                    <div
                      className="flex items-center gap-2 min-w-0 flex-1 truncate"
                      onClick={() => onEditObject('TRIGGER', trig.name)}
                      title={`Clic para editar trigger ${trig.name}`}
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
                    onClick={() => onSelectObjectSql(`SELECT GEN_ID(${gen}, 0) AS VALOR_ACTUAL FROM RDB$DATABASE;`, true)}
                    className="flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-purple-300 transition-colors"
                    title={`Ver valor actual del generador ${gen}`}
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
                    className="flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-pink-300 transition-colors"
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
                filteredExceptions.map((exc) => (
                  <div
                    key={exc}
                    className="flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-800 cursor-pointer text-zinc-300 hover:text-rose-300 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span className="truncate font-mono text-[11.5px]">{exc}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>

      {/* Footer stats */}
      <div className="p-2.5 border-t border-zinc-800/80 bg-zinc-950/60 text-[11px] text-zinc-500 flex items-center justify-between">
        <span>Total objetos: <strong className="text-zinc-300 font-mono">{totalCount}</strong></span>
        <span className="text-[10px] text-amber-500/80 font-medium">Firebird DB</span>
      </div>

    </div>
  );
};
