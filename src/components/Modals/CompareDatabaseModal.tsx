import React, { useState, useEffect, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { useTranslation } from '../../i18n/I18nContext';
import { 
  ConnectionConfig, 
  CompareDiffItem, 
  CompareOptions, 
  CompareProgress, 
  CompareResult, 
  CompareItemCategory, 
  CompareItemStatus,
  MigrationExecutionResult 
} from '../../types';
import { 
  GitCompare, 
  ArrowLeftRight, 
  Database, 
  CheckSquare, 
  Square, 
  Search, 
  Play, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  Layers, 
  Copy, 
  Download, 
  ExternalLink, 
  RefreshCw, 
  Filter,
  Columns,
  Table,
  Eye,
  Cog,
  Zap,
  Key,
  Hash,
  ArrowRight,
  Code
} from 'lucide-react';

interface CompareDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedConnections: ConnectionConfig[];
  activeConfig: ConnectionConfig | null;
  onOpenInSqlEditor: (sql: string, title?: string) => void;
}

export const CompareDatabaseModal: React.FC<CompareDatabaseModalProps> = ({
  isOpen,
  onClose,
  savedConnections = [],
  activeConfig,
  onOpenInSqlEditor
}) => {
  const { t } = useTranslation();

  // Connection selection
  const [sourceId, setSourceId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');

  // Options
  const [compareMetadata, setCompareMetadata] = useState(true);
  const [compareData, setCompareData] = useState(true);
  const [maxRowsLimit, setMaxRowsLimit] = useState<number>(5000);

  // Comparing state
  const [isComparing, setIsComparing] = useState(false);
  const [progress, setProgress] = useState<CompareProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DIFFS_ONLY' | 'MISSING_TARGET' | 'DIFFERENT' | 'EQUAL'>('DIFFS_ONLY');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | CompareItemCategory>('ALL');

  // Items state (to track checkbox selections)
  const [diffItems, setDiffItems] = useState<CompareDiffItem[]>([]);
  const [selectedDetailItem, setSelectedDetailItem] = useState<CompareDiffItem | null>(null);

  // Script Modal state
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isExecutingMigration, setIsExecutingMigration] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{ executed: number; total: number } | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationExecutionResult | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Populate default connections on open
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setProgress(null);
    setCompareResult(null);
    setDiffItems([]);
    setSelectedDetailItem(null);
    setIsScriptModalOpen(false);
    setMigrationResult(null);

    // Default source: active connection or first saved connection
    if (activeConfig) {
      setSourceId(activeConfig.id);
      const other = savedConnections.find(c => c.id !== activeConfig.id);
      if (other) {
        setTargetId(other.id);
      } else {
        setTargetId('');
      }
    } else if (savedConnections.length > 0) {
      setSourceId(savedConnections[0].id);
      if (savedConnections.length > 1) {
        setTargetId(savedConnections[1].id);
      } else {
        setTargetId('');
      }
    }
  }, [isOpen, activeConfig, savedConnections]);

  // Subscribe to progress events
  useEffect(() => {
    if (!isOpen || !window.electronAPI?.onCompareProgress) return;

    const unsubCompare = window.electronAPI.onCompareProgress((p: CompareProgress) => {
      setProgress(p);
    });

    const unsubMigration = window.electronAPI.onMigrationProgress?.((p: { executed: number; total: number }) => {
      setMigrationProgress(p);
    });

    return () => {
      if (unsubCompare) unsubCompare();
      if (unsubMigration) unsubMigration();
    };
  }, [isOpen]);

  // Swap source & target
  const handleSwap = () => {
    const currentSrc = sourceId;
    setSourceId(targetId);
    setTargetId(currentSrc);
    // Reset comparison results on swap
    setCompareResult(null);
    setDiffItems([]);
    setSelectedDetailItem(null);
  };

  // Find connection objects
  const getConnById = (id: string): ConnectionConfig | undefined => {
    if (activeConfig && activeConfig.id === id) return activeConfig;
    return savedConnections.find(c => c.id === id);
  };

  const sourceConfig = getConnById(sourceId);
  const targetConfig = getConnById(targetId);

  // Start Comparison
  const handleStartCompare = async () => {
    if (!sourceConfig || !targetConfig) {
      setError(t('compareModal.selectBothError'));
      return;
    }

    if (sourceConfig.id === targetConfig.id || (sourceConfig.database === targetConfig.database && sourceConfig.host === targetConfig.host && sourceConfig.port === targetConfig.port)) {
      setError(t('compareModal.sameDbError'));
      return;
    }

    setError(null);
    setIsComparing(true);
    setCompareResult(null);
    setDiffItems([]);
    setSelectedDetailItem(null);

    try {
      const options: CompareOptions = {
        sourceConfig,
        targetConfig,
        compareMetadata,
        compareData,
        maxDataRowsPerTable: maxRowsLimit
      };

      const res = await window.electronAPI.startCompare(options);

      if (res.success && res.data) {
        setCompareResult(res.data);
        setDiffItems(res.data.items);
        if (res.data.items.length > 0) {
          // Select the first different/missing item by default for details view
          const firstDiff = res.data.items.find(i => i.status !== 'EQUAL') || res.data.items[0];
          setSelectedDetailItem(firstDiff);
        }
      } else {
        setError(res.error || 'Error desconocido al comparar bases de datos.');
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado al comparar bases de datos.');
    } finally {
      setIsComparing(false);
      setProgress(null);
    }
  };

  const handleCancelCompare = async () => {
    try {
      await window.electronAPI.cancelCompare();
    } catch (err) {
      console.warn('Error cancelling compare:', err);
    }
  };

  // Item toggle selection
  const handleToggleItem = (id: string) => {
    setDiffItems(prev =>
      prev.map(i => (i.id === id ? { ...i, selected: !i.selected } : i))
    );
  };

  const handleSelectAllMigratable = () => {
    setDiffItems(prev =>
      prev.map(i => (i.canMigrate ? { ...i, selected: true } : i))
    );
  };

  const handleDeselectAll = () => {
    setDiffItems(prev => prev.map(i => ({ ...i, selected: false })));
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return diffItems.filter(item => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.objectName.toLowerCase().includes(q);
        const matchesParent = item.parentTable ? item.parentTable.toLowerCase().includes(q) : false;
        const matchesDesc = item.description.toLowerCase().includes(q);
        if (!matchesName && !matchesParent && !matchesDesc) return false;
      }

      // Status filter
      if (statusFilter === 'DIFFS_ONLY' && item.status === 'EQUAL') return false;
      if (statusFilter === 'MISSING_TARGET' && item.status !== 'MISSING_IN_TARGET') return false;
      if (statusFilter === 'DIFFERENT' && item.status !== 'DIFFERENT') return false;
      if (statusFilter === 'EQUAL' && item.status !== 'EQUAL') return false;

      // Category filter
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;

      return true;
    });
  }, [diffItems, searchQuery, statusFilter, categoryFilter]);

  // Selected count
  const selectedCount = useMemo(() => {
    return diffItems.filter(i => i.selected && i.migrationSql.trim()).length;
  }, [diffItems]);

  // Generate Script
  const handleGenerateScript = async () => {
    if (selectedCount === 0 || !sourceConfig || !targetConfig) return;

    setIsGeneratingScript(true);
    setError(null);
    setMigrationResult(null);

    try {
      const selected = diffItems.filter(i => i.selected && i.migrationSql.trim());
      const res = await window.electronAPI.generateMigrationScript(
        selected,
        sourceConfig.name || sourceConfig.database,
        targetConfig.name || targetConfig.database
      );

      if (res.success && res.data) {
        setGeneratedScript(res.data);
        setIsScriptModalOpen(true);
      } else {
        setError(res.error || 'Error al generar el script de migración.');
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado al generar el script.');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Copy Script to Clipboard
  const handleCopyScript = () => {
    if (!generatedScript) return;
    navigator.clipboard.writeText(generatedScript);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Save Script to .sql file
  const handleSaveScript = async () => {
    if (!generatedScript) return;
    const cleanDb = targetConfig?.database.replace(/\\/g, '/').split('/').pop()?.replace(/\.[^/.]+$/, '') || 'sync';
    const defaultFilename = `sync_to_${cleanDb}_${Date.now()}.sql`;
    await window.electronAPI.saveSqlFile(generatedScript, defaultFilename);
  };

  // Open in SQL Editor Tab
  const handleOpenInEditor = () => {
    if (!generatedScript) return;
    onOpenInSqlEditor(generatedScript, `Sincronización a ${targetConfig?.name || 'Destino'}`);
    setIsScriptModalOpen(false);
    onClose();
  };

  // Execute Migration on Target Database
  const handleExecuteMigration = async () => {
    if (!targetConfig || !generatedScript) return;

    const confirmRun = window.confirm(
      `¿Estás seguro de que deseas ejecutar este script de sincronización directamente en la base de datos destino?\n\nDestino: ${targetConfig.name} (${targetConfig.database})\nCambios seleccionados: ${selectedCount}`
    );
    if (!confirmRun) return;

    setIsExecutingMigration(true);
    setMigrationResult(null);
    setMigrationProgress(null);

    try {
      const res = await window.electronAPI.executeMigration(targetConfig, generatedScript);
      if (res.success && res.data) {
        setMigrationResult(res.data);
      } else {
        alert(res.error || 'Error al ejecutar la migración.');
      }
    } catch (err: any) {
      alert('Error ejecutando migración: ' + err.message);
    } finally {
      setIsExecutingMigration(false);
      setMigrationProgress(null);
    }
  };

  if (!isOpen) return null;

  // Category Icon Helper
  const renderCategoryIcon = (category: CompareItemCategory) => {
    switch (category) {
      case 'TABLE':
        return <Table className="w-3.5 h-3.5 text-blue-400" />;
      case 'COLUMN':
        return <Columns className="w-3.5 h-3.5 text-sky-400" />;
      case 'PRIMARY_KEY':
        return <Key className="w-3.5 h-3.5 text-amber-400" />;
      case 'FOREIGN_KEY':
        return <Layers className="w-3.5 h-3.5 text-purple-400" />;
      case 'DATA':
        return <Database className="w-3.5 h-3.5 text-orange-400" />;
      case 'VIEW':
        return <Eye className="w-3.5 h-3.5 text-teal-400" />;
      case 'PROCEDURE':
        return <Cog className="w-3.5 h-3.5 text-violet-400" />;
      case 'TRIGGER':
        return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
      case 'GENERATOR':
        return <Hash className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: CompareItemStatus) => {
    switch (status) {
      case 'MISSING_IN_TARGET':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            {t('compareModal.statusMissingTarget')}
          </span>
        );
      case 'DIFFERENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {t('compareModal.statusDifferent')}
          </span>
        );
      case 'MISSING_IN_SOURCE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            {t('compareModal.statusMissingSource')}
          </span>
        );
      case 'EQUAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {t('compareModal.statusEqual')}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden text-zinc-100">
        
        {/* Header */}
        <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/15 text-amber-400 rounded-lg border border-amber-500/30 shadow-xs">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-100">{t('compareModal.title')}</h2>
                <span className="text-[10px] font-medium px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                  {t('compareModal.tag')}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {t('compareModal.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Database Selector & Options Bar */}
        <div className="p-4 bg-zinc-950/40 border-b border-zinc-800/80 shrink-0 flex flex-col gap-3">
          
          <div className="flex items-center gap-3">
            {/* Source Database Dropdown */}
            <div className="flex-1 bg-zinc-900/90 border border-zinc-800 rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  {t('compareModal.sourceDb')}
                </span>
                {activeConfig && sourceId === activeConfig.id && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                    {t('compareModal.activeConnection')}
                  </span>
                )}
              </div>
              <select
                value={sourceId}
                onChange={(e) => {
                  setSourceId(e.target.value);
                  setCompareResult(null);
                }}
                disabled={isComparing}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-hidden focus:border-amber-500"
              >
                <option value="">{t('compareModal.selectSource')}</option>
                {savedConnections.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.host}:{c.port} - {c.database})
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <button
              onClick={handleSwap}
              disabled={isComparing}
              title={t('compareModal.swap')}
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-amber-300 border border-zinc-700 rounded-lg transition-all hover:scale-105 active:scale-95 shrink-0"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>

            {/* Target Database Dropdown */}
            <div className="flex-1 bg-zinc-900/90 border border-zinc-800 rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  {t('compareModal.targetDb')}
                </span>
                {activeConfig && targetId === activeConfig.id && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                    {t('compareModal.activeConnection')}
                  </span>
                )}
              </div>
              <select
                value={targetId}
                onChange={(e) => {
                  setTargetId(e.target.value);
                  setCompareResult(null);
                }}
                disabled={isComparing}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-hidden focus:border-blue-500"
              >
                <option value="">{t('compareModal.selectTarget')}</option>
                {savedConnections.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.host}:{c.port} - {c.database})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Options & Action button row */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-5 text-xs text-zinc-300">
              <label className="flex items-center gap-2 cursor-pointer hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={compareMetadata}
                  onChange={(e) => setCompareMetadata(e.target.checked)}
                  disabled={isComparing}
                  className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500/20"
                />
                <span>{t('compareModal.compareMetadata')}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={compareData}
                  onChange={(e) => setCompareData(e.target.checked)}
                  disabled={isComparing}
                  className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500/20"
                />
                <span>{t('compareModal.compareData')}</span>
              </label>

              {compareData && (
                <div className="flex items-center gap-2 text-zinc-400">
                  <span>{t('compareModal.maxRowsLimit')}</span>
                  <select
                    value={maxRowsLimit}
                    onChange={(e) => setMaxRowsLimit(Number(e.target.value))}
                    disabled={isComparing}
                    className="bg-zinc-950 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-200 focus:outline-hidden"
                  >
                    <option value={1000}>1,000</option>
                    <option value={5000}>5,000</option>
                    <option value={10000}>10,000</option>
                    <option value={25000}>25,000</option>
                    <option value={50000}>50,000</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isComparing ? (
                <button
                  onClick={handleCancelCompare}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/40 rounded-lg text-xs font-semibold transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  {t('compareModal.cancelCompare')}
                </button>
              ) : (
                <button
                  onClick={handleStartCompare}
                  disabled={!sourceId || !targetId || sourceId === targetId}
                  className="flex items-center gap-2 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-bold rounded-lg text-xs transition-colors shadow-md shadow-amber-500/10"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {t('compareModal.startCompare')}
                </button>
              )}
            </div>
          </div>

          {/* Progress bar if running */}
          {isComparing && progress && (
            <div className="mt-1 p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-amber-400 font-medium flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {progress.message}
                </span>
                <span className="font-mono text-zinc-400">{progress.percentage}%</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-amber-500 h-full transition-all duration-200" 
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-2.5 bg-red-950/50 border border-red-500/40 rounded-lg text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

        </div>

        {/* Comparison Results Content */}
        {compareResult ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Stats Summary Ribbon */}
            <div className="px-5 py-2.5 bg-zinc-950/60 border-b border-zinc-800 flex items-center gap-3 overflow-x-auto shrink-0">
              <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs">
                <span className="text-zinc-400">{t('compareModal.statsTotal')}:</span>
                <span className="font-bold text-zinc-100">{compareResult.summary.totalItems}</span>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-950/30 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
                <span>{t('compareModal.statsEqual')}:</span>
                <span className="font-bold">{compareResult.summary.equalCount}</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1 bg-blue-950/30 border border-blue-500/30 rounded-lg text-xs text-blue-300">
                <span>{t('compareModal.statsMissingInTarget')}:</span>
                <span className="font-bold">{compareResult.summary.missingInTargetCount}</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1 bg-amber-950/30 border border-amber-500/30 rounded-lg text-xs text-amber-300">
                <span>{t('compareModal.statsDifferent')}:</span>
                <span className="font-bold">{compareResult.summary.differentCount}</span>
              </div>

              {compareResult.summary.missingInSourceCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-400">
                  <span>{t('compareModal.statsMissingInSource')}:</span>
                  <span className="font-bold text-zinc-300">{compareResult.summary.missingInSourceCount}</span>
                </div>
              )}

              {compareResult.summary.dataDiffCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1 bg-orange-950/30 border border-orange-500/30 rounded-lg text-xs text-orange-300">
                  <span>{t('compareModal.statsDataDiff')}:</span>
                  <span className="font-bold">{compareResult.summary.dataDiffCount}</span>
                </div>
              )}

              <div className="ml-auto text-[11px] text-zinc-500">
                Tiempo: {compareResult.durationMs} ms
              </div>
            </div>

            {/* Toolbar: Search, Filter Tabs & Select All */}
            <div className="px-5 py-2 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between gap-3 shrink-0 flex-wrap">
              
              {/* Search Box */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t('compareModal.filterSearch')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-amber-500/80"
                />
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
                <button
                  onClick={() => setStatusFilter('DIFFS_ONLY')}
                  className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                    statusFilter === 'DIFFS_ONLY'
                      ? 'bg-amber-500 text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {t('compareModal.filterDiffsOnly')}
                </button>
                <button
                  onClick={() => setStatusFilter('MISSING_TARGET')}
                  className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                    statusFilter === 'MISSING_TARGET'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {t('compareModal.filterMissingTarget')}
                </button>
                <button
                  onClick={() => setStatusFilter('DIFFERENT')}
                  className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                    statusFilter === 'DIFFERENT'
                      ? 'bg-amber-600 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {t('compareModal.filterDifferent')}
                </button>
                <button
                  onClick={() => setStatusFilter('EQUAL')}
                  className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                    statusFilter === 'EQUAL'
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {t('compareModal.filterEqual')}
                </button>
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                    statusFilter === 'ALL'
                      ? 'bg-zinc-700 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {t('compareModal.filterAll')}
                </button>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Filter className="w-3 h-3" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as any)}
                  className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-hidden"
                >
                  <option value="ALL">Todas las Categorías</option>
                  <option value="TABLE">Tablas</option>
                  <option value="COLUMN">Columnas</option>
                  <option value="DATA">Datos</option>
                  <option value="PRIMARY_KEY">Claves Primarias</option>
                  <option value="FOREIGN_KEY">Claves Foráneas</option>
                  <option value="VIEW">Vistas</option>
                  <option value="PROCEDURE">Procedimientos</option>
                  <option value="TRIGGER">Triggers</option>
                  <option value="GENERATOR">Generadores</option>
                  <option value="DOMAIN">Dominios</option>
                  <option value="EXCEPTION">Excepciones</option>
                </select>
              </div>

              {/* Selection actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllMigratable}
                  className="px-2 py-1 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded border border-amber-500/30 transition-colors"
                >
                  {t('compareModal.selectAllMigratable')}
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded border border-zinc-800 transition-colors"
                >
                  {t('compareModal.deselectAll')}
                </button>
              </div>

            </div>

            {/* Split View: Left List (60%), Right Diff Detail (40%) */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* Left: Table List */}
              <div className="w-3/5 border-r border-zinc-800 flex flex-col overflow-hidden bg-zinc-950/30">
                <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
                  {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-zinc-500 text-center">
                      <CheckCircle2 className="w-10 h-10 mb-2 text-zinc-600" />
                      <p className="text-xs">{t('compareModal.noResults')}</p>
                    </div>
                  ) : (
                    filteredItems.map(item => {
                      const isSelectedRow = selectedDetailItem?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedDetailItem(item)}
                          className={`px-4 py-2.5 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                            isSelectedRow
                              ? 'bg-amber-500/15 border-l-2 border-amber-500'
                              : 'hover:bg-zinc-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {item.canMigrate ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleItem(item.id);
                                }}
                                className="text-zinc-400 hover:text-amber-400 shrink-0"
                              >
                                {item.selected ? (
                                  <CheckSquare className="w-4 h-4 text-amber-500" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            ) : (
                              <div className="w-4 h-4 shrink-0" />
                            )}

                            <div className="shrink-0 p-1 bg-zinc-800 rounded border border-zinc-700/60" title={item.category}>
                              {renderCategoryIcon(item.category)}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-zinc-200 truncate">
                                  {item.objectName}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  [{item.category}]
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                                {item.description}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {renderStatusBadge(item.status)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right: Inspector / Diff & SQL Details */}
              <div className="w-2/5 flex flex-col bg-zinc-950/80 overflow-hidden">
                {selectedDetailItem ? (
                  <div className="flex-1 flex flex-col h-full overflow-hidden">
                    
                    {/* Item Details Header */}
                    <div className="p-3 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {renderCategoryIcon(selectedDetailItem.category)}
                        <span className="font-bold text-sm text-zinc-100 truncate">
                          {selectedDetailItem.objectName}
                        </span>
                      </div>
                      <div>
                        {renderStatusBadge(selectedDetailItem.status)}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
                      
                      {/* Description Card */}
                      <div className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                          Descripción
                        </span>
                        <p className="text-zinc-200">{selectedDetailItem.description}</p>
                      </div>

                      {/* Side by side comparison (Source vs Target) */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col">
                          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block mb-1">
                            {t('compareModal.sourceValue')}
                          </span>
                          <div className="font-mono text-[11px] text-zinc-300 bg-zinc-950 p-2 rounded border border-zinc-800 overflow-x-auto whitespace-pre-wrap max-h-44">
                            {selectedDetailItem.sourceValue || '(No definido / No existe)'}
                          </div>
                        </div>

                        <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col">
                          <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider block mb-1">
                            {t('compareModal.targetValue')}
                          </span>
                          <div className="font-mono text-[11px] text-zinc-300 bg-zinc-950 p-2 rounded border border-zinc-800 overflow-x-auto whitespace-pre-wrap max-h-44">
                            {selectedDetailItem.targetValue || '(No definido / No existe)'}
                          </div>
                        </div>
                      </div>

                      {/* Generated Migration SQL */}
                      {selectedDetailItem.migrationSql && (
                        <div className="flex-1 flex flex-col p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Code className="w-3.5 h-3.5" />
                              {t('compareModal.migrationSql')}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(selectedDetailItem.migrationSql);
                                alert(t('common.copied'));
                              }}
                              className="px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
                            >
                              Copiar SQL
                            </button>
                          </div>
                          <pre className="flex-1 font-mono text-[11px] text-zinc-300 bg-zinc-950 p-2.5 rounded border border-zinc-800 overflow-auto whitespace-pre-wrap min-h-[100px]">
                            {selectedDetailItem.migrationSql}
                          </pre>
                        </div>
                      )}

                    </div>

                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-zinc-500 text-center text-xs">
                    <Eye className="w-8 h-8 mb-2 text-zinc-700" />
                    <p>Selecciona un elemento de la lista para ver el diff detallado y el SQL de sincronización.</p>
                  </div>
                )}
              </div>

            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500 gap-3">
            <div className="p-4 bg-zinc-800/80 rounded-2xl border border-zinc-700/60 text-amber-500">
              <GitCompare className="w-10 h-10" />
            </div>
            <div className="max-w-md">
              <h3 className="text-sm font-semibold text-zinc-300 mb-1">
                Listo para comparar
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Selecciona una base de datos de origen y otra de destino arriba, activa las opciones deseadas y haz clic en &quot;Comparar Bases de Datos&quot;.
              </p>
            </div>
          </div>
        )}

        {/* Footer / Action Bar */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-400 flex items-center gap-2">
            {diffItems.length > 0 && (
              <>
                <span className="font-semibold text-amber-400">{selectedCount}</span>
                <span>{t('compareModal.selectedCount')}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold transition-colors"
            >
              {t('common.close')}
            </button>

            {diffItems.length > 0 && (
              <button
                onClick={handleGenerateScript}
                disabled={selectedCount === 0 || isGeneratingScript}
                className="flex items-center gap-2 px-5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-zinc-950 font-bold rounded-lg text-xs transition-colors shadow-md shadow-amber-500/10"
              >
                {isGeneratingScript ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                <span>{t('compareModal.generateScript')}</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Script Preview & Direct Execution Modal */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-xs p-6 animate-in fade-in duration-100">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden text-zinc-100">
            
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/15 text-emerald-400 rounded-lg border border-emerald-500/30">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">{t('compareModal.scriptModalTitle')}</h3>
                  <p className="text-xs text-zinc-400">
                    {t('compareModal.scriptModalSubtitle')} ({selectedCount} cambios)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsScriptModalOpen(false)}
                className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Editor Area */}
            <div className="flex-1 bg-zinc-950 overflow-hidden relative">
              <Editor
                language="sql"
                value={generatedScript}
                onChange={(val) => setGeneratedScript(val || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  readOnly: false
                }}
              />
            </div>

            {/* Migration Execution Results Banner (if ran) */}
            {migrationResult && (
              <div className={`p-3 border-t text-xs ${
                migrationResult.success
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {migrationResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                    )}
                    <span className="font-bold">
                      {migrationResult.success
                        ? t('compareModal.execSuccess')
                        : `Migración con ${migrationResult.errorsCount} errores`}
                    </span>
                    <span>
                      ({migrationResult.statementsExecuted} sentencias ejecutadas en {migrationResult.durationMs} ms)
                    </span>
                  </div>
                </div>
                {migrationResult.errors && migrationResult.errors.length > 0 && (
                  <div className="mt-2 max-h-28 overflow-y-auto space-y-1 bg-black/40 p-2 rounded font-mono text-[11px]">
                    {migrationResult.errors.map((e, idx) => (
                      <div key={idx} className="text-red-300">
                        • {e.statementSnippet}: {e.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Progress bar during execution */}
            {isExecutingMigration && (
              <div className="p-3 bg-zinc-950 border-t border-zinc-800 text-xs">
                <div className="flex items-center justify-between mb-1.5 text-amber-400">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    {t('compareModal.executing')}
                  </span>
                  {migrationProgress && (
                    <span className="font-mono">
                      {migrationProgress.executed} / {migrationProgress.total}
                    </span>
                  )}
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full transition-all duration-150" 
                    style={{
                      width: migrationProgress
                        ? `${Math.round((migrationProgress.executed / Math.max(1, migrationProgress.total)) * 100)}%`
                        : '50%'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Script Modal Actions */}
            <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyScript}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copySuccess ? t('common.copied') : t('compareModal.copyScript')}</span>
                </button>

                <button
                  onClick={handleSaveScript}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('compareModal.saveScript')}</span>
                </button>

                <button
                  onClick={handleOpenInEditor}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t('compareModal.openInEditor')}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsScriptModalOpen(false)}
                  className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  {t('common.close')}
                </button>

                <button
                  onClick={handleExecuteMigration}
                  disabled={isExecutingMigration || !generatedScript}
                  className="flex items-center gap-2 px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors shadow-md shadow-emerald-600/10"
                >
                  {isExecutingMigration ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                  <span>{t('compareModal.executeOnTarget')}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
