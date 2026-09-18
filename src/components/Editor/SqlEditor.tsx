import React, { useRef, useEffect, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useTranslation } from '../../i18n/I18nContext';
import { useTheme } from '../../theme/ThemeContext';
import { 
  Play, 
  PlaySquare, 
  Save, 
  FolderOpen, 
  Eraser, 
  Sparkles,
  ArrowLeftRight
} from 'lucide-react';

interface SqlEditorProps {
  sql: string;
  onChange: (value: string) => void;
  onExecute: (selectedOnly?: boolean) => void;
  isRunning: boolean;
  maxRows: number;
  onChangeMaxRows: (val: number) => void;
  swapF9F5: boolean;
  onToggleSwap: () => void;
  schema?: {
    tables?: string[];
    views?: string[];
    procedures?: { name: string; inputs: number; outputs: number; inputParams?: string[] }[];
    triggers?: { name: string; table: string; inactive: boolean }[];
    generators?: string[];
    domains?: string[];
    exceptions?: string[];
    columnsByTable?: Record<string, string[]>;
  } | null;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  sql,
  onChange,
  onExecute,
  isRunning,
  maxRows,
  onChangeMaxRows,
  swapF9F5,
  onToggleSwap,
  schema
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const executeKey = swapF9F5 ? 'F5' : 'F9';

  const schemaRef = useRef(schema);
  useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);

  const [acceptOnEnter, setAcceptOnEnter] = useState<'off' | 'smart'>(() => {
    return (localStorage.getItem('firebirdyog_autocomplete_enter') as 'off' | 'smart') || 'off';
  });

  const handleToggleAcceptOnEnter = () => {
    setAcceptOnEnter(prev => {
      const next = prev === 'off' ? 'smart' : 'off';
      localStorage.setItem('firebirdyog_autocomplete_enter', next);
      return next;
    });
  };

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        acceptSuggestionOnEnter: acceptOnEnter
      });
    }
  }, [acceptOnEnter]);

  const completionDisposableRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (completionDisposableRef.current) {
        completionDisposableRef.current.dispose();
        completionDisposableRef.current = null;
      }
    };
  }, []);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure SQL language rules: neutralize onEnterRules to prevent unwanted newlines / indent jumps
    monaco.languages.setLanguageConfiguration('sql', {
      comments: {
        lineComment: '--',
        blockComment: ['/*', '*/']
      },
      brackets: [
        ['[', ']'],
        ['(', ')']
      ],
      autoClosingPairs: [
        { open: '(', close: ')' },
        { open: '[', close: ']' },
        { open: "'", close: "'", notIn: ['string', 'comment'] },
        { open: '"', close: '"', notIn: ['string'] }
      ],
      surroundingPairs: [
        { open: '(', close: ')' },
        { open: '[', close: ']' },
        { open: "'", close: "'" },
        { open: '"', close: '"' }
      ],
      onEnterRules: [] // Neutralize Monaco's aggressive SQL onEnterRules
    });

    // Custom Firebird SQL Autocompletions with table & column intelligence
    if (completionDisposableRef.current) {
      completionDisposableRef.current.dispose();
    }

    completionDisposableRef.current = monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: ['.'],
      provideCompletionItems: (model: any, position: any, context: any) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const textUntilPosition = lineContent.substring(0, position.column - 1);

        const currentSchema = schemaRef.current;
        const columnsByTable: Record<string, string[]> = currentSchema?.columnsByTable || {};

        // Check if typing after a dot: e.g. "CLIENTES." or "c." or "select CLIENTES.NO"
        const dotMatch = textUntilPosition.match(/([a-zA-Z0-9_$"']+)\.([a-zA-Z0-9_$"']*)$/);

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        // Don't show automatic popups on empty spaces / empty line unless explicitly invoked via Ctrl+Space or after dot
        const isManualInvoke = context?.triggerKind === monaco.languages.CompletionTriggerKind?.Invoke;
        if (!dotMatch && word.word.trim().length === 0 && !isManualInvoke) {
          return { suggestions: [] };
        }

        if (dotMatch) {
          const rawQualifier = dotMatch[1].replace(/["']/g, '');
          const qualifierUpper = rawQualifier.toUpperCase();

          // 1. Check if qualifier directly matches a table or view name
          let matchedTableName = Object.keys(columnsByTable).find(
            (t) => t.toUpperCase() === qualifierUpper
          );

          // 2. If not found directly, check if qualifier is an alias in the current SQL query
          if (!matchedTableName) {
            const fullText = model.getValue();
            const escapedQualifier = rawQualifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Regex to find table with alias: FROM/JOIN/UPDATE/INTO/, <table_name> [AS] <qualifier>
            const aliasRegex = new RegExp(
              `(?:FROM|JOIN|UPDATE|INTO|,)\\s+([a-zA-Z0-9_$]+)(?:\\s+AS)?\\s+${escapedQualifier}\\b`,
              'i'
            );
            const aliasMatch = fullText.match(aliasRegex);
            if (aliasMatch) {
              const candidateTable = aliasMatch[1].toUpperCase();
              matchedTableName = Object.keys(columnsByTable).find(
                (t) => t.toUpperCase() === candidateTable
              );
            }
          }

          if (matchedTableName) {
            const cols = columnsByTable[matchedTableName] || [];
            const suggestions = cols.map((col: string, idx: number) => ({
              label: col,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: col,
              detail: `Campo (${matchedTableName})`,
              sortText: String(idx).padStart(4, '0'),
              range
            }));
            return { suggestions };
          }

          return { suggestions: [] };
        }

        // Default suggestions when not immediately following a dot
        // Clean Firebird single-token keywords (avoids multi-word spacing and replacement glitches)
        const firebirdKeywords = [
          'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
          'JOIN', 'LEFT', 'RIGHT', 'INNER', 'FULL', 'OUTER', 'CROSS', 'NATURAL',
          'GROUP', 'ORDER', 'BY', 'HAVING', 'ROWS', 'FIRST', 'SKIP', 'OFFSET',
          'CREATE', 'ALTER', 'DROP', 'RECREATE', 'TABLE', 'VIEW', 'PROCEDURE', 'TRIGGER',
          'GENERATOR', 'SEQUENCE', 'DOMAIN', 'EXCEPTION', 'INDEX', 'CONSTRAINT',
          'GEN_ID', 'NEXT', 'VALUE', 'FOR', 'EXTRACT', 'COALESCE', 'CAST', 'IIF', 'LIST',
          'EXECUTE', 'STATEMENT', 'SUSPEND', 'BEGIN', 'END', 'AS', 'DISTINCT',
          'UNION', 'ALL', 'RETURNING', 'PLAN', 'CASE', 'WHEN', 'THEN', 'ELSE',
          'VARCHAR', 'CHAR', 'INTEGER', 'SMALLINT', 'BIGINT', 'NUMERIC', 'DECIMAL',
          'DOUBLE', 'PRECISION', 'FLOAT', 'DATE', 'TIME', 'TIMESTAMP', 'BLOB',
          'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'NOT', 'NULL', 'DEFAULT', 'UNIQUE', 'CHECK',
          'AND', 'OR', 'IN', 'EXISTS', 'LIKE', 'STARTING', 'WITH', 'CONTAINING', 'BETWEEN', 'IS',
          'RDB$DATABASE', 'RDB$RELATIONS', 'RDB$RELATION_FIELDS', 'RDB$PROCEDURES',
          'RDB$TRIGGERS', 'RDB$GENERATORS'
        ];

        const keywordSuggestions = firebirdKeywords.map((kw) => ({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          sortText: '4_' + kw,
          range
        }));

        const tableSuggestions = (currentSchema?.tables || []).map((tbl: string) => ({
          label: tbl,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: tbl,
          detail: 'Tabla',
          sortText: '1_' + tbl,
          range
        }));

        const viewSuggestions = (currentSchema?.views || []).map((vw: string) => ({
          label: vw,
          kind: monaco.languages.CompletionItemKind.Interface,
          insertText: vw,
          detail: 'Vista',
          sortText: '1_' + vw,
          range
        }));

        const procSuggestions = (currentSchema?.procedures || []).map((proc: any) => {
          const name = typeof proc === 'string' ? proc : proc.name;
          return {
            label: name,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: name,
            detail: 'Procedimiento',
            sortText: '2_' + name,
            range
          };
        });

        // Unique column names across all tables
        const allColsSet = new Set<string>();
        if (currentSchema?.columnsByTable) {
          for (const cols of Object.values(currentSchema.columnsByTable)) {
            if (Array.isArray(cols)) {
              for (const col of cols) {
                allColsSet.add(col);
              }
            }
          }
        }

        const columnSuggestions = Array.from(allColsSet).map((col) => ({
          label: col,
          kind: monaco.languages.CompletionItemKind.Field,
          insertText: col,
          detail: 'Campo',
          sortText: '3_' + col,
          range
        }));

        return {
          suggestions: [
            ...tableSuggestions,
            ...viewSuggestions,
            ...procSuggestions,
            ...columnSuggestions,
            ...keywordSuggestions
          ]
        };
      }
    });

    // Ctrl+Enter: execute all or selected
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        onExecuteRef.current(true);
      } else {
        onExecuteRef.current(false);
      }
    });

    // Intercept editor keydown to prevent browser/Electron refresh on F5 or F9
    editor.onKeyDown((e: any) => {
      if (e.keyCode === monaco.KeyCode.F5 || e.keyCode === monaco.KeyCode.F9) {
        e.preventDefault();
        e.stopPropagation();
        const isSwap = swapRef.current;
        const shouldExecute = isSwap
          ? e.keyCode === monaco.KeyCode.F5
          : e.keyCode === monaco.KeyCode.F9;

        if (shouldExecute) {
          onExecuteRef.current(false);
        }
      }
    });
  };

  const onExecuteRef = useRef(onExecute);
  useEffect(() => { onExecuteRef.current = onExecute; }, [onExecute]);

  const swapRef = useRef(swapF9F5);
  useEffect(() => { swapRef.current = swapF9F5; }, [swapF9F5]);

  const handleExecuteSelected = () => {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      if (selection && !selection.isEmpty()) {
        onExecute(true);
        return;
      }
    }
    onExecute(false);
  };

  const handleSaveToFile = async () => {
    if (window.electronAPI?.saveSqlFile) {
      await window.electronAPI.saveSqlFile(sql);
    }
  };

  const handleOpenFromFile = async () => {
    if (window.electronAPI?.openSqlFile) {
      const res = await window.electronAPI.openSqlFile();
      if (res && res.content) {
        onChange(res.content);
      }
    }
  };

  const handleFormatSql = () => {
    const formatted = sql.replace(
      /\b(select|from|where|and|or|order by|group by|insert into|values|update|set|delete|left join|inner join|right join|join|having|rows|create table|drop table|alter table|begin|end)\b/gi,
      (match) => match.toUpperCase()
    );
    onChange(formatted);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 overflow-hidden">
      
      {/* Editor Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-950/90 border-b border-zinc-800 text-xs select-none">
        
        {/* Left Execution buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onExecute(false)}
            disabled={isRunning || !sql.trim()}
            title={t('editor.executeTooltip')}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium disabled:opacity-50 transition-colors shadow-xs"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
            <span>{t('editor.execute')} ({executeKey})</span>
          </button>

          <button
            onClick={handleExecuteSelected}
            disabled={isRunning || !sql.trim()}
            title={t('editor.executeSelection')}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 rounded font-medium disabled:opacity-50 transition-colors"
          >
            <PlaySquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('editor.executeSelection')}</span>
          </button>

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          <button
            onClick={handleOpenFromFile}
            title={t('editor.openSql')}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleSaveToFile}
            title={t('editor.saveSql')}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleFormatSql}
            title={t('editor.formatSql')}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </button>

          <button
            onClick={() => onChange('')}
            title={t('editor.clear')}
            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          {/* F9/F5 swap toggle */}
          <button
            onClick={onToggleSwap}
            title={
              swapF9F5
                ? 'Modo SQLyog activo: F5 ejecuta, F9 refresca schema. Clic para volver al modo estándar.'
                : 'Modo estándar: F9 ejecuta. Clic para activar modo SQLyog (F5 ejecuta, F9 refresca).'
            }
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-mono font-semibold transition-colors ${
              swapF9F5
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span>{swapF9F5 ? 'F5=Ejecutar' : 'F9=Ejecutar'}</span>
          </button>

          {/* Autocomplete Enter toggle */}
          <button
            onClick={handleToggleAcceptOnEnter}
            title={
              acceptOnEnter === 'off'
                ? 'Modo seguro: Enter solo inserta salto de línea; Tab autocompleta. Clic para cambiar.'
                : 'Modo rápido: Enter autocompleta sugerencias. Clic para cambiar.'
            }
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-mono font-semibold transition-colors ${
              acceptOnEnter === 'off'
                ? 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-200'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>{acceptOnEnter === 'off' ? 'Tab=Completar' : 'Enter=Completar'}</span>
          </button>
        </div>

        {/* Right: row limit */}
        <div className="flex items-center gap-2 text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-500">{t('editor.rowsLimit')}</span>
            <select
              value={maxRows}
              onChange={(e) => onChangeMaxRows(parseInt(e.target.value))}
              className="bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500"
            >
              <option value={100}>100 {t('grid.rows')}</option>
              <option value={500}>500 {t('grid.rows')}</option>
              <option value={1000}>1,000 {t('grid.rows')}</option>
              <option value={5000}>5,000 {t('grid.rows')}</option>
              <option value={50000}>50k {t('grid.rows')}</option>
            </select>
          </div>
        </div>

      </div>

      {/* Monaco Code Editor */}
      <div className="flex-1 min-h-[140px] relative">
        <Editor
          height="100%"
          defaultLanguage="sql"
          theme={theme === 'light' ? 'vs' : 'vs-dark'}
          value={sql}
          onChange={(val) => onChange(val || '')}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
            lineNumbers: 'on',
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            suggestOnTriggerCharacters: true,
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false
            },
            acceptSuggestionOnEnter: acceptOnEnter,
            tabCompletion: 'on',
            wordBasedSuggestions: 'off',
            autoIndent: 'keep',
            renderLineHighlight: 'all',
            padding: { top: 8, bottom: 8 }
          }}
        />
      </div>

    </div>
  );
};
