import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n/I18nContext';
import { 
  Download, 
  Database, 
  FileText, 
  CheckSquare, 
  Square, 
  FolderOpen, 
  Play, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Key, 
  Hash, 
  Cog, 
  Zap, 
  Eye, 
  Table, 
  Search, 
  RefreshCw, 
  ExternalLink 
} from 'lucide-react';
import { DumpOptions, DumpProgress } from '../../types';

interface DumpDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  databaseName?: string;
  tables: string[];
}

export const DumpDatabaseModal: React.FC<DumpDatabaseModalProps> = ({
  isOpen,
  onClose,
  databaseName = 'DATABASE',
  tables = []
}) => {
  const { t } = useTranslation();
  // Dump settings
  const [includeStructure, setIncludeStructure] = useState(true);
  const [includeData, setIncludeData] = useState(true);
  const [includeGenerators, setIncludeGenerators] = useState(true);
  const [includeForeignKeys, setIncludeForeignKeys] = useState(true);
  const [includeViews, setIncludeViews] = useState(true);
  const [includeProcedures, setIncludeProcedures] = useState(true);
  const [includeTriggers, setIncludeTriggers] = useState(true);
  const [batchCommitSize, setBatchCommitSize] = useState(500);

  // Table selection
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [tableSearch, setTableSearch] = useState('');

  // Destination path
  const [outputPath, setOutputPath] = useState('');

  // Running state
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<DumpProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ filePath: string; totalStatements: number; durationMs: number } | null>(null);

  // Initialize defaults on open
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setSuccessResult(null);
    setIsExporting(false);
    setProgress(null);
    setSelectedTables(tables);

    // Generate default output filename
    const cleanDb = databaseName.replace(/\\/g, '/').split('/').filter(Boolean).pop()?.replace(/\.[^/.]+$/, '') || 'firebird';
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const defaultName = `dump_${cleanDb}_${dateStr}.sql`;
    
    // Attempt default desktop / home path if empty
    setOutputPath(defaultName);
  }, [isOpen, databaseName, tables]);

  // Subscribe to progress events
  useEffect(() => {
    if (!isOpen || !window.electronAPI?.onDumpProgress) return;

    const unsubscribe = window.electronAPI.onDumpProgress((prog: DumpProgress) => {
      setProgress(prog);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  const filteredTables = tables.filter(t => t.toLowerCase().includes(tableSearch.toLowerCase().trim()));

  const handleSelectAllTables = () => {
    setSelectedTables(tables);
  };

  const handleDeselectAllTables = () => {
    setSelectedTables([]);
  };

  const toggleTable = (table: string) => {
    setSelectedTables(prev => 
      prev.includes(table) ? prev.filter(t => t !== table) : [...prev, table]
    );
  };

  const handleBrowseOutputFile = async () => {
    try {
      if (window.electronAPI?.selectDumpFile) {
        const selected = await window.electronAPI.selectDumpFile(outputPath);
        if (selected) {
          setOutputPath(selected);
        }
      }
    } catch (err) {
      console.error('Error selecting dump file:', err);
    }
  };

  const handleStartExport = async () => {
    if (!outputPath.trim()) {
      setError('Debes especificar la ruta de destino para el archivo .sql.');
      return;
    }

    if (includeData && selectedTables.length === 0 && tables.length > 0) {
      setError('Has seleccionado incluir datos pero no hay tablas marcadas para exportar.');
      return;
    }

    setError(null);
    setSuccessResult(null);
    setIsExporting(true);

    const options: DumpOptions = {
      outputPath: outputPath.trim(),
      includeStructure,
      includeData,
      includeGenerators,
      includeForeignKeys,
      includeViews,
      includeProcedures,
      includeTriggers,
      selectedTables,
      batchCommitSize
    };

    try {
      if (window.electronAPI?.startDump) {
        const res = await window.electronAPI.startDump(options);
        if (!res.success) {
          throw new Error(res.error || 'Error durante la exportación de la base de datos.');
        }
        setSuccessResult(res.data);
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleCancelExport = async () => {
    try {
      if (window.electronAPI?.cancelDump) {
        await window.electronAPI.cancelDump();
      }
    } catch (err) {
      console.error('Error cancelling dump:', err);
    }
  };

  const handleShowInFolder = async () => {
    if (successResult?.filePath && window.electronAPI?.showItemInFolder) {
      await window.electronAPI.showItemInFolder(successResult.filePath);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-zinc-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-100">
                  {t('dumpModal.title')}
                </h2>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 font-mono font-bold px-2 py-0.5 rounded-full">
                  {t('dumpModal.tag')}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {t('dumpModal.subtitle')}
              </p>
            </div>
          </div>

          {!isExporting && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Success Banner */}
          {successResult ? (
            <div className="p-6 bg-emerald-950/30 border border-emerald-500/40 rounded-xl text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-300">{t('dumpModal.successTitle')}</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  <strong className="text-emerald-400 font-mono">{successResult.totalStatements}</strong> {t('dumpModal.statementsGenerated')}{' '}
                  <strong className="text-zinc-200 font-mono">{(successResult.durationMs / 1000).toFixed(2)}s</strong>.
                </p>
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-amber-300/90 break-all select-text">
                {successResult.filePath}
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleShowInFolder}
                  className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-medium transition-colors"
                >
                  <FolderOpen className="w-4 h-4 text-amber-400" />
                  <span>{t('common.showInFolder')}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition-colors"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Output File Path Card */}
              <div className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  {t('dumpModal.destFile')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    disabled={isExporting}
                    placeholder="/path/to/firebird_dump.sql"
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseOutputFile}
                    disabled={isExporting}
                    className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-medium transition-colors shrink-0 disabled:opacity-50"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('common.browse')}</span>
                  </button>
                </div>
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-2 gap-6">
                
                {/* Left: Component Switches */}
                <div className="bg-zinc-950/40 p-4 border border-zinc-800/80 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
                    <Layers className="w-3.5 h-3.5" /> {t('dumpModal.components')}
                  </div>

                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-900/60 cursor-pointer text-xs">
                    <span className="flex items-center gap-2 text-zinc-200">
                      <Table className="w-4 h-4 text-blue-400" /> {t('dumpModal.structure')}
                    </span>
                    <input
                      type="checkbox"
                      checked={includeStructure}
                      disabled={isExporting}
                      onChange={(e) => setIncludeStructure(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-900/60 cursor-pointer text-xs">
                    <span className="flex items-center gap-2 text-zinc-200">
                      <FileText className="w-4 h-4 text-emerald-400" /> {t('dumpModal.data')}
                    </span>
                    <input
                      type="checkbox"
                      checked={includeData}
                      disabled={isExporting}
                      onChange={(e) => setIncludeData(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-900/60 cursor-pointer text-xs">
                    <span className="flex items-center gap-2 text-zinc-200">
                      <Hash className="w-4 h-4 text-purple-400" /> {t('dumpModal.generators')}
                    </span>
                    <input
                      type="checkbox"
                      checked={includeGenerators}
                      disabled={isExporting}
                      onChange={(e) => setIncludeGenerators(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-900/60 cursor-pointer text-xs">
                    <span className="flex items-center gap-2 text-zinc-200">
                      <Key className="w-4 h-4 text-amber-400" /> {t('dumpModal.foreignKeys')}
                    </span>
                    <input
                      type="checkbox"
                      checked={includeForeignKeys}
                      disabled={isExporting}
                      onChange={(e) => setIncludeForeignKeys(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-900/60 cursor-pointer text-xs">
                    <span className="flex items-center gap-2 text-zinc-200">
                      <Eye className="w-4 h-4 text-teal-400" /> {t('dumpModal.views')}
                    </span>
                    <input
                      type="checkbox"
                      checked={includeViews}
                      disabled={isExporting}
                      onChange={(e) => setIncludeViews(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-900/60 cursor-pointer text-xs">
                    <span className="flex items-center gap-2 text-zinc-200">
                      <Cog className="w-4 h-4 text-amber-400" /> {t('dumpModal.procedures')}
                    </span>
                    <input
                      type="checkbox"
                      checked={includeProcedures}
                      disabled={isExporting}
                      onChange={(e) => setIncludeProcedures(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-900/60 cursor-pointer text-xs">
                    <span className="flex items-center gap-2 text-zinc-200">
                      <Zap className="w-4 h-4 text-yellow-400" /> {t('dumpModal.triggers')}
                    </span>
                    <input
                      type="checkbox"
                      checked={includeTriggers}
                      disabled={isExporting}
                      onChange={(e) => setIncludeTriggers(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0"
                    />
                  </label>

                  {/* Batch commit size */}
                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-xs">
                    <span className="text-zinc-400">{t('dumpModal.commitEvery')}</span>
                    <select
                      value={batchCommitSize}
                      disabled={isExporting}
                      onChange={(e) => setBatchCommitSize(parseInt(e.target.value))}
                      className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                    >
                      <option value={100}>100 {t('grid.rows')}</option>
                      <option value={500}>500 {t('grid.rows')}</option>
                      <option value={1000}>1,000 {t('grid.rows')}</option>
                      <option value={5000}>5,000 {t('grid.rows')}</option>
                    </select>
                  </div>
                </div>

                {/* Right: Table Selection Grid */}
                <div className="bg-zinc-950/40 p-4 border border-zinc-800/80 rounded-xl flex flex-col h-[360px]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                      <Table className="w-3.5 h-3.5" /> {t('dumpModal.tablesTitle')} ({selectedTables.length}/{tables.length})
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={handleSelectAllTables}
                        disabled={isExporting}
                        className="text-amber-400 hover:underline disabled:opacity-50"
                      >
                        {t('common.all')}
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllTables}
                        disabled={isExporting}
                        className="text-zinc-400 hover:underline disabled:opacity-50"
                      >
                        {t('common.none')}
                      </button>
                    </div>
                  </div>

                  {/* Search box */}
                  <div className="relative mb-2 shrink-0">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder={t('dumpModal.filterTables')}
                      disabled={isExporting}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60"
                    />
                  </div>

                  {/* Tables list */}
                  <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/50 pr-1">
                    {filteredTables.length === 0 ? (
                      <div className="text-center text-zinc-500 text-xs py-8">
                        {tables.length === 0 ? t('dumpModal.noTables') : t('common.none')}
                      </div>
                    ) : (
                      filteredTables.map(table => {
                        const isSelected = selectedTables.includes(table);
                        return (
                          <div
                            key={table}
                            onClick={() => !isExporting && toggleTable(table)}
                            className={`flex items-center justify-between py-1.5 px-2 rounded cursor-pointer transition-colors ${
                              isSelected ? 'bg-amber-500/10 text-zinc-100 font-medium' : 'text-zinc-400 hover:bg-zinc-800/40'
                            }`}
                          >
                            <span className="font-mono text-xs truncate flex-1">{table}</span>
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-400 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-zinc-600 shrink-0" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

              {/* Progress & Status Card */}
              {isExporting && progress && (
                <div className="p-4 bg-zinc-950 border border-amber-500/30 rounded-xl space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-400 flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {progress.message}
                    </span>
                    <span className="font-mono font-bold text-zinc-200">{progress.percentage}%</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-200"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg flex items-start gap-2.5 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <div className="whitespace-pre-wrap font-mono">{error}</div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        {!successResult && (
          <div className="px-6 py-3.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between shrink-0">
            <div className="text-xs text-zinc-500">
              {tables.length > 0 ? `${selectedTables.length} / ${tables.length}` : t('dumpModal.noTables')}
            </div>

            <div className="flex items-center gap-2.5">
              {isExporting ? (
                <button
                  type="button"
                  onClick={handleCancelExport}
                  className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-500/40 rounded-lg text-xs font-semibold transition-colors"
                >
                  {t('dumpModal.cancelExport')}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
                  >
                    {t('common.cancel')}
                  </button>

                  <button
                    type="button"
                    onClick={handleStartExport}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-lg text-xs transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{t('dumpModal.startExport')}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
