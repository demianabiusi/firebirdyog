import React, { useState } from 'react';
import { ConnectionConfig } from '../../types';
import { useTranslation } from '../../i18n/I18nContext';
import { 
  Database, 
  Server, 
  FolderPlus, 
  AlertCircle, 
  CheckCircle, 
  X,
  Lock,
  User,
  Globe,
  Sliders,
  Sparkles
} from 'lucide-react';

interface CreateDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateAndConnect: (config: ConnectionConfig, autoConnect: boolean, autoSave: boolean) => Promise<void>;
}

const COMMON_CHARSETS = [
  'UTF8',
  'ISO8859_1',
  'WIN1252',
  'NONE',
  'ASCII',
  'UNICODE_FSS',
  'DOS850'
];

const PAGE_SIZES = [
  { value: 16384, label: '16384 bytes (16 KB - FB 3/4/5)' },
  { value: 8192, label: '8192 bytes (8 KB - FB 2.5/3)' },
  { value: 4096, label: '4096 bytes (4 KB - Legacy)' },
  { value: 32768, label: '32768 bytes (32 KB - FB 4/5)' }
];

export const CreateDatabaseModal: React.FC<CreateDatabaseModalProps> = ({
  isOpen,
  onClose,
  onCreateAndConnect
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('New Firebird DB');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(3050);
  const [database, setDatabase] = useState('/var/lib/firebird/data/nueva_base.fdb');
  const [user, setUser] = useState('SYSDBA');
  const [password, setPassword] = useState('masterkey');
  const [charset, setCharset] = useState('UTF8');
  const [pageSize, setPageSize] = useState(16384);
  const [dialect, setDialect] = useState(3);
  
  const [autoConnect, setAutoConnect] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBrowseLocation = async () => {
    if (window.electronAPI?.selectNewDatabaseFile) {
      const file = await window.electronAPI.selectNewDatabaseFile('nueva_base.fdb');
      if (file) {
        setDatabase(file);
        // Suggest a profile name based on file name
        const filename = file.split('/').pop()?.split('\\').pop()?.replace('.fdb', '') || '';
        if (filename && name === 'Mi Nueva Base de Datos') {
          setName(filename.toUpperCase());
        }
      }
    }
  };

  const handleCreate = async () => {
    if (!database.trim()) {
      setError('Debes especificar la ruta para el archivo .fdb de la base de datos.');
      return;
    }

    setIsCreating(true);
    setError(null);

    const config: ConnectionConfig = {
      id: 'conn_' + Date.now(),
      name: name.trim() || 'Firebird DB',
      host: host.trim() || '127.0.0.1',
      port: Number(port) || 3050,
      database: database.trim(),
      user: user.trim() || 'SYSDBA',
      password: password || 'masterkey',
      charset: charset || 'UTF8',
      pageSize: Number(pageSize) || 16384,
      dialect: Number(dialect) || 3,
      createdAt: new Date().toISOString()
    };

    try {
      if (window.electronAPI?.createDatabase) {
        const res = await window.electronAPI.createDatabase(config);
        if (!res.success) {
          throw new Error(res.error || 'Error al crear la base de datos en Firebird.');
        }

        if (autoSave && window.electronAPI?.saveConnection) {
          await window.electronAPI.saveConnection(config);
        }

        await onCreateAndConnect(config, autoConnect, autoSave);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Error desconocido al crear la base de datos.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-zinc-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">{t('createDbModal.title')}</h2>
              <p className="text-xs text-zinc-400">{t('createDbModal.subtitle')}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* Profile Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">{t('connectionModal.connectionName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              placeholder="Production DB, MySystem..."
            />
          </div>

          {/* Host & Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
                <Server className="w-3.5 h-3.5 text-zinc-400" /> {t('connectionModal.host')}
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-amber-500"
                placeholder="127.0.0.1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">{t('connectionModal.port')}</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 3050)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-amber-500"
                placeholder="3050"
              />
            </div>
          </div>

          {/* Database File Location */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-zinc-400" /> {t('createDbModal.databaseFile')}
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-amber-500"
                placeholder="/var/lib/firebird/data/new_database.fdb"
              />
              <button
                type="button"
                onClick={handleBrowseLocation}
                title={t('common.browse')}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg flex items-center gap-1.5 text-xs transition-colors"
              >
                <FolderPlus className="w-4 h-4 text-emerald-400" />
                {t('common.browse')}
              </button>
            </div>
          </div>

          {/* User & Password */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-zinc-400" /> {t('createDbModal.user')}
              </label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-amber-500"
                placeholder="SYSDBA"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-zinc-400" /> {t('createDbModal.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-amber-500"
                placeholder="masterkey"
              />
            </div>
          </div>

          {/* Page Size & Charset & Dialect */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-zinc-400" /> {t('createDbModal.pageSize')}
              </label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                {PAGE_SIZES.map((ps) => (
                  <option key={ps.value} value={ps.value}>
                    {ps.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-zinc-400" /> {t('createDbModal.charset')}
              </label>
              <select
                value={charset}
                onChange={(e) => setCharset(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
              >
                {COMMON_CHARSETS.map((cs) => (
                  <option key={cs} value={cs}>
                    {cs}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                {t('createDbModal.dialect')}
              </label>
              <select
                value={dialect}
                onChange={(e) => setDialect(parseInt(e.target.value) || 3)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value={3}>Dialect 3 (Default)</option>
                <option value={1}>Dialect 1 (Legacy)</option>
              </select>
            </div>
          </div>

          {/* Additional Options */}
          <div className="pt-2 space-y-2 border-t border-zinc-800 text-xs">
            <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoConnect}
                onChange={(e) => setAutoConnect(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500"
              />
              <span>{t('createDbModal.createAndConnect')}</span>
            </label>
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <div className="whitespace-pre-wrap font-mono">{error}</div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
          >
            {t('common.cancel')}
          </button>

          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating || !database.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs disabled:opacity-50 transition-all shadow-md shadow-emerald-600/20"
          >
            <Sparkles className={`w-4 h-4 ${isCreating ? 'animate-spin' : ''}`} />
            {isCreating ? t('common.loading') : t('createDbModal.createAndConnect')}
          </button>
        </div>

      </div>
    </div>
  );
};
