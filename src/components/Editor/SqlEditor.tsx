import React, { useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useTranslation } from '../../i18n/I18nContext';
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
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  sql,
  onChange,
  onExecute,
  isRunning,
  maxRows,
  onChangeMaxRows,
  swapF9F5,
  onToggleSwap
}) => {
  const { t } = useTranslation();
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const executeKey = swapF9F5 ? 'F5' : 'F9';

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Custom Firebird SQL Autocompletions
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const firebirdKeywords = [
          'SELECT', 'FROM', 'WHERE', 'INSERT INTO', 'UPDATE', 'DELETE', 'JOIN', 'LEFT JOIN',
          'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'GROUP BY', 'ORDER BY', 'HAVING',
          'ROWS', 'FIRST', 'SKIP', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE',
          'CREATE PROCEDURE', 'CREATE TRIGGER', 'CREATE GENERATOR', 'CREATE DOMAIN',
          'GEN_ID', 'NEXT VALUE FOR', 'EXTRACT', 'COALESCE', 'CAST', 'IIF', 'LIST',
          'EXECUTE STATEMENT', 'EXECUTE PROCEDURE', 'SUSPEND', 'BEGIN', 'END',
          'RDB$DATABASE', 'RDB$RELATIONS', 'RDB$RELATION_FIELDS', 'RDB$PROCEDURES',
          'RDB$TRIGGERS', 'RDB$GENERATORS', 'VARCHAR', 'INTEGER', 'SMALLINT', 'BIGINT',
          'DOUBLE PRECISION', 'FLOAT', 'DATE', 'TIME', 'TIMESTAMP', 'BLOB SUB_TYPE TEXT',
          'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'NOT NULL', 'DEFAULT', 'UNIQUE'
        ];

        const suggestions = firebirdKeywords.map((kw) => ({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range
        }));

        return { suggestions };
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
          theme="vs-dark"
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
            quickSuggestions: true,
            renderLineHighlight: 'all',
            padding: { top: 8, bottom: 8 }
          }}
        />
      </div>

    </div>
  );
};
