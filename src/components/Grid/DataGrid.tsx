import React, { useState, useMemo } from 'react';
import { QueryResult } from '../../types';
import { useTranslation } from '../../i18n/I18nContext';
import { exportToCsv, exportToJson, exportToSqlInserts } from '../../utils/exporter';
import { 
  Download, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check, 
  Maximize2, 
  X,
  FileSpreadsheet,
  FileJson,
  FileText,
  Clock,
  Layers
} from 'lucide-react';

interface DataGridProps {
  result: QueryResult | null;
  isRunning: boolean;
}

export const DataGrid: React.FC<DataGridProps> = ({ result, isRunning }) => {
  const { t } = useTranslation();
  const [filterText, setFilterText] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [cellModalValue, setCellModalValue] = useState<{ col: string; value: any } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Reset page when result changes
  React.useEffect(() => {
    setCurrentPage(1);
    setFilterText('');
  }, [result]);

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
    if (!result?.rows) return [];
    let rows = [...result.rows];

    // Filter
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      rows = rows.filter((r) =>
        Object.values(r).some((v) =>
          String(v ?? '').toLowerCase().includes(q)
        )
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
  }, [result?.rows, filterText, sortCol, sortAsc]);

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
      content = exportToCsv(result.columns, result.rows);
    } else if (type === 'json') {
      content = exportToJson(result.rows);
    } else if (type === 'sql') {
      content = exportToSqlInserts('TABLE_EXPORT', result.columns, result.rows);
    }

    if (window.electronAPI?.exportData) {
      await window.electronAPI.exportData(content, filename, type);
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
        
        {/* Search in results */}
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

        {/* Stats & Export */}
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
              className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded border border-zinc-700/80 transition-colors text-xs font-medium"
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
                return (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-3 py-2 border-r border-zinc-800 font-semibold text-zinc-200 hover:bg-zinc-800/80 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{col}</span>
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
              const rowNum = (currentPage - 1) * pageSize + rIdx + 1;
              return (
                <tr key={rIdx} className="hover:bg-zinc-800/50 transition-colors group">
                  
                  {/* Row index */}
                  <td className="px-2.5 py-1 border-r border-zinc-800/80 text-zinc-500 text-center select-none bg-zinc-950/40 text-[11px]">
                    {rowNum}
                  </td>

                  {/* Columns */}
                  {result.columns.map((col) => {
                    const rawVal = row[col];
                    const isNull = rawVal === null || rawVal === undefined;
                    const displayVal = isNull ? '(NULL)' : String(rawVal);
                    const cellKey = `${rIdx}_${col}`;

                    return (
                      <td
                        key={col}
                        onDoubleClick={() => setCellModalValue({ col, value: rawVal })}
                        className={`px-3 py-1 border-r border-zinc-800/40 max-w-xs truncate cursor-cell relative group/cell ${
                          isNull ? 'text-zinc-500 italic' : 'text-zinc-200'
                        }`}
                        title={displayVal}
                      >
                        <span className="truncate block">{displayVal}</span>

                        {/* Copy button on hover */}
                        {!isNull && (
                          <button
                            onClick={() => copyToClipboard(displayVal, cellKey)}
                            className="opacity-0 group-hover/cell:opacity-100 absolute right-1 top-1/2 -translate-y-1/2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-0.5 rounded shadow transition-opacity select-none"
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
            className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 transition-colors"
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
                className="p-1 text-zinc-400 hover:text-zinc-100 rounded"
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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-200 border border-zinc-700"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar Todo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
