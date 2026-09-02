import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n/I18nContext';
import { 
  Upload, 
  Database, 
  FileText, 
  FolderOpen, 
  Play, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  RefreshCw, 
  AlertTriangle,
  StopCircle,
  Clock,
  HardDrive
} from 'lucide-react';
import { ImportOptions, ImportProgress, ImportResult } from '../../types';

interface ImportDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  databaseName?: string;
}

export const ImportDatabaseModal: React.FC<ImportDatabaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  databaseName = 'DATABASE'
}) => {
  const { t } = useTranslation();
  const [filePath, setFilePath] = useState('');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileName, setFileName] = useState('');
  const [stopOnError, setStopOnError] = useState(true);
  const [ignoreExistingObjects, setIgnoreExistingObjects] = useState(true);

  // Execution state
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setResult(null);
    setIsImporting(false);
    setProgress(null);
    setFilePath('');
    setFileSize(null);
    setFileName('');
  }, [isOpen]);

  // Subscribe to progress events
  useEffect(() => {
    if (!isOpen || !window.electronAPI?.onImportProgress) return;

    const unsubscribe = window.electronAPI.onImportProgress((prog: ImportProgress) => {
      setProgress(prog);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleBrowseFile = async () => {
    try {
      if (window.electronAPI?.selectImportFile) {
        const selected = await window.electronAPI.selectImportFile();
        if (selected) {
          setFilePath(selected.filePath);
          setFileSize(selected.size);
          setFileName(selected.name);
          setError(null);
        }
      }
    } catch (err) {
      console.error('Error selecting import file:', err);
    }
  };

  const handleStartImport = async () => {
    if (!filePath.trim()) {
      setError('Debes seleccionar un archivo SQL para importar.');
      return;
    }

    setError(null);
    setResult(null);
    setIsImporting(true);

    const options: ImportOptions = {
      filePath: filePath.trim(),
      stopOnError,
      ignoreExistingObjects
    };

    try {
      if (window.electronAPI?.startImport) {
        const res = await window.electronAPI.startImport(options);
        if (!res.success) {
          throw new Error(res.error || 'Error durante la importación.');
        }
        setResult(res.data || null);
        onSuccess(); // Refresh schema in background
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancelImport = async () => {
    try {
      if (window.electronAPI?.cancelImport) {
        await window.electronAPI.cancelImport();
      }
    } catch (err) {
      console.error('Error cancelling import:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden text-zinc-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-100">
                  {t('importModal.title')}
                </h2>
                <span className="text-[10px] bg-blue-500/20 text-blue-400 font-mono font-bold px-2 py-0.5 rounded-full">
                  {t('importModal.tag')}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {t('importModal.subtitle')}
              </p>
            </div>
          </div>

          {!isImporting && (
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
          
          {/* Result Completed View */}
          {result ? (
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className={`p-6 rounded-xl border text-center space-y-3 ${
                result.errorsCount === 0 
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' 
                  : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
                  result.errorsCount === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {result.errorsCount === 0 ? <CheckCircle2 className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
                </div>

                <div>
                  <h3 className="text-base font-bold">
                    {result.errorsCount === 0 ? t('importModal.successTitle') : t('importModal.warningTitle')}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    <strong className="text-zinc-200 font-mono">{result.executedStatements}</strong> {t('importModal.statementsExecuted')}{' '}
                    <strong className="text-zinc-200 font-mono">{(result.durationMs / 1000).toFixed(2)}s</strong>.
                  </p>
                </div>
              </div>

              {/* Errors/Warnings list if any */}
              {result.errors.length > 0 && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                    <span>{t('importModal.logTitle')} ({result.errors.length}):</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1 font-mono text-[11px]">
                    {result.errors.map((err, idx) => (
                      <div 
                        key={idx} 
                        className={`p-2 rounded border ${
                          err.isWarning 
                            ? 'bg-amber-950/20 border-amber-500/30 text-amber-300' 
                            : 'bg-red-950/30 border-red-500/30 text-red-300'
                        }`}
                      >
                        <div className={`font-semibold ${err.isWarning ? 'text-amber-400' : 'text-red-400'}`}>
                          {err.isWarning ? '⚠️ ' + t('common.warning') : '❌ ' + t('common.error')} - {err.lineNumber} (#{err.statementIndex}):
                        </div>
                        <div className="text-zinc-400 text-[10px] truncate">{err.statementSnippet}</div>
                        <div className="mt-1">{err.error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold rounded-lg text-xs transition-colors"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* File Picker Card */}
              <div className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  {t('importModal.selectFile')}
                </label>
                
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={filePath}
                    readOnly
                    placeholder={t('importModal.noFileSelected')}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseFile}
                    disabled={isImporting}
                    className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-medium transition-colors shrink-0 disabled:opacity-50"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                    <span>{t('common.browse')}</span>
                  </button>
                </div>

                {fileSize !== null && (
                  <div className="flex items-center gap-4 text-xs text-zinc-400 pt-1">
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
                      {t('importModal.fileSize')} <strong className="text-amber-400 font-mono">{formatBytes(fileSize)}</strong>
                    </span>
                    <span className="truncate max-w-sm text-zinc-500 font-mono">{fileName}</span>
                  </div>
                )}
              </div>

              {/* Import Options */}
              <div className="p-4 bg-zinc-950/40 border border-zinc-800/80 rounded-xl space-y-3">
                <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  {t('importModal.optionsTitle')}
                </div>

                <label className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-900/60 cursor-pointer text-xs">
                  <div>
                    <span className="text-zinc-200 font-medium block">{t('importModal.ignoreExisting')}</span>
                    <span className="text-[11px] text-zinc-500">
                      {t('importModal.ignoreExistingDesc')}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={ignoreExistingObjects}
                    disabled={isImporting}
                    onChange={(e) => setIgnoreExistingObjects(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-900/60 cursor-pointer text-xs">
                  <div>
                    <span className="text-zinc-200 font-medium block">{t('importModal.stopOnError')}</span>
                    <span className="text-[11px] text-zinc-500">
                      {t('importModal.stopOnErrorDesc')}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={stopOnError}
                    disabled={isImporting}
                    onChange={(e) => setStopOnError(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-0"
                  />
                </label>
              </div>

              {/* Live Streaming Progress */}
              {isImporting && progress && (
                <div className="p-4 bg-zinc-950 border border-blue-500/30 rounded-xl space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-blue-400 flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {progress.message}
                    </span>
                    <span className="font-mono font-bold text-zinc-200">{progress.percentage}%</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full transition-all duration-150"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800 text-[11px]">
                    <div>
                      <span className="text-zinc-500 block">{t('importModal.processed')}</span>
                      <span className="font-mono font-semibold text-zinc-200">
                        {formatBytes(progress.bytesProcessed)} / {formatBytes(progress.totalBytes)}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block">{t('importModal.statements')}</span>
                      <span className="font-mono font-semibold text-emerald-400">
                        {progress.statementsExecuted.toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block">{t('importModal.errors')}</span>
                      <span className={`font-mono font-semibold ${progress.errorsCount > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                        {progress.errorsCount}
                      </span>
                    </div>
                  </div>

                  {progress.currentStatementSnippet && (
                    <div className="p-2 bg-zinc-900 border border-zinc-800 rounded font-mono text-[10px] text-zinc-400 truncate">
                      {progress.currentStatementSnippet}
                    </div>
                  )}
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg flex items-start gap-2.5 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <div className="whitespace-pre-wrap font-mono text-xs">{error}</div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        {!result && (
          <div className="px-6 py-3.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between shrink-0">
            <div className="text-xs text-zinc-500">
              {filePath ? fileName : t('importModal.noFileSelected')}
            </div>

            <div className="flex items-center gap-2.5">
              {isImporting ? (
                <button
                  type="button"
                  onClick={handleCancelImport}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-500/40 rounded-lg text-xs font-semibold transition-colors"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  <span>{t('importModal.cancelImport')}</span>
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
                    onClick={handleStartImport}
                    disabled={!filePath || isImporting}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition-all shadow-md shadow-blue-600/20 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{t('importModal.startImport')}</span>
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
