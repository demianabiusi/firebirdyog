import React, { useState, useEffect } from 'react';
import appIconUrl from '../../public/icon.svg';
import { ConnectionConfig } from '../types';
import { useTranslation } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';
import { 
  Database, 
  Unplug, 
  PlusCircle, 
  Download, 
  Upload, 
  Globe, 
  ChevronDown, 
  GitCompare, 
  Sun, 
  Moon,
  Wrench,
  Check,
  Activity
} from 'lucide-react';

interface NavbarProps {
  isConnected: boolean;
  activeConfig: ConnectionConfig | null;
  onOpenConnectionModal: () => void;
  onOpenCreateDbModal: () => void;
  onOpenDumpModal?: () => void;
  onOpenImportModal?: () => void;
  onOpenCompareModal?: () => void;
  onOpenServerMonitor?: () => void;
  onDisconnect: () => void;
  onNewQuery: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isConnected,
  activeConfig,
  onOpenConnectionModal,
  onOpenCreateDbModal,
  onOpenDumpModal,
  onOpenImportModal,
  onOpenCompareModal,
  onOpenServerMonitor,
  onDisconnect,
  onNewQuery
}) => {
  const { t, language, setLanguage, availableLanguages } = useTranslation();
  const { theme, setTheme, themeDefinition, availableThemes } = useTheme();
  
  // Single open menu state guarantees only one menu is active at a time
  const [openMenu, setOpenMenu] = useState<'tools' | 'database' | 'language' | 'theme' | null>(null);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    };
    if (openMenu) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [openMenu]);

  const currentLang = availableLanguages.find(l => l.code === language) || availableLanguages[0];

  const toggleMenu = (menu: 'tools' | 'database' | 'language' | 'theme') => {
    setOpenMenu(prev => (prev === menu ? null : menu));
  };

  return (
    <header className="h-12 bg-zinc-950 border-b border-zinc-800/90 flex items-center justify-between px-4 select-none shrink-0 relative">
      
      {/* Invisible backdrop to dismiss open dropdown on outside click */}
      {openMenu && (
        <div 
          className="fixed inset-0 z-40 bg-transparent" 
          onClick={() => setOpenMenu(null)} 
        />
      )}

      {/* Brand & Left Actions */}
      <div className="flex items-center gap-2.5">
        {/* Brand */}
        <div className="flex items-center gap-2 mr-1">
          <img 
            src={appIconUrl} 
            alt="Firebird Logo" 
            className="w-7 h-7 rounded-lg shadow-md shadow-orange-500/25 hover:scale-105 transition-transform" 
          />
          <div>
            <h1 className="text-sm font-bold tracking-wide text-zinc-100 flex items-center gap-1.5">
              Firebird<span className="text-amber-400">Yog</span>
              <span className="text-[10px] font-normal px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded">
                {t('navbar.brandSubtitle')}
              </span>
            </h1>
          </div>
        </div>

        <div className="h-5 w-px bg-zinc-800 mx-1" />

        {/* Quick query tab action */}
        <button
          onClick={onNewQuery}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs rounded-lg border border-zinc-800 transition-colors shadow-xs cursor-pointer"
          title={t('navbar.newQueryTooltip')}
        >
          <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>{t('navbar.newQuery')}</span>
        </button>

        {/* Menú Desplegable: Herramientas (Tools) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('tools')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              openMenu === 'tools'
                ? 'bg-zinc-800 border-amber-500/40 text-amber-300 shadow-sm'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
            }`}
            title={t('navbar.toolsTooltip')}
          >
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('navbar.tools')}</span>
            <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-150 ${openMenu === 'tools' ? 'rotate-180 text-amber-400' : ''}`} />
          </button>

          {openMenu === 'tools' && (
            <div className="absolute left-0 mt-1.5 z-50 w-72 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl p-1.5 divide-y divide-zinc-800/60 animate-in fade-in zoom-in-95 duration-100">
              <div className="py-1 space-y-0.5">
                {/* Exportar Dump SQL */}
                {onOpenDumpModal && (
                  <button
                    type="button"
                    disabled={!isConnected}
                    onClick={() => {
                      if (isConnected) {
                        setOpenMenu(null);
                        onOpenDumpModal();
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors group ${
                      isConnected 
                        ? 'hover:bg-zinc-800 text-zinc-200 cursor-pointer' 
                        : 'opacity-50 cursor-not-allowed text-zinc-500'
                    }`}
                    title={!isConnected ? t('navbar.requiresConnection') : t('navbar.exportDumpTooltip')}
                  >
                    <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 shrink-0">
                      <Download className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-zinc-200 group-hover:text-zinc-100 flex items-center justify-between">
                        <span>{t('navbar.exportDump')}</span>
                        {!isConnected && (
                          <span className="text-[9px] px-1 py-0.2 bg-zinc-800 text-zinc-500 rounded">
                            {t('navbar.requiresConnection')}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {t('navbar.exportDumpDesc')}
                      </div>
                    </div>
                  </button>
                )}

                {/* Importar Dump SQL */}
                {onOpenImportModal && (
                  <button
                    type="button"
                    disabled={!isConnected}
                    onClick={() => {
                      if (isConnected) {
                        setOpenMenu(null);
                        onOpenImportModal();
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors group ${
                      isConnected 
                        ? 'hover:bg-zinc-800 text-zinc-200 cursor-pointer' 
                        : 'opacity-50 cursor-not-allowed text-zinc-500'
                    }`}
                    title={!isConnected ? t('navbar.requiresConnection') : t('navbar.importSqlTooltip')}
                  >
                    <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-400 shrink-0">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-zinc-200 group-hover:text-zinc-100 flex items-center justify-between">
                        <span>{t('navbar.importSql')}</span>
                        {!isConnected && (
                          <span className="text-[9px] px-1 py-0.2 bg-zinc-800 text-zinc-500 rounded">
                            {t('navbar.requiresConnection')}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {t('navbar.importSqlDesc')}
                      </div>
                    </div>
                  </button>
                )}
              </div>

              {/* Comparar Bases de Datos */}
              {onOpenCompareModal && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      onOpenCompareModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-200 cursor-pointer transition-colors group"
                    title={t('navbar.compareDbTooltip')}
                  >
                    <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-400 shrink-0">
                      <GitCompare className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-zinc-200 group-hover:text-zinc-100">
                        {t('navbar.compareDb')}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {t('navbar.compareDbDesc')}
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Monitor de Servidor y Sesiones (MON$) */}
              {onOpenServerMonitor && (
                <div className="pt-1">
                  <button
                    type="button"
                    disabled={!isConnected}
                    onClick={() => {
                      if (isConnected) {
                        setOpenMenu(null);
                        onOpenServerMonitor();
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors group ${
                      isConnected 
                        ? 'hover:bg-zinc-800 text-zinc-200 cursor-pointer' 
                        : 'opacity-50 cursor-not-allowed text-zinc-500'
                    }`}
                    title={!isConnected ? t('navbar.requiresConnection') : 'Monitor de sesiones y consultas en vivo'}
                  >
                    <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 shrink-0">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-zinc-200 group-hover:text-zinc-100 flex items-center justify-between">
                        <span>Monitor de Sesiones (MON$)</span>
                        {!isConnected && (
                          <span className="text-[9px] px-1 py-0.2 bg-zinc-800 text-zinc-500 rounded">
                            {t('navbar.requiresConnection')}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        Conexiones, queries activas y brecha de transacciones
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center Status: Connected Database & Quick Monitor */}
      <div className="flex items-center gap-2">
        {isConnected && activeConfig ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-950/40 border border-emerald-500/30 rounded-full text-xs text-emerald-300 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-zinc-200">{activeConfig.name}</span>
              <span className="text-zinc-500">({activeConfig.host}:{activeConfig.port})</span>
              {activeConfig.ssh?.enabled && (
                <span 
                  className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded tracking-wider uppercase"
                  title={`Túnel SSH: ${activeConfig.ssh.user}@${activeConfig.ssh.host}:${activeConfig.ssh.port || 22}`}
                >
                  SSH
                </span>
              )}
            </div>

            {/* Quick Access Monitor Button */}
            {onOpenServerMonitor && (
              <button
                type="button"
                onClick={onOpenServerMonitor}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-amber-400 rounded-full text-xs font-medium transition-colors cursor-pointer"
                title="Abrir Monitor de Servidor y Sesiones (MON$)"
              >
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline text-[11px] font-mono">MON$</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-zinc-600" />
            <span>{t('common.disconnected')}</span>
          </div>
        )}
      </div>

      {/* Right Connection Controls & Settings */}
      <div className="flex items-center gap-2">
        
        {/* Menú Desplegable: Base de Datos */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('database')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors shadow-xs cursor-pointer ${
              isConnected
                ? openMenu === 'database'
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
                : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300'
            }`}
            title={t('navbar.databaseTooltip')}
          >
            <Database className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span>{isConnected ? t('navbar.database') : t('navbar.connect')}</span>
            <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform duration-150 ${openMenu === 'database' ? 'rotate-180' : ''}`} />
          </button>

          {openMenu === 'database' && (
            <div className="absolute right-0 mt-1.5 z-50 w-72 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl p-1.5 divide-y divide-zinc-800/60 animate-in fade-in zoom-in-95 duration-100">
              <div className="py-1 space-y-0.5">
                {/* Conectar / Cambiar Conexión */}
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenConnectionModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-200 cursor-pointer transition-colors group"
                >
                  <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-zinc-200 group-hover:text-zinc-100">
                      {isConnected ? t('navbar.changeConnection') : t('navbar.connect')}
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      {t('navbar.connectDesc')}
                    </div>
                  </div>
                </button>

                {/* Crear Base de Datos */}
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenCreateDbModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-200 cursor-pointer transition-colors group"
                  title={t('navbar.createDbTooltip')}
                >
                  <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 shrink-0">
                    <PlusCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-zinc-200 group-hover:text-zinc-100">
                      {t('navbar.createDb')}
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      {t('navbar.createDbDesc')}
                    </div>
                  </div>
                </button>
              </div>

              {/* Desconectar (solo si está conectado) */}
              {isConnected && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      onDisconnect();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-red-950/40 text-red-400 hover:text-red-300 cursor-pointer transition-colors group"
                    title={t('navbar.disconnectTooltip')}
                  >
                    <div className="p-1.5 rounded-md bg-red-500/10 text-red-400 shrink-0 group-hover:bg-red-500/20">
                      <Unplug className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-red-400 group-hover:text-red-300">
                        {t('navbar.disconnect')}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {activeConfig?.name || activeConfig?.database}
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-5 w-px bg-zinc-800 mx-0.5" />

        {/* Language Selector Dropdown (Compact) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('language')}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              openMenu === 'language'
                ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
            }`}
            title={t('navbar.language')}
          >
            <Globe className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-[11px] uppercase font-bold">{currentLang.flag} {currentLang.code}</span>
            <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-150 ${openMenu === 'language' ? 'rotate-180' : ''}`} />
          </button>

          {openMenu === 'language' && (
            <div className="absolute right-0 mt-1.5 z-50 w-36 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl py-1 divide-y divide-zinc-800/60 animate-in fade-in zoom-in-95 duration-100">
              <div className="py-0.5">
                {availableLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setLanguage(lang.code);
                      setOpenMenu(null);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                      lang.code === language 
                        ? 'bg-amber-500/15 text-amber-300 font-semibold' 
                        : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </span>
                    {lang.code === language && <Check className="w-3 h-3 text-amber-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('theme')}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              openMenu === 'theme'
                ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
            }`}
            title={t('theme.selectTheme')}
          >
            <span className="text-sm leading-none">{themeDefinition.icon}</span>
            <span className="text-[11px] font-semibold hidden md:inline">{themeDefinition.name}</span>
            <span 
              className="w-2 h-2 rounded-full shrink-0 shadow-xs" 
              style={{ backgroundColor: themeDefinition.accentHex }} 
            />
            <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-150 ${openMenu === 'theme' ? 'rotate-180' : ''}`} />
          </button>

          {openMenu === 'theme' && (
            <div className="absolute right-0 mt-1.5 z-50 w-60 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl py-1 divide-y divide-zinc-800/60 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                {t('theme.selectTheme')}
              </div>
              <div className="py-0.5">
                {availableThemes.map((item) => {
                  const isSelected = item.id === theme;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTheme(item.id);
                        setOpenMenu(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-amber-500/15 text-amber-300 font-semibold' 
                          : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base leading-none">{item.icon}</span>
                        <div className="flex flex-col">
                          <span className="font-medium text-zinc-100">{item.name}</span>
                          <span className="text-[10px] text-zinc-400">{item.accent}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Theme preview swatch */}
                        <div 
                          className="w-5 h-5 rounded-md border border-zinc-700/70 flex items-center justify-center shadow-xs"
                          style={{ backgroundColor: item.bg }}
                          title={`Fondo: ${item.bg}`}
                        >
                          <span 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: item.accentHex }} 
                          />
                        </div>

                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

    </header>
  );
};
