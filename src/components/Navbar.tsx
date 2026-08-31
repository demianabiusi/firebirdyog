import React from 'react';
import { ConnectionConfig } from '../types';
import { 
  Flame, 
  Database, 
  Unplug, 
  Settings2, 
  PlusCircle, 
  HelpCircle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface NavbarProps {
  isConnected: boolean;
  activeConfig: ConnectionConfig | null;
  onOpenConnectionModal: () => void;
  onDisconnect: () => void;
  onNewQuery: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isConnected,
  activeConfig,
  onOpenConnectionModal,
  onDisconnect,
  onNewQuery
}) => {
  return (
    <header className="h-12 bg-zinc-950 border-b border-zinc-800/90 flex items-center justify-between px-4 select-none shrink-0">
      
      {/* Brand & App Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-linear-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/20">
            <Flame className="w-4 h-4 text-zinc-950 fill-current" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-zinc-100 flex items-center gap-1.5">
              Firebird<span className="text-amber-400">Yog</span>
              <span className="text-[10px] font-normal px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded">v1.0</span>
            </h1>
          </div>
        </div>

        <div className="h-5 w-px bg-zinc-800 mx-2" />

        {/* Quick query tab action */}
        <button
          onClick={onNewQuery}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs rounded border border-zinc-800 transition-colors"
          title="Nueva pestaña SQL (Ctrl+N)"
        >
          <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>Nueva Consulta</span>
        </button>
      </div>

      {/* Center Status: Connected Database */}
      <div className="flex items-center gap-2">
        {isConnected && activeConfig ? (
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-950/40 border border-emerald-500/30 rounded-full text-xs text-emerald-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-zinc-200">{activeConfig.name}</span>
            <span className="text-zinc-500">({activeConfig.host}:{activeConfig.port})</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-zinc-600" />
            <span>Desconectado</span>
          </div>
        )}
      </div>

      {/* Right Connection Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenConnectionModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors shadow-xs"
        >
          <Database className="w-3.5 h-3.5" />
          <span>{isConnected ? 'Cambiar Conexión' : 'Conectar a Firebird'}</span>
        </button>

        {isConnected && (
          <button
            onClick={onDisconnect}
            title="Desconectar sesión actual"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-red-950/40 text-zinc-400 hover:text-red-300 border border-zinc-800 hover:border-red-500/30 rounded-lg text-xs transition-colors"
          >
            <Unplug className="w-3.5 h-3.5 text-red-400" />
            <span>Desconectar</span>
          </button>
        )}
      </div>

    </header>
  );
};
