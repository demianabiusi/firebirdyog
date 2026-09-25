import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ConnectionConfig, 
  MonitoringData, 
  MonitoringAttachment, 
  MonitoringStatement, 
  MonitoringTransaction 
} from '../../types';
import { useTranslation } from '../../i18n/I18nContext';
import { 
  Activity, 
  X, 
  RefreshCw, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Database, 
  Users, 
  Terminal, 
  Zap, 
  Trash2, 
  ShieldAlert, 
  Copy, 
  Check, 
  ExternalLink,
  Layers,
  ArrowRight
} from 'lucide-react';

interface ServerMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeConfig: ConnectionConfig | null;
  onOpenInSqlEditor?: (sql: string, title?: string) => void;
}

export const ServerMonitorModal: React.FC<ServerMonitorModalProps> = ({
  isOpen,
  onClose,
  activeConfig,
  onOpenInSqlEditor
}) => {
  const { t } = useTranslation();

  const [data, setData] = useState<MonitoringData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'attachments' | 'statements' | 'transactions' | 'health'>('attachments');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(5000); // 5s default
  const [searchFilter, setSearchFilter] = useState('');
  const [statusActionMessage, setStatusActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Selected statement for detailed preview
  const [selectedStatement, setSelectedStatement] = useState<MonitoringStatement | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Fetch monitoring data
  const loadData = useCallback(async (silent = false) => {
    if (!isOpen) return;
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      if (window.electronAPI?.getMonitoringData) {
        const res = await window.electronAPI.getMonitoringData();
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error || 'No se pudieron obtener los datos de monitoreo.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error al consultar tablas MON$ de Firebird.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [isOpen]);

  // Initial load
  useEffect(() => {
    if (isOpen) {
      loadData(false);
    } else {
      setData(null);
      setError(null);
      setSelectedStatement(null);
    }
  }, [isOpen, loadData]);

  // Auto-refresh interval
  useEffect(() => {
    if (!isOpen || autoRefreshInterval <= 0) return;

    const timer = setInterval(() => {
      loadData(true);
    }, autoRefreshInterval);

    return () => clearInterval(timer);
  }, [isOpen, autoRefreshInterval, loadData]);

  // Clear action message after 4s
  useEffect(() => {
    if (statusActionMessage) {
      const timer = setTimeout(() => setStatusActionMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusActionMessage]);

  // Kill Statement
  const handleKillStatement = async (statementId: number) => {
    if (!confirm(`¿Estás seguro de que deseas cancelar la consulta con ID #${statementId}?`)) {
      return;
    }

    try {
      if (window.electronAPI?.killStatement) {
        const res = await window.electronAPI.killStatement(statementId);
        if (res.success) {
          setStatusActionMessage({ text: `Consulta #${statementId} cancelada exitosamente.`, type: 'success' });
          if (selectedStatement?.statementId === statementId) {
            setSelectedStatement(null);
          }
          await loadData(true);
        } else {
          setStatusActionMessage({ text: res.error || 'No se pudo cancelar la consulta.', type: 'error' });
        }
      }
    } catch (err: any) {
      setStatusActionMessage({ text: err.message || 'Error al cancelar la consulta.', type: 'error' });
    }
  };

  // Kill Attachment / Disconnect Session
  const handleKillAttachment = async (attachment: MonitoringAttachment) => {
    const warning = attachment.isCurrent
      ? `ATENCIÓN: La conexión #${attachment.attachmentId} es TU PROPIA SESIÓN ACTUAL.\nSi la desconectas, se cerrará tu conexión a Firebird.\n\n¿Estás completamente seguro de continuar?`
      : `¿Estás seguro de desconectar la sesión #${attachment.attachmentId} (${attachment.userName}@${attachment.remoteAddress || 'local'})?`;

    if (!confirm(warning)) {
      return;
    }

    try {
      if (window.electronAPI?.killAttachment) {
        const res = await window.electronAPI.killAttachment(attachment.attachmentId);
        if (res.success) {
          setStatusActionMessage({ 
            text: `Sesión #${attachment.attachmentId} desconectada exitosamente.`, 
            type: 'success' 
          });
          await loadData(true);
        } else {
          setStatusActionMessage({ 
            text: res.error || 'No se pudo desconectar la sesión.', 
            type: 'error' 
          });
        }
      }
    } catch (err: any) {
      setStatusActionMessage({ text: err.message || 'Error al desconectar la sesión.', type: 'error' });
    }
  };

  // Format milliseconds to human readable
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const remSec = sec % 60;
    if (min < 60) return `${min}m ${remSec}s`;
    const hrs = Math.floor(min / 60);
    const remMin = min % 60;
    return `${hrs}h ${remMin}m`;
  };

  // Filtered attachments
  const filteredAttachments = useMemo(() => {
    if (!data?.attachments) return [];
    if (!searchFilter.trim()) return data.attachments;
    const q = searchFilter.toLowerCase();
    return data.attachments.filter(a => 
      a.userName?.toLowerCase().includes(q) ||
      a.remoteAddress?.toLowerCase().includes(q) ||
      a.remoteProcess?.toLowerCase().includes(q) ||
      String(a.attachmentId).includes(q)
    );
  }, [data?.attachments, searchFilter]);

  // Filtered statements
  const filteredStatements = useMemo(() => {
    if (!data?.statements) return [];
    if (!searchFilter.trim()) return data.statements;
    const q = searchFilter.toLowerCase();
    return data.statements.filter(s => 
      s.sqlText?.toLowerCase().includes(q) ||
      s.userName?.toLowerCase().includes(q) ||
      s.remoteAddress?.toLowerCase().includes(q) ||
      s.remoteProcess?.toLowerCase().includes(q) ||
      String(s.statementId).includes(q)
    );
  }, [data?.statements, searchFilter]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    if (!searchFilter.trim()) return data.transactions;
    const q = searchFilter.toLowerCase();
    return data.transactions.filter(t => 
      t.userName?.toLowerCase().includes(q) ||
      t.remoteAddress?.toLowerCase().includes(q) ||
      t.remoteProcess?.toLowerCase().includes(q) ||
      String(t.transactionId).includes(q) ||
      String(t.attachmentId).includes(q)
    );
  }, [data?.transactions, searchFilter]);

  // Transaction Gap Health Status
  const healthStatus = useMemo(() => {
    if (!data?.database) return { level: 'unknown', label: 'Desconocido', color: 'text-zinc-400', bg: 'bg-zinc-800' };
    const sweepGap = data.database.txSweepGap;
    const sweepInterval = data.database.sweepInterval || 20000;

    if (sweepInterval > 0 && sweepGap >= sweepInterval) {
      return {
        level: 'critical',
        label: 'Crítico (Umbral de Sweep Excedido)',
        desc: `La diferencia entre la transacción más vieja y la próxima (${sweepGap.toLocaleString()}) supera el intervalo de sweep (${sweepInterval.toLocaleString()}). Hay transacciones viejas abiertas impidiendo la recolección de basura.`,
        color: 'text-red-400',
        bg: 'bg-red-500/10 border-red-500/30'
      };
    } else if (sweepGap > 10000) {
      return {
        level: 'warning',
        label: 'Advertencia (Brecha Alta)',
        desc: `La brecha transaccional es de ${sweepGap.toLocaleString()} transacciones. Monitorea las transacciones abiertas para evitar degradación de rendimiento.`,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/30'
      };
    } else {
      return {
        level: 'good',
        label: 'Saludable',
        desc: `La brecha transaccional es baja (${sweepGap.toLocaleString()}). El recolector de basura de Firebird opera con total fluidez.`,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/30'
      };
    }
  }, [data?.database]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none animate-in fade-in duration-150">
      
      {/* Modal Container */}
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl flex flex-col w-full max-w-6xl h-[88vh] overflow-hidden text-zinc-100">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-zinc-800 bg-zinc-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-xs">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-zinc-100">
                  Monitor de Servidor y Sesiones
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                  MON$ Firebird
                </span>
              </div>
              <div className="text-xs text-zinc-400 flex items-center gap-2">
                <span>Base: <strong className="text-zinc-200">{activeConfig?.name || activeConfig?.database}</strong></span>
                <span>•</span>
                <span>{activeConfig?.host}:{activeConfig?.port || 3050}</span>
                {data?.timestamp && (
                  <>
                    <span>•</span>
                    <span className="text-zinc-500">Actualizado: {new Date(data.timestamp).toLocaleTimeString()}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Controls: Auto-refresh & Actions */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[11px] text-zinc-400">Refresco:</span>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-transparent text-xs text-zinc-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value={0} className="bg-zinc-900 text-zinc-200">Manual (Pausado)</option>
                <option value={3000} className="bg-zinc-900 text-zinc-200">Cada 3 seg</option>
                <option value={5000} className="bg-zinc-900 text-zinc-200">Cada 5 seg</option>
                <option value={10000} className="bg-zinc-900 text-zinc-200">Cada 10 seg</option>
                <option value={30000} className="bg-zinc-900 text-zinc-200">Cada 30 seg</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => loadData(false)}
              disabled={isLoading}
              title="Actualizar ahora"
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden sm:inline text-xs">Actualizar</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              title="Cerrar monitor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Status Banner */}
        {statusActionMessage && (
          <div className={`px-6 py-2 text-xs flex items-center justify-between border-b ${
            statusActionMessage.type === 'success' 
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200' 
              : 'bg-red-950/80 border-red-500/40 text-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {statusActionMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{statusActionMessage.text}</span>
            </div>
            <button 
              onClick={() => setStatusActionMessage(null)}
              className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Top Summary KPI Cards */}
        {data?.database && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-zinc-950/40 border-b border-zinc-800/80 shrink-0">
            
            {/* Card 1: Salud Transaccional (Sweep Gap) */}
            <div 
              onClick={() => setActiveTab('health')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                activeTab === 'health' ? 'ring-2 ring-amber-500/50' : ''
              } ${healthStatus.bg}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-400">Brecha de Sweep</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${healthStatus.color} bg-black/40`}>
                  {healthStatus.label.split(' ')[0]}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`text-xl font-bold font-mono ${healthStatus.color}`}>
                  {data.database.txSweepGap.toLocaleString()}
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  / {data.database.sweepInterval.toLocaleString()}
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 mt-1 truncate">
                OAT: #{data.database.oat.toLocaleString()} • Próx: #{data.database.nextTx.toLocaleString()}
              </div>
            </div>

            {/* Card 2: Conexiones Activas */}
            <div 
              onClick={() => setActiveTab('attachments')}
              className={`p-3 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-850 cursor-pointer transition-all ${
                activeTab === 'attachments' ? 'ring-2 ring-amber-500/50 border-amber-500/40' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-400">Conexiones</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-zinc-100">
                  {data.attachments.length}
                </span>
                <span className="text-[11px] text-emerald-400 font-medium">
                  ({data.attachments.filter(a => a.state === 1).length} activas)
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 mt-1 truncate">
                Tu sesión: ID #{data.database.currentAttachmentId}
              </div>
            </div>

            {/* Card 3: Consultas en Vuelo */}
            <div 
              onClick={() => setActiveTab('statements')}
              className={`p-3 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-850 cursor-pointer transition-all ${
                activeTab === 'statements' ? 'ring-2 ring-amber-500/50 border-amber-500/40' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-400">Consultas</span>
                <Terminal className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-zinc-100">
                  {data.statements.length}
                </span>
                <span className="text-[11px] text-amber-400 font-medium">
                  ({data.statements.filter(s => s.state === 1).length} ejecutándose)
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 mt-1 truncate">
                {data.statements.filter(s => s.elapsedMs > 5000).length > 0 ? (
                  <span className="text-red-400 font-semibold">⚠️ {data.statements.filter(s => s.elapsedMs > 5000).length} lentas (&gt;5s)</span>
                ) : (
                  'Todas en tiempo óptimo'
                )}
              </div>
            </div>

            {/* Card 4: Base de Datos & ODS */}
            <div 
              onClick={() => setActiveTab('health')}
              className={`p-3 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-850 cursor-pointer transition-all ${
                activeTab === 'health' ? 'ring-2 ring-amber-500/50 border-amber-500/40' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-400">Tamaño Base</span>
                <Database className="w-4 h-4 text-purple-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-zinc-100">
                  {data.database.sizeMb > 1024 
                    ? `${(data.database.sizeMb / 1024).toFixed(2)} GB` 
                    : `${data.database.sizeMb} MB`}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {data.database.pageSize}b/pág
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 mt-1 truncate">
                ODS {data.database.odsMajor}.{data.database.odsMinor} • Dialecto {data.database.sqlDialect}
              </div>
            </div>

          </div>
        )}

        {/* Tab Navigation & Search Filter */}
        <div className="flex items-center justify-between px-6 border-b border-zinc-800 bg-zinc-950/60 shrink-0">
          <div className="flex gap-2 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('attachments')}
              className={`flex items-center gap-2 py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === 'attachments'
                  ? 'border-amber-500 text-amber-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Conexiones</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-300 font-mono">
                {data?.attachments.length ?? 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('statements')}
              className={`flex items-center gap-2 py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === 'statements'
                  ? 'border-amber-500 text-amber-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Consultas Activas</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                (data?.statements.filter(s => s.state === 1).length ?? 0) > 0
                  ? 'bg-amber-500/20 text-amber-300 font-bold'
                  : 'bg-zinc-800 text-zinc-300'
              }`}>
                {data?.statements.length ?? 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('transactions')}
              className={`flex items-center gap-2 py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === 'transactions'
                  ? 'border-amber-500 text-amber-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Transacciones</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-300 font-mono">
                {data?.transactions.length ?? 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('health')}
              className={`flex items-center gap-2 py-3 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === 'health'
                  ? 'border-amber-500 text-amber-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Diagnóstico & Sweep</span>
            </button>
          </div>

          {/* Search filter input */}
          <div className="relative w-64 my-1.5">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filtrar por usuario, IP, proceso..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
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
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto bg-zinc-950/20">

          {/* Error display */}
          {error && (
            <div className="m-6 p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Error al consultar el monitor</div>
                <div className="text-xs text-red-300/90 mt-1">{error}</div>
                <div className="text-[11px] text-zinc-400 mt-2">
                  Asegúrate de que el usuario tenga privilegios para consultar las tablas de sistema <code>MON$</code> de Firebird (generalmente SYSDBA o el propietario de la base).
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: Conexiones / Attachments */}
          {activeTab === 'attachments' && (
            <div className="p-4">
              {filteredAttachments.length === 0 ? (
                <div className="text-center py-16 text-zinc-500 text-xs">
                  {searchFilter ? 'No se encontraron conexiones que coincidan con la búsqueda.' : 'No hay conexiones activas.'}
                </div>
              ) : (
                <div className="border border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-900/90 text-zinc-400 text-[11px] border-b border-zinc-800 font-semibold select-none">
                        <th className="py-2.5 px-3">ID</th>
                        <th className="py-2.5 px-3">Usuario & Rol</th>
                        <th className="py-2.5 px-3">IP / Host Remoto</th>
                        <th className="py-2.5 px-3">Proceso / Cliente</th>
                        <th className="py-2.5 px-3">Conectado Desde</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                        <th className="py-2.5 px-3 text-center">Consultas</th>
                        <th className="py-2.5 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono">
                      {filteredAttachments.map((att) => (
                        <tr 
                          key={att.attachmentId}
                          className={`hover:bg-zinc-800/40 transition-colors ${
                            att.isCurrent ? 'bg-blue-500/5' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-semibold text-zinc-200">
                            <div className="flex items-center gap-1.5">
                              <span>#{att.attachmentId}</span>
                              {att.isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-500/20 text-blue-300 font-sans font-semibold">
                                  Tú
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-sans font-medium text-zinc-100">{att.userName}</div>
                            {att.roleName && att.roleName !== 'NONE' && (
                              <div className="text-[10px] text-zinc-500 font-sans">Rol: {att.roleName}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-300">
                            {att.remoteAddress || <span className="text-zinc-600 font-sans italic">Local / IPC</span>}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-300 max-w-[200px] truncate" title={att.remoteProcess}>
                            {att.remoteProcess ? att.remoteProcess.split(/[\\/]/).pop() : <span className="text-zinc-600 font-sans italic">Desconocido</span>}
                            {att.remotePid > 0 && (
                              <span className="text-[10px] text-zinc-500 ml-1">({att.remotePid})</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-400 text-[11px]" title={att.connectedAt}>
                            {att.connectedAt ? new Date(att.connectedAt).toLocaleTimeString() : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {att.state === 1 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-sans text-zinc-400 bg-zinc-800">
                                En espera
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                              att.statementCount > 0 
                                ? 'bg-amber-500/20 text-amber-300 font-bold' 
                                : 'text-zinc-500'
                            }`}>
                              {att.statementCount}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleKillAttachment(att)}
                              className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-xs font-sans font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                              title="Desconectar esta sesión (DELETE FROM MON$ATTACHMENTS)"
                            >
                              <Trash2 className="w-3 h-3 text-red-400" />
                              <span>Desconectar</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Consultas Activas / Statements */}
          {activeTab === 'statements' && (
            <div className="p-4">
              {filteredStatements.length === 0 ? (
                <div className="text-center py-16 text-zinc-500 text-xs">
                  {searchFilter ? 'No se encontraron consultas que coincidan.' : 'No hay consultas ejecutándose en este momento.'}
                </div>
              ) : (
                <div className="border border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-900/90 text-zinc-400 text-[11px] border-b border-zinc-800 font-semibold select-none">
                        <th className="py-2.5 px-3">ID</th>
                        <th className="py-2.5 px-3">Usuario & IP</th>
                        <th className="py-2.5 px-3">Duración</th>
                        <th className="py-2.5 px-3">Estado</th>
                        <th className="py-2.5 px-3">Consulta SQL</th>
                        <th className="py-2.5 px-3 text-center">Lecturas Pág</th>
                        <th className="py-2.5 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono">
                      {filteredStatements.map((stmt) => (
                        <tr 
                          key={stmt.statementId}
                          className="hover:bg-zinc-800/40 transition-colors"
                        >
                          <td className="py-2.5 px-3 font-semibold text-zinc-200">
                            #{stmt.statementId}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-sans font-medium text-zinc-100">{stmt.userName}</div>
                            <div className="text-[10px] text-zinc-500 font-sans truncate max-w-[140px]" title={stmt.remoteProcess}>
                              {stmt.remoteAddress || 'Local'} • {stmt.remoteProcess ? stmt.remoteProcess.split(/[\\/]/).pop() : 'App'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                              stmt.elapsedMs > 10000 
                                ? 'bg-red-500/20 text-red-300 border border-red-500/40' 
                                : stmt.elapsedMs > 3000
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'text-zinc-300'
                            }`}>
                              {formatDuration(stmt.elapsedMs)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {stmt.state === 1 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                                Ejecutando
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-sans text-zinc-400 bg-zinc-800">
                                Preparada
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 max-w-[320px]">
                            <div 
                              onClick={() => setSelectedStatement(stmt)}
                              className="text-zinc-200 hover:text-amber-300 font-mono text-[11px] truncate cursor-pointer bg-zinc-950/60 px-2 py-1 rounded border border-zinc-800/80 transition-colors"
                              title="Clic para ver consulta completa"
                            >
                              {stmt.sqlText || <span className="italic text-zinc-600">(Sin texto SQL disponible)</span>}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center text-zinc-400 text-[11px]">
                            {stmt.pageReads > 0 ? (
                              <span className="font-semibold text-zinc-200">{stmt.pageReads.toLocaleString()}</span>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleKillStatement(stmt.statementId)}
                              className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-xs font-sans font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                              title="Cancelar esta consulta (DELETE FROM MON$STATEMENTS)"
                            >
                              <Zap className="w-3 h-3 text-red-400" />
                              <span>Cancelar</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Transacciones / Transactions */}
          {activeTab === 'transactions' && (
            <div className="p-4">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-16 text-zinc-500 text-xs">
                  {searchFilter ? 'No se encontraron transacciones.' : 'No hay transacciones activas registradas.'}
                </div>
              ) : (
                <div className="border border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-900/90 text-zinc-400 text-[11px] border-b border-zinc-800 font-semibold select-none">
                        <th className="py-2.5 px-3">ID Transacción</th>
                        <th className="py-2.5 px-3">Sesión / Conexión</th>
                        <th className="py-2.5 px-3">Usuario & IP</th>
                        <th className="py-2.5 px-3">Proceso</th>
                        <th className="py-2.5 px-3">Tiempo Abierta</th>
                        <th className="py-2.5 px-3">Aislamiento</th>
                        <th className="py-2.5 px-3 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono">
                      {filteredTransactions.map((tx, idx) => {
                        const isOat = idx === 0; // The lowest transaction ID is the OAT
                        return (
                          <tr 
                            key={tx.transactionId}
                            className={`hover:bg-zinc-800/40 transition-colors ${
                              isOat ? 'bg-amber-500/5' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 font-semibold text-zinc-200">
                              <div className="flex items-center gap-2">
                                <span>#{tx.transactionId.toLocaleString()}</span>
                                {isOat && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-sans font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    OAT (Más Vieja)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-zinc-300">
                              Sesión #{tx.attachmentId}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-sans font-medium text-zinc-100">{tx.userName}</span>
                              <span className="text-zinc-500 text-[11px] ml-1">({tx.remoteAddress || 'Local'})</span>
                            </td>
                            <td className="py-2.5 px-3 text-zinc-300 truncate max-w-[180px]" title={tx.remoteProcess}>
                              {tx.remoteProcess ? tx.remoteProcess.split(/[\\/]/).pop() : 'Desconocido'}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                                tx.elapsedMs > 60000 
                                  ? 'bg-red-500/20 text-red-300 font-bold' 
                                  : tx.elapsedMs > 10000
                                  ? 'bg-amber-500/15 text-amber-300 font-semibold'
                                  : 'text-zinc-300'
                              }`}>
                                {formatDuration(tx.elapsedMs)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-zinc-400 font-sans text-[11px]">
                              {tx.isolationMode === 1 ? 'Concurrency / Snapshot' : tx.isolationMode === 2 ? 'Read Committed' : 'Consistency'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {tx.state === 1 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  Activa
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-sans text-zinc-400 bg-zinc-800">
                                  Limbo / Espera
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Diagnóstico y Salud de Base de Datos */}
          {activeTab === 'health' && data?.database && (
            <div className="p-6 max-w-4xl mx-auto space-y-6">
              
              {/* Status Alert Banner */}
              <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${healthStatus.bg}`}>
                {healthStatus.level === 'critical' ? (
                  <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                ) : healthStatus.level === 'warning' ? (
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className={`text-sm font-bold ${healthStatus.color}`}>
                    Estado de Transacciones: {healthStatus.label}
                  </h3>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                    {healthStatus.desc}
                  </p>
                </div>
              </div>

              {/* Transactions Metrics Grid */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  Métricas de Transacciones de Firebird
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
                  
                  <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Próxima Transacción (Next Tx)</span>
                    <span className="text-lg font-bold text-zinc-100">#{data.database.nextTx.toLocaleString()}</span>
                    <span className="text-[10px] text-zinc-500 block font-sans mt-0.5">ID del próximo número de transacción</span>
                  </div>

                  <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Más Vieja Activa (OAT)</span>
                    <span className="text-lg font-bold text-amber-300">#{data.database.oat.toLocaleString()}</span>
                    <span className="text-[10px] text-zinc-500 block font-sans mt-0.5">Oldest Active Transaction</span>
                  </div>

                  <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Más Vieja Interesante (OIT)</span>
                    <span className="text-lg font-bold text-purple-300">#{data.database.oit.toLocaleString()}</span>
                    <span className="text-[10px] text-zinc-500 block font-sans mt-0.5">Oldest Interesting Transaction</span>
                  </div>

                  <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Brecha Activa (Next - OAT)</span>
                    <span className="text-lg font-bold text-zinc-100">{data.database.txActiveGap.toLocaleString()}</span>
                    <span className="text-[10px] text-zinc-500 block font-sans mt-0.5">Transacciones entre la más vieja activa y ahora</span>
                  </div>

                  <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Brecha de Sweep (Next - OIT)</span>
                    <span className={`text-lg font-bold ${healthStatus.color}`}>
                      {data.database.txSweepGap.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-zinc-500 block font-sans mt-0.5">Umbral de barrido automático</span>
                  </div>

                  <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Intervalo de Sweep</span>
                    <span className="text-lg font-bold text-zinc-100">{data.database.sweepInterval.toLocaleString()}</span>
                    <span className="text-[10px] text-zinc-500 block font-sans mt-0.5">Por defecto: 20,000</span>
                  </div>

                </div>
              </div>

              {/* Explanatory Guide Card */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-xs text-xs space-y-3">
                <h4 className="font-bold text-zinc-200 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  ¿Por qué es crucial la brecha transaccional en Firebird?
                </h4>
                <p className="text-zinc-400 leading-relaxed">
                  Firebird utiliza una arquitectura multiversión (MGA). Cuando se actualiza o elimina un registro, Firebird genera una nueva versión y mantiene las versiones viejas hasta que ninguna transacción activa las necesite.
                </p>
                <p className="text-zinc-400 leading-relaxed">
                  Si una aplicación abre una transacción y no realiza <code className="text-amber-300">COMMIT</code> o <code className="text-amber-300">ROLLBACK</code>, esa transacción se convierte en la <strong>OAT (Oldest Active Transaction)</strong> y congela la recolección de basura (*Garbage Collection*). La base de datos crecerá de tamaño y las lecturas secuenciales se volverán lentas.
                </p>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">💡 Consejo:</span>
                  <span>Si la brecha supera el Sweep Interval, revisa la pestaña de <strong>Transacciones</strong> para identificar qué proceso o usuario tiene abierta la transacción más vieja y desconéctalo o solicita que finalice su operación.</span>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer info bar */}
        <div className="px-6 py-2.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 shrink-0">
          <div className="flex items-center gap-4">
            <span>Sesiones: <strong className="text-zinc-300">{data?.attachments.length ?? 0}</strong></span>
            <span>Consultas: <strong className="text-zinc-300">{data?.statements.length ?? 0}</strong></span>
            <span>Transacciones: <strong className="text-zinc-300">{data?.transactions.length ?? 0}</strong></span>
          </div>
          <div>
            Firebird ODS {data?.database.odsMajor}.{data?.database.odsMinor}
          </div>
        </div>

      </div>

      {/* SQL Statement Detail Preview Sub-Modal */}
      {selectedStatement && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100 text-zinc-100">
            
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-zinc-100">
                  Detalle de Consulta #{selectedStatement.statementId}
                </h3>
                <span className="text-[10px] text-zinc-500 font-mono">
                  Sesión #{selectedStatement.attachmentId} ({selectedStatement.userName})
                </span>
              </div>
              <button
                onClick={() => setSelectedStatement(null)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-auto bg-zinc-950 font-mono text-xs text-zinc-200 whitespace-pre-wrap select-text leading-relaxed">
              {selectedStatement.sqlText || '(Consulta vacía o sin texto SQL disponible)'}
            </div>

            <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs">
              <div className="text-zinc-400 font-mono text-[11px]">
                Duración: <strong className="text-amber-300">{formatDuration(selectedStatement.elapsedMs)}</strong> • Lecturas: {selectedStatement.pageReads.toLocaleString()}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedStatement.sqlText);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Copiado' : 'Copiar SQL'}</span>
                </button>

                {onOpenInSqlEditor && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenInSqlEditor(selectedStatement.sqlText, `Consulta #${selectedStatement.statementId}`);
                      setSelectedStatement(null);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir en Editor</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleKillStatement(selectedStatement.statementId)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Cancelar Consulta</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
