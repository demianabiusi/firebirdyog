import React, { useState, useMemo, useEffect, useRef } from 'react';
import { QueryResult, TableRowUpdate } from '../../types';
import { useTranslation } from '../../i18n/I18nContext';
import { exportToCsv, exportToJson, exportToSqlInserts } from '../../utils/exporter';
import { checkQueryUpdatability, QueryUpdatability } from '../../utils/queryAnalyzer';
import { 
  Download, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check, 
  X,
  FileSpreadsheet,
  FileJson,
  FileText,
  Clock,
  Layers,
  Edit3,
  Lock,
  Key,
  AlertCircle
} from 'lucide-react';

interface DataGridProps {
  result: QueryResult | null;
  isRunning: boolean;
  schemaObjects?: any;
}

export const DataGrid: React.FC<DataGridProps> = ({ result, isRunning, schemaObjects }) => {
  const { t } = useTranslation();
  const [filterText, setFilterText] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [cellModalValue, setCellModalValue] = useState<{ col: string; value: any } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // In-grid editing states
  const [localRows, setLocalRows] = useState<Record<string, any>[]>([]);
  const [pendingEdits, setPendingEdits] = useState<Map<number, Record<string, any>>>(new Map());
  const [editingCell, setEditingCell] = useState<{ origIdx: number; col: string; value: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  const [updatability, setUpdatability] = useState<QueryUpdatability>({
    isUpdatable: false,
    tableName: null,
    primaryKeyColumns: []
  });
  const [isCheckingUpdatability, setIsCheckingUpdatability] = useState(false);

  const editInputRef = useRef<HTMLInputElement | null>(null);

  // Focus and select input on editing start
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Synchronize localRows and check updatability when result changes
  useEffect(() => {
    setCurrentPage(1);
    setFilterText('');
    setPendingEdits(new Map());
    setEditingCell(null);
    setSaveError(null);
    setShowErrorModal(false);
    setSaveSuccessNotice(null);

    if (result?.rows) {
      setLocalRows(result.rows.map((r, idx) => ({ ...r, _origIdx: idx })));
    } else {
      setLocalRows([]);
    }

    if (result && result.columns && result.columns.length > 0 && result.sql) {
      setIsCheckingUpdatability(true);
      checkQueryUpdatability(result.sql, result.columns, schemaObjects)
        .then((res) => {
          setUpdatability(res);
        })
        .finally(() => {
          setIsCheckingUpdatability(false);
        });
    } else {
      setUpdatability({
        isUpdatable: false,
        tableName: null,
        primaryKeyColumns: []
      });
    }
  }, [result, schemaObjects]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      if (sortAsc) {
        setSortAsc(false);
      } else {
        setSortCol(null);
        setSortAsc(true);
      }
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const filteredAndSortedRows = useMemo(() => {
    if (!localRows.length) return [];
    let rows = [...localRows];

    // Filter
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      rows = rows.filter((r) =>
        Object.entries(r).some(([k, v]) => {
          if (k === '_origIdx') return false;
          return String(v ?? '').toLowerCase().includes(q);
        })
      );
    }

    // Sort
    if (sortCol) {
      rows.sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return sortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return rows;
  }, [localRows, filterText, sortCol, sortAsc]);

  // Pagination
  const totalRows = filteredAndSortedRows.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, currentPage, pageSize]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCell(id);
    setTimeout(() => setCopiedCell(null), 1500);
  };

  const handleExport = async (type: 'csv' | 'json' | 'sql') => {
    setShowExportMenu(false);
    if (!result || !result.rows.length) return;

    let content = '';
    let filename = `export_${Date.now()}.${type}`;

    if (type === 'csv') {
      content = exportToCsv(result.columns, localRows);
    } else if (type === 'json') {
      content = exportToJson(localRows);
    } else if (type === 'sql') {
      content = exportToSqlInserts(updatability.tableName || 'TABLE_EXPORT', result.columns, localRows);
    }

    if (window.electronAPI?.exportData) {
      await window.electronAPI.exportData(content, filename, type);
    }
  };

  // Cell editing triggers
  const handleStartEdit = (row: Record<string, any>, col: string) => {
    if (!updatability.isUpdatable) {
      setCellModalValue({ col, value: row[col] });
      return;
    }

    const isPkCol = updatability.primaryKeyColumns.some(pk => pk.toUpperCase() === col.toUpperCase());
    if (isPkCol) {
      // Primary keys are protected to prevent cascade / relational corruption
      setCellModalValue({ col, value: row[col] });
      return;
    }

    const rawVal = row[col];
    const strVal = rawVal === null || rawVal === undefined ? '' : String(rawVal);
    if (strVal.startsWith('[BLOB Binary')) {
      setCellModalValue({ col, value: row[col] });
      return;
    }

    const origIdx = row._origIdx;
    setEditingCell({
      origIdx,
      col,
      value: strVal
    });
  };

  const handleCommitCell = (origIdx: number, col: string, newValue: string) => {
    setEditingCell(null);
    const originalRow = result?.rows[origIdx];
    if (!originalRow) return;

    const originalVal = originalRow[col];
    const origStr = originalVal === null || originalVal === undefined ? '' : String(originalVal);

    if (newValue === origStr) {
      // If reverted back to original, remove from pending edits if present
      setPendingEdits(prev => {
        const next = new Map(prev);
        const rowEdits = next.get(origIdx);
        if (rowEdits) {
          delete rowEdits[col];
          if (Object.keys(rowEdits).length === 0) {
            next.delete(origIdx);
          } else {
            next.set(origIdx, { ...rowEdits });
          }
        }
        return next;
      });
      setLocalRows(prev => {
        const next = [...prev];
        if (next[origIdx]) {
          next[origIdx] = { ...next[origIdx], [col]: originalVal };
        }
        return next;
      });
      return;
    }

    // Value changed: record in pending edits
    setPendingEdits(prev => {
      const next = new Map(prev);
      const existing = next.get(origIdx) || {};
      next.set(origIdx, { ...existing, [col]: newValue });
      return next;
    });

    setLocalRows(prev => {
      const next = [...prev];
      if (next[origIdx]) {
        next[origIdx] = { ...next[origIdx], [col]: newValue };
      }
      return next;
    });
  };

  const handleDiscardChanges = () => {
    if (!result?.rows) return;
    setLocalRows(result.rows.map((r, idx) => ({ ...r, _origIdx: idx })));
    setPendingEdits(new Map());
    setEditingCell(null);
    setSaveError(null);
  };

  const handleSaveChanges = async () => {
    if (!updatability.tableName || pendingEdits.size === 0) return;
    setIsSaving(true);
    setSaveError(null);

    const updates: TableRowUpdate[] = [];

    for (const [origIdx, changedCols] of pendingEdits.entries()) {
      const origRow = result?.rows[origIdx];
      if (!origRow) continue;

      const pkValues: Record<string, any> = {};
      for (const pk of updatability.primaryKeyColumns) {
        const matchKey = Object.keys(origRow).find(k => k.toUpperCase() === pk.toUpperCase()) || pk;
        pkValues[pk] = origRow[matchKey];
      }

      updates.push({
        primaryKeyValues: pkValues,
        updatedValues: changedCols
      });
    }

    try {
      const res = await window.electronAPI.updateTableRows(updatability.tableName, updates);
      if (res.success) {
        // Permanently persist to result.rows
        if (result?.rows) {
          for (const [origIdx, changedCols] of pendingEdits.entries()) {
            if (result.rows[origIdx]) {
              Object.assign(result.rows[origIdx], changedCols);
            }
          }
        }
        setPendingEdits(new Map());
        setSaveSuccessNotice(t('grid.saveSuccess'));
        setTimeout(() => setSaveSuccessNotice(null), 3500);
      } else {
        setSaveError(res.error || 'Error al guardar cambios en Firebird');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Error inesperado al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  if (isRunning) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-900 text-zinc-400 gap-3">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Ejecutando consulta en Firebird...</span>
      </div>
    );
  }

  if (!result || !result.columns || result.columns.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-900 text-zinc-500 text-xs">
        <Layers className="w-8 h-8 text-zinc-700 mb-2" />
        <span>No hay resultados para mostrar. Ejecuta una consulta SQL arriba (F9).</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-900 overflow-hidden relative select-text">
      
      {/* Grid Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-950/80 border-b border-zinc-800 text-xs select-none">
        
        {/* Left: Search in results */}
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={t('common.search')}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 pl-7 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Center: Updatability Badge & Notifications */}
        <div className="flex items-center gap-2 px-2">
          {isCheckingUpdatability ? (
            <span className="text-[11px] text-zinc-500 animate-pulse">Verificando editabilidad...</span>
          ) : updatability.isUpdatable ? (
            <div 
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-600/50 text-emerald-400 text-[11px] font-medium"
              title={`Tabla: ${updatability.tableName} | PK: ${updatability.primaryKeyColumns.join(', ')} (Doble clic en una celda para editar)`}
            >
              <Edit3 className="w-3 h-3 text-emerald-400" />
              <span>{t('grid.editable')} ({updatability.tableName})</span>
            </div>
          ) : (
            <div 
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 text-[11px]"
              title={updatability.readOnlyReason || t('grid.readOnly')}
            >
              <Lock className="w-3 h-3 text-zinc-500" />
              <span className="hidden sm:inline">{t('grid.readOnly')}</span>
            </div>
          )}

          {saveSuccessNotice && (
            <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-medium animate-pulse">
              <Check className="w-3.5 h-3.5" />
              <span>{saveSuccessNotice}</span>
            </div>
          )}
        </div>

        {/* Right: Stats & Export */}
        <div className="flex items-center gap-3">
          
          <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>{result.executionTimeMs} ms</span>
          </div>

          <div className="text-zinc-400 font-mono text-[11px]">
            {totalRows} {t('grid.rows')}
            {result.hasMore && ' (Límite)'}
          </div>

          <div className="h-4 w-px bg-zinc-800" />

          {/* Export button */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded border border-zinc-700/80 transition-colors text-xs font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('grid.exportCsv').split(' ')[0]}</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 z-30 text-xs">
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-800 text-zinc-200 text-left"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('grid.exportCsv')}</span>
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-800 text-zinc-200 text-left"
                >
                  <FileJson className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('grid.exportJson')}</span>
                </button>
                <button
                  onClick={() => handleExport('sql')}
                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-800 text-zinc-200 text-left"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>{t('grid.exportSql')}</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 overflow-auto bg-zinc-900 font-mono text-[12px]">
        <table className="w-full border-collapse text-left">
          
          {/* Table Header */}
          <thead className="sticky top-0 bg-zinc-950 border-b border-zinc-800 z-10 select-none">
            <tr>
              <th className="px-2.5 py-1.5 border-r border-zinc-800 text-zinc-500 font-normal w-12 text-center bg-zinc-950">
                #
              </th>
              {result.columns.map((col) => {
                const isSorted = sortCol === col;
                const isPkCol = updatability.primaryKeyColumns.some(pk => pk.toUpperCase() === col.toUpperCase());

                return (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-3 py-2 border-r border-zinc-800 font-semibold text-zinc-200 hover:bg-zinc-800/80 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {isPkCol && (
                          <Key className="w-3 h-3 text-amber-400 shrink-0" aria-label="Clave Primaria (PK) - Protegida contra edición directa" />
                        )}
                        <span className="truncate">{col}</span>
                      </div>
                      {isSorted && (
                        <span className="text-amber-400 text-xs">
                          {sortAsc ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-zinc-800/60">
            {paginatedRows.map((row, rIdx) => {
              const origIdx = row._origIdx ?? rIdx;
              const rowNum = (currentPage - 1) * pageSize + rIdx + 1;
              const hasRowEdits = pendingEdits.has(origIdx);

              return (
                <tr 
                  key={origIdx} 
                  className={`transition-colors group ${
                    hasRowEdits ? 'bg-amber-950/20 hover:bg-amber-950/30' : 'hover:bg-zinc-800/50'
                  }`}
                >
                  
                  {/* Row index */}
                  <td className="px-2.5 py-1 border-r border-zinc-800/80 text-zinc-500 text-center select-none bg-zinc-950/40 text-[11px] relative">
                    {hasRowEdits && (
                      <span className="absolute left-0.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-400" title="Fila con cambios pendientes" />
                    )}
                    {rowNum}
                  </td>

                  {/* Columns */}
                  {result.columns.map((col) => {
                    const isPkCol = updatability.primaryKeyColumns.some(pk => pk.toUpperCase() === col.toUpperCase());
                    const isCellEditing = editingCell?.origIdx === origIdx && editingCell?.col === col;
                    const isModified = pendingEdits.get(origIdx)?.[col] !== undefined;

                    const rawVal = row[col];
                    const isNull = rawVal === null || rawVal === undefined;
                    const displayVal = isNull ? '(NULL)' : String(rawVal);
                    const cellKey = `${origIdx}_${col}`;

                    if (isCellEditing) {
                      return (
                        <td key={col} className="p-0 border-r border-zinc-800/40 relative bg-zinc-950">
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingCell.value}
                            onChange={(e) => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                            onBlur={() => handleCommitCell(origIdx, col, editingCell.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCommitCell(origIdx, col, editingCell.value);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setEditingCell(null);
                              }
                            }}
                            className="w-full h-full bg-zinc-900 text-amber-200 px-2.5 py-1 text-[12px] font-mono border-2 border-amber-500 outline-none rounded-none shadow-inner"
                          />
                        </td>
                      );
                    }

                    return (
                      <td
                        key={col}
                        onDoubleClick={() => handleStartEdit(row, col)}
                        className={`px-3 py-1 border-r border-zinc-800/40 max-w-xs truncate cursor-cell relative group/cell ${
                          isModified 
                            ? 'bg-amber-500/15 text-amber-200 font-medium' 
                            : isNull 
                              ? 'text-zinc-500 italic' 
                              : 'text-zinc-200'
                        }`}
                        title={
                          isPkCol 
                            ? `[PK] ${displayVal} (${t('grid.pkProtected')})` 
                            : updatability.isUpdatable 
                              ? `Doble clic para editar: ${displayVal}` 
                              : displayVal
                        }
                      >
                        <span className="truncate block">{displayVal}</span>

                        {/* Dirty corner marker indicator */}
                        {isModified && (
                          <span 
                            className="absolute top-0 right-0 w-0 h-0 border-t-[7px] border-r-[7px] border-t-amber-400 border-r-amber-400 border-l-[7px] border-l-transparent border-b-[7px] border-b-transparent pointer-events-none" 
                            title="Valor modificado" 
                          />
                        )}

                        {/* Copy button on hover */}
                        {!isNull && !isModified && (
                          <button
                            onClick={() => copyToClipboard(displayVal, cellKey)}
                            className="opacity-0 group-hover/cell:opacity-100 absolute right-1 top-1/2 -translate-y-1/2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-0.5 rounded shadow transition-opacity select-none cursor-pointer"
                            title="Copiar valor de celda"
                          >
                            {copiedCell === cellKey ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pending Changes Action Bar */}
      {pendingEdits.size > 0 && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-amber-950/95 border-t border-amber-600/60 text-xs text-amber-200 select-none shadow-lg z-20">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="font-semibold text-amber-300">
              {pendingEdits.size} {t('grid.rowsModified')}
            </span>
            <span className="text-amber-300/70 text-[11px] hidden sm:inline">
              — {t('grid.pendingChangesNotice')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {saveError && (
              <button
                onClick={() => setShowErrorModal(true)}
                className="text-red-400 hover:text-red-300 text-[11px] max-w-xs truncate mr-2 underline decoration-dotted text-left cursor-pointer"
                title="Haz clic para ver el error completo de Firebird"
              >
                ⚠️ {saveError}
              </button>
            )}
            <button
              onClick={handleDiscardChanges}
              disabled={isSaving}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors text-xs font-medium cursor-pointer"
            >
              {t('grid.discardChanges')}
            </button>
            <button
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded shadow transition-colors text-xs cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t('grid.saving')}</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('grid.saveChanges')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Pagination & Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-950/90 border-t border-zinc-800 text-xs text-zinc-400 select-none">
        
        <div className="flex items-center gap-2">
          <span>Página {currentPage} de {totalPages}</span>
          <span className="text-zinc-600">|</span>
          <span>Mostrar:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-xs text-zinc-300"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={500}>500</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Cell Detail Modal */}
      {cellModalValue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden text-zinc-200">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-950">
              <span className="font-semibold text-xs text-amber-400 font-mono">
                Detalle de Columna: {cellModalValue.col}
              </span>
              <button
                onClick={() => setCellModalValue(null)}
                className="p-1 text-zinc-400 hover:text-zinc-100 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 font-mono text-xs whitespace-pre-wrap select-text bg-zinc-950/50">
              {cellModalValue.value === null ? '(NULL)' : String(cellModalValue.value)}
            </div>
            <div className="px-4 py-2 bg-zinc-950 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => copyToClipboard(String(cellModalValue.value ?? ''), 'modal')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-200 border border-zinc-700 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar Todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Error Detail Modal */}
      {showErrorModal && saveError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-zinc-900 border border-red-800/80 rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden text-zinc-200">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-red-900/50 bg-red-950/40">
              <div className="flex items-center gap-2 text-red-400 font-semibold text-xs">
                <AlertCircle className="w-4 h-4" />
                <span>Error al Actualizar en Firebird</span>
              </div>
              <button
                onClick={() => setShowErrorModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-100 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-auto font-mono text-xs whitespace-pre-wrap select-text text-red-200 bg-zinc-950/80 max-h-60">
              {saveError}
            </div>
            <div className="px-4 py-2.5 bg-zinc-950 border-t border-zinc-800 flex justify-between items-center text-xs">
              <span className="text-zinc-500 text-[11px]">Tus ediciones en la grilla se preservaron para que puedas corregirlas.</span>
              <button
                onClick={() => setShowErrorModal(false)}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-200 border border-zinc-700 cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
