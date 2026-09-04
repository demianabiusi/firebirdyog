import { useCallback, useRef } from 'react';
import { QueryTab } from '../types';

type PersistedTab = Pick<QueryTab, 'id' | 'title' | 'sql' | 'activeResultTab'>;

interface ConnectionWorkspace {
  tabs: PersistedTab[];
  activeTabId: string;
  maxRows: number;
}

const STORAGE_KEY = 'firebirdyog_workspaces';
const DEBOUNCE_MS = 600;

const BLANK_TAB: PersistedTab = {
  id: 'tab_1',
  title: 'Consulta 1',
  sql: `-- Bienvenido a FirebirdYog\n-- Presiona F9 o haz clic en "Ejecutar" para ejecutar consultas\n\nSELECT \n    RDB$RELATION_NAME AS TABLA,\n    RDB$SYSTEM_FLAG AS ES_SISTEMA\nFROM RDB$RELATIONS\nWHERE RDB$VIEW_BLR IS NULL\nORDER BY RDB$RELATION_NAME;\n`,
  activeResultTab: 'grid',
};

function readAll(): Record<string, ConnectionWorkspace> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, ConnectionWorkspace>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // localStorage full — silently ignore
  }
}

export function useConnectionWorkspace() {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWorkspace = useCallback(
    (connectionId: string): ConnectionWorkspace | null => {
      const all = readAll();
      return all[connectionId] ?? null;
    },
    []
  );

  const saveWorkspaceNow = useCallback(
    (connectionId: string, tabs: QueryTab[], activeTabId: string, maxRows: number) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      const all = readAll();
      all[connectionId] = {
        tabs: tabs.map(({ id, title, sql, activeResultTab }) => ({
          id,
          title,
          sql,
          activeResultTab,
        })),
        activeTabId,
        maxRows,
      };
      writeAll(all);
    },
    []
  );

  const saveWorkspaceDebounced = useCallback(
    (connectionId: string, tabs: QueryTab[], activeTabId: string, maxRows: number) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        saveWorkspaceNow(connectionId, tabs, activeTabId, maxRows);
      }, DEBOUNCE_MS);
    },
    [saveWorkspaceNow]
  );

  const hydrateWorkspace = useCallback(
    (connectionId: string): { tabs: QueryTab[]; activeTabId: string; maxRows: number } => {
      const saved = loadWorkspace(connectionId);

      if (!saved || saved.tabs.length === 0) {
        return {
          tabs: [{ ...BLANK_TAB, result: null, isRunning: false, error: null }],
          activeTabId: BLANK_TAB.id,
          maxRows: 1000,
        };
      }

      const tabs: QueryTab[] = saved.tabs.map((t) => ({
        ...t,
        result: null,
        isRunning: false,
        error: null,
      }));

      const activeTabId = tabs.find((t) => t.id === saved.activeTabId)
        ? saved.activeTabId
        : tabs[0].id;

      return { tabs, activeTabId, maxRows: saved.maxRows ?? 1000 };
    },
    [loadWorkspace]
  );

  return { hydrateWorkspace, saveWorkspaceNow, saveWorkspaceDebounced };
}
