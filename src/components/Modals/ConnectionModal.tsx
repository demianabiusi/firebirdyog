import React, { useState, useEffect } from 'react';
import { ConnectionConfig } from '../../types';
import { 
  Database, 
  Server, 
  FolderOpen, 
  CheckCircle, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Save, 
  Zap, 
  X,
  Lock,
  User,
  Layers,
  Globe
} from 'lucide-react';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: ConnectionConfig) => Promise<void>;
  savedConnections: ConnectionConfig[];
  onRefreshConnections: () => void;
  onOpenCreateModal?: () => void;
  activeConfigId?: string;
}

const DEFAULT_CONFIG: ConnectionConfig = {
  id: '',
  name: 'Nueva Conexión Firebird',
  host: '127.0.0.1',
  port: 3050,
  database: '/var/lib/firebird/data/employee.fdb',
  user: 'SYSDBA',
  password: 'masterkey',
  role: '',
  charset: 'UTF8',
  dialect: 3
};

const COMMON_CHARSETS = [
  'UTF8',
  'ISO8859_1',
  'WIN1252',
  'NONE',
  'ASCII',
  'UNICODE_FSS',
  'DOS850'
];

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  savedConnections,
  onRefreshConnections,
  activeConfigId
}) => {
  const [selectedConfig, setSelectedConfig] = useState<ConnectionConfig>(DEFAULT_CONFIG);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; pingMs?: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTestResult(null);
      if (savedConnections.length > 0) {
        const found = savedConnections.find(c => c.id === activeConfigId) || savedConnections[0];
        setSelectedConfig({ ...found });
      } else {
        setSelectedConfig({ ...DEFAULT_CONFIG, id: 'conn_' + Date.now() });
      }
    }
  }, [isOpen, savedConnections, activeConfigId]);

  if (!isOpen) return null;

  const handleSelectExisting = (conn: ConnectionConfig) => {
    setSelectedConfig({ ...conn });
    setTestResult(null);
  };

  const handleAddNew = () => {
    const newConn: ConnectionConfig = {
      ...DEFAULT_CONFIG,
      id: 'conn_' + Date.now(),
      name: `Conexión ${savedConnections.length + 1}`
    };
    setSelectedConfig(newConn);
    setTestResult(null);
  };

  const handleBrowseFile = async () => {
    if (window.electronAPI?.selectDatabaseFile) {
      const file = await window.electronAPI.selectDatabaseFile();
      if (file) {
        setSelectedConfig(prev => ({ ...prev, database: file }));
      }
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      if (window.electronAPI?.testConnection) {
        const res = await window.electronAPI.testConnection(selectedConfig);
        if (res.success && res.data) {
          setTestResult({
            success: true,
            message: res.data.message,
            pingMs: res.data.pingMs
          });
        } else {
          setTestResult({
            success: false,
            message: res.error || 'Error al conectar'
          });
        }
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Fallo inesperado al probar conexión'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (window.electronAPI?.saveConnection) {
        await window.electronAPI.saveConnection(selectedConfig);
        onRefreshConnections();
      }
    } catch (err: any) {
      alert('Error guardando la conexión: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Seguro que deseas eliminar este perfil de conexión?')) return;
    try {
      if (window.electronAPI?.deleteConnection) {
        await window.electronAPI.deleteConnection(id);
        onRefreshConnections();
        if (selectedConfig.id === id) {
          handleAddNew();
        }
      }
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Auto-save before connecting
      if (window.electronAPI?.saveConnection) {
        await window.electronAPI.saveConnection(selectedConfig);
        onRefreshConnections();
      }
      await onConnect(selectedConfig);
      onClose();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Error al conectar'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-zinc-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Gestor de Conexiones Firebird</h2>
              <p className="text-xs text-zinc-400">Configura y administra tus bases de datos Firebird (2.5 / 3.0 / 4.0 / 5.0)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Master-Detail */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left List: Saved Profiles */}
          <div className="w-1/3 border-r border-zinc-800 bg-zinc-950/40 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Conexiones Guardadas</span>
                <button
                  onClick={handleAddNew}
                  className="flex items-center gap-1 text-xs bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 px-2 py-1 rounded transition-colors border border-amber-500/30"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nueva
                </button>
              </div>

              <div className="space-y-1.5 max-h-[48vh] overflow-y-auto pr-1">
                {savedConnections.map((conn) => {
                  const isSelected = selectedConfig.id === conn.id;
                  return (
                    <div
                      key={conn.id}
                      onClick={() => handleSelectExisting(conn)}
                      className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all border ${
                        isSelected 
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-200' 
                          : 'bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-800/60 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Server className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-400' : 'text-zinc-500'}`} />
                        <div className="truncate">
                          <div className="text-sm font-medium truncate">{conn.name}</div>
                          <div className="text-xs text-zinc-500 truncate">{conn.host}:{conn.port}</div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDelete(conn.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 rounded transition-opacity"
                        title="Eliminar perfil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-zinc-800/80 pt-3 space-y-2">
              {onOpenCreateModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCreateModal();
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear Nueva Base (.fdb)...</span>
                </button>
              )}
              <div className="text-[11px] text-zinc-500 text-center">
                Firebird Client v1.0 • Pure Wire Protocol
              </div>
            </div>
          </div>

          {/* Right: Form Configuration */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            
            {/* Profile Name */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Nombre de la Conexión</label>
              <input
                type="text"
                value={selectedConfig.name}
                onChange={(e) => setSelectedConfig({ ...selectedConfig, name: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                placeholder="Ej: Producción, Mi BD Local..."
              />
            </div>

            {/* Host & Port */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
                  <Server className="w-3.5 h-3.5 text-zinc-400" /> Host / Dirección IP
                </label>
                <input
                  type="text"
                  value={selectedConfig.host}
                  onChange={(e) => setSelectedConfig({ ...selectedConfig, host: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                  placeholder="127.0.0.1 o nombre de servidor"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Puerto</label>
                <input
                  type="number"
                  value={selectedConfig.port}
                  onChange={(e) => setSelectedConfig({ ...selectedConfig, port: parseInt(e.target.value) || 3050 })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                  placeholder="3050"
                />
              </div>
            </div>

            {/* Database Path / Alias */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-zinc-400" /> Ruta de la Base de Datos (.fdb / .gdb) o Alias
                </span>
                <span className="text-[11px] text-zinc-500">Ruta local o remota en el servidor</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={selectedConfig.database}
                  onChange={(e) => setSelectedConfig({ ...selectedConfig, database: e.target.value })}
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                  placeholder="/var/lib/firebird/data/test.fdb o C:\db\emp.fdb"
                />
                <button
                  type="button"
                  onClick={handleBrowseFile}
                  title="Examinar archivo local"
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg flex items-center gap-1.5 text-xs transition-colors"
                >
                  <FolderOpen className="w-4 h-4 text-amber-400" />
                  Examinar
                </button>
              </div>
            </div>

            {/* User & Password */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-zinc-400" /> Usuario
                </label>
                <input
                  type="text"
                  value={selectedConfig.user}
                  onChange={(e) => setSelectedConfig({ ...selectedConfig, user: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                  placeholder="SYSDBA"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-zinc-400" /> Contraseña
                </label>
                <input
                  type="password"
                  value={selectedConfig.password || ''}
                  onChange={(e) => setSelectedConfig({ ...selectedConfig, password: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                  placeholder="masterkey"
                />
              </div>
            </div>

            {/* Role, Charset & Dialect */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-zinc-400" /> Rol (Opcional)
                </label>
                <input
                  type="text"
                  value={selectedConfig.role || ''}
                  onChange={(e) => setSelectedConfig({ ...selectedConfig, role: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  placeholder="RDB$ADMIN"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-zinc-400" /> Charset
                </label>
                <select
                  value={selectedConfig.charset}
                  onChange={(e) => setSelectedConfig({ ...selectedConfig, charset: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                >
                  {COMMON_CHARSETS.map((cs) => (
                    <option key={cs} value={cs}>{cs}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Dialecto SQL</label>
                <select
                  value={selectedConfig.dialect || 3}
                  onChange={(e) => setSelectedConfig({ ...selectedConfig, dialect: parseInt(e.target.value) || 3 })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                >
                  <option value={3}>Dialect 3 (Estándar)</option>
                  <option value={1}>Dialect 1 (Legacy)</option>
                </select>
              </div>
            </div>

            {/* Test result message */}
            {testResult && (
              <div
                className={`p-3 rounded-lg border flex items-start gap-2.5 text-xs ${
                  testResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/40 border-red-500/40 text-red-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">
                    {testResult.success ? 'Conexión Exitosa' : 'Error de Conexión'}
                    {testResult.pingMs !== undefined && ` (${testResult.pingMs} ms)`}
                  </div>
                  <div className="text-[11px] opacity-90 mt-0.5 whitespace-pre-wrap font-mono">
                    {testResult.message}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-zinc-950/80 border-t border-zinc-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || !selectedConfig.database}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 disabled:opacity-50 transition-colors"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-400 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? 'Probando...' : 'Probar Conexión'}
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar Perfil
            </button>
            <button
              type="button"
              onClick={handleConnect}
              disabled={isConnecting || !selectedConfig.database}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold text-xs disabled:opacity-50 transition-all shadow-md hover:shadow-amber-500/20"
            >
              <Database className="w-4 h-4" />
              {isConnecting ? 'Conectando...' : 'Conectar Base de Datos'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
