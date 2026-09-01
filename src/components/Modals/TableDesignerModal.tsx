import React, { useState, useEffect, useMemo } from 'react';
import { 
  TableDetails, 
  TableColumnDetails 
} from '../../types';
import { 
  Table, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Key, 
  Check, 
  Code2, 
  Sliders, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Play, 
  FileCode,
  Sparkles,
  RefreshCw,
  Edit3
} from 'lucide-react';

export interface DesignerColumn {
  id: string;
  originalName?: string; // If editing existing column
  originalPosition?: number;
  originalType?: string;
  name: string;
  type: string;
  length: string;
  scale: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue: string;
  isNew?: boolean;
}

interface TableDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string | null; // null => CREATE TABLE, string => ALTER TABLE
  onSuccess: (tableName: string) => void;
  onOpenInSqlEditor: (sql: string, title?: string) => void;
}

const FIREBIRD_DATA_TYPES = [
  { value: 'VARCHAR', label: 'VARCHAR', hasLength: true, defaultLength: '100' },
  { value: 'CHAR', label: 'CHAR', hasLength: true, defaultLength: '1' },
  { value: 'INTEGER', label: 'INTEGER', hasLength: false },
  { value: 'BIGINT', label: 'BIGINT', hasLength: false },
  { value: 'SMALLINT', label: 'SMALLINT', hasLength: false },
  { value: 'NUMERIC', label: 'NUMERIC(p, s)', hasLength: true, hasScale: true, defaultLength: '15', defaultScale: '2' },
  { value: 'DECIMAL', label: 'DECIMAL(p, s)', hasLength: true, hasScale: true, defaultLength: '15', defaultScale: '2' },
  { value: 'TIMESTAMP', label: 'TIMESTAMP', hasLength: false },
  { value: 'DATE', label: 'DATE', hasLength: false },
  { value: 'TIME', label: 'TIME', hasLength: false },
  { value: 'DOUBLE PRECISION', label: 'DOUBLE PRECISION', hasLength: false },
  { value: 'FLOAT', label: 'FLOAT', hasLength: false },
  { value: 'BLOB SUB_TYPE TEXT', label: 'BLOB (Texto / Memo)', hasLength: false },
  { value: 'BLOB SUB_TYPE BINARY', label: 'BLOB (Binario / Imagen)', hasLength: false },
  { value: 'BOOLEAN', label: 'BOOLEAN (FB 3+)', hasLength: false }
];

export const TableDesignerModal: React.FC<TableDesignerModalProps> = ({
  isOpen,
  onClose,
  tableName,
  onSuccess,
  onOpenInSqlEditor
}) => {
  const isEditMode = Boolean(tableName);

  const [currentTableName, setCurrentTableName] = useState<string>('NUEVA_TABLA');
  const [columns, setColumns] = useState<DesignerColumn[]>([]);
  const [deletedColumns, setDeletedColumns] = useState<DesignerColumn[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'designer' | 'sql'>('designer');
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Load existing table structure when in edit mode
  useEffect(() => {
    if (!isOpen) return;

    setExecutionError(null);
    setDeletedColumns([]);
    setActiveTab('designer');

    if (isEditMode && tableName) {
      setCurrentTableName(tableName);
      loadTableStructure(tableName);
    } else {
      setCurrentTableName('NUEVA_TABLA');
      // Default template for new table
      setColumns([
        {
          id: 'col_' + Date.now() + '_1',
          name: 'ID',
          type: 'INTEGER',
          length: '',
          scale: '',
          isNullable: false,
          isPrimaryKey: true,
          defaultValue: '',
          isNew: true
        },
        {
          id: 'col_' + Date.now() + '_2',
          name: 'DESCRIPCION',
          type: 'VARCHAR',
          length: '100',
          scale: '',
          isNullable: true,
          isPrimaryKey: false,
          defaultValue: '',
          isNew: true
        },
        {
          id: 'col_' + Date.now() + '_3',
          name: 'FECHA_CREACION',
          type: 'TIMESTAMP',
          length: '',
          scale: '',
          isNullable: true,
          isPrimaryKey: false,
          defaultValue: 'CURRENT_TIMESTAMP',
          isNew: true
        }
      ]);
    }
  }, [isOpen, tableName, isEditMode]);

  const loadTableStructure = async (tbl: string) => {
    setIsLoadingDetails(true);
    try {
      if (window.electronAPI?.getTableDetails) {
        const res = await window.electronAPI.getTableDetails(tbl);
        if (res.success && res.data) {
          const loadedCols: DesignerColumn[] = res.data.columns.map((c, idx) => {
            // Parse base type & length
            let baseType = 'VARCHAR';
            let len = '';
            let sc = '';

            const rawType = c.fieldType.toUpperCase();
            if (rawType.startsWith('VARCHAR')) {
              baseType = 'VARCHAR';
              const match = rawType.match(/\((\d+)\)/);
              if (match) len = match[1];
            } else if (rawType.startsWith('CHAR')) {
              baseType = 'CHAR';
              const match = rawType.match(/\((\d+)\)/);
              if (match) len = match[1];
            } else if (rawType.startsWith('NUMERIC')) {
              baseType = 'NUMERIC';
              const match = rawType.match(/\((\d+),\s*(\d+)\)/);
              if (match) {
                len = match[1];
                sc = match[2];
              }
            } else if (rawType.startsWith('DECIMAL')) {
              baseType = 'DECIMAL';
              const match = rawType.match(/\((\d+),\s*(\d+)\)/);
              if (match) {
                len = match[1];
                sc = match[2];
              }
            } else if (rawType.includes('BLOB') && rawType.includes('TEXT')) {
              baseType = 'BLOB SUB_TYPE TEXT';
            } else if (rawType.includes('BLOB')) {
              baseType = 'BLOB SUB_TYPE BINARY';
            } else if (rawType.includes('DOUBLE')) {
              baseType = 'DOUBLE PRECISION';
            } else if (FIREBIRD_DATA_TYPES.some(t => t.value === rawType)) {
              baseType = rawType;
            } else {
              baseType = rawType;
            }

            return {
              id: 'col_orig_' + idx + '_' + c.columnName,
              originalName: c.columnName,
              originalPosition: idx + 1,
              originalType: c.fieldType,
              name: c.columnName,
              type: baseType,
              length: len || (c.length ? String(c.length) : ''),
              scale: sc || (c.scale ? String(Math.abs(c.scale)) : ''),
              isNullable: c.isNullable,
              isPrimaryKey: c.isPrimaryKey,
              defaultValue: (c.defaultValue || '').replace(/^DEFAULT\s+/i, '').trim(),
              isNew: false
            };
          });
          setColumns(loadedCols);
        }
      }
    } catch (err: any) {
      setExecutionError('Error cargando estructura: ' + (err.message || String(err)));
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Helper to format full data type with length/scale
  const formatFullDataType = (col: DesignerColumn): string => {
    const typeMeta = FIREBIRD_DATA_TYPES.find(t => t.value === col.type);
    if (col.type === 'VARCHAR' || col.type === 'CHAR') {
      const l = col.length.trim() || '50';
      return `${col.type}(${l})`;
    }
    if (col.type === 'NUMERIC' || col.type === 'DECIMAL') {
      const p = col.length.trim() || '15';
      const s = col.scale.trim() || '2';
      return `${col.type}(${p}, ${s})`;
    }
    return col.type;
  };

  // Generate DDL script based on changes
  const generatedSql = useMemo(() => {
    const tblName = currentTableName.trim().toUpperCase() || 'NUEVA_TABLA';

    if (!isEditMode) {
      // CREATE TABLE
      if (columns.length === 0) return `-- Agrega al menos un campo para generar el CREATE TABLE`;

      let ddl = `CREATE TABLE ${tblName} (\n`;
      const colDefs: string[] = [];

      columns.forEach(col => {
        if (!col.name.trim()) return;
        let def = `    ${col.name.trim().toUpperCase()} ${formatFullDataType(col)}`;
        if (col.defaultValue.trim()) {
          def += ` DEFAULT ${col.defaultValue.trim()}`;
        }
        if (!col.isNullable) {
          def += ` NOT NULL`;
        }
        colDefs.push(def);
      });

      const pkCols = columns.filter(c => c.isPrimaryKey && c.name.trim()).map(c => c.name.trim().toUpperCase());
      if (pkCols.length > 0) {
        colDefs.push(`    CONSTRAINT PK_${tblName} PRIMARY KEY (${pkCols.join(', ')})`);
      }

      ddl += colDefs.join(',\n') + '\n);';
      return ddl;
    } else {
      // ALTER TABLE operations
      const statements: string[] = [];

      // 1. Dropped columns
      deletedColumns.forEach(del => {
        if (del.originalName) {
          statements.push(`ALTER TABLE ${tblName} DROP ${del.originalName};`);
        }
      });

      // 2. Added new columns
      columns.forEach(col => {
        if (col.isNew && col.name.trim()) {
          let stmt = `ALTER TABLE ${tblName} ADD ${col.name.trim().toUpperCase()} ${formatFullDataType(col)}`;
          if (col.defaultValue.trim()) {
            stmt += ` DEFAULT ${col.defaultValue.trim()}`;
          }
          if (!col.isNullable) {
            stmt += ` NOT NULL`;
          }
          statements.push(stmt + ';');
        }
      });

      // 3. Renamed columns (Firebird: ALTER TABLE t ALTER COLUMN old_name TO new_name)
      columns.forEach(col => {
        if (!col.isNew && col.originalName && col.name.trim()) {
          const currentUpper = col.name.trim().toUpperCase();
          const origUpper = col.originalName.trim().toUpperCase();
          if (currentUpper !== origUpper) {
            statements.push(`ALTER TABLE ${tblName} ALTER COLUMN ${origUpper} TO ${currentUpper};`);
          }
        }
      });

      // 4. Modified data types (Firebird: ALTER TABLE t ALTER COLUMN col_name TYPE new_type)
      columns.forEach(col => {
        if (!col.isNew && col.name.trim()) {
          const newTypeStr = formatFullDataType(col);
          if (col.originalType && newTypeStr.toUpperCase() !== col.originalType.toUpperCase()) {
            const effectiveName = col.name.trim().toUpperCase();
            statements.push(`ALTER TABLE ${tblName} ALTER COLUMN ${effectiveName} TYPE ${newTypeStr};`);
          }
        }
      });

      // 5. Reordered column positions (Firebird: ALTER TABLE t ALTER COLUMN col_name POSITION N)
      columns.forEach((col, idx) => {
        const targetPos = idx + 1;
        const effectiveName = col.name.trim().toUpperCase();
        // Check if position changed
        if (col.originalPosition !== targetPos && effectiveName) {
          statements.push(`ALTER TABLE ${tblName} ALTER COLUMN ${effectiveName} POSITION ${targetPos};`);
        }
      });

      if (statements.length === 0) {
        return `-- No se han detectado modificaciones en la estructura de la tabla ${tblName}`;
      }

      return statements.join('\n');
    }
  }, [currentTableName, columns, deletedColumns, isEditMode]);

  // Actions
  const handleAddColumn = () => {
    const newCol: DesignerColumn = {
      id: 'col_' + Date.now() + '_' + (columns.length + 1),
      name: `CAMPO_${columns.length + 1}`,
      type: 'VARCHAR',
      length: '50',
      scale: '',
      isNullable: true,
      isPrimaryKey: false,
      defaultValue: '',
      isNew: true
    };
    setColumns([...columns, newCol]);
  };

  const handleDeleteColumn = (index: number) => {
    const colToDelete = columns[index];
    if (!colToDelete.isNew) {
      setDeletedColumns([...deletedColumns, colToDelete]);
    }
    setColumns(columns.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newCols = [...columns];
    const temp = newCols[index - 1];
    newCols[index - 1] = newCols[index];
    newCols[index] = temp;
    setColumns(newCols);
  };

  const handleMoveDown = (index: number) => {
    if (index === columns.length - 1) return;
    const newCols = [...columns];
    const temp = newCols[index + 1];
    newCols[index + 1] = newCols[index];
    newCols[index] = temp;
    setColumns(newCols);
  };

  const handleColumnChange = (index: number, field: keyof DesignerColumn, value: any) => {
    const newCols = [...columns];
    newCols[index] = { ...newCols[index], [field]: value };
    
    // Auto-adjust default length/scale when type changes
    if (field === 'type') {
      const typeInfo = FIREBIRD_DATA_TYPES.find(t => t.value === value);
      if (typeInfo?.hasLength && !newCols[index].length) {
        newCols[index].length = typeInfo.defaultLength || '50';
      }
      if (typeInfo?.hasScale && !newCols[index].scale) {
        newCols[index].scale = typeInfo.defaultScale || '2';
      }
    }

    setColumns(newCols);
  };

  // Execute DDL
  const handleApplyChanges = async () => {
    if (!currentTableName.trim()) {
      setExecutionError('Debes especificar el nombre de la tabla.');
      return;
    }

    if (columns.length === 0) {
      setExecutionError('La tabla debe contener al menos un campo.');
      return;
    }

    setIsExecuting(true);
    setExecutionError(null);

    try {
      if (window.electronAPI?.executeScript) {
        const res = await window.electronAPI.executeScript(generatedSql);
        if (!res.success) {
          throw new Error(res.error || 'Error al ejecutar las sentencias DDL.');
        }

        onSuccess(currentTableName.trim().toUpperCase());
        onClose();
      }
    } catch (err: any) {
      setExecutionError(err.message || String(err));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleOpenInEditor = () => {
    onOpenInSqlEditor(generatedSql, isEditMode ? `Alter ${currentTableName}` : `Create ${currentTableName}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-zinc-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${
              isEditMode 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              <Table className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-100">
                  {isEditMode ? `Diseñador / Editor de Tabla: ${tableName}` : 'Crear Nueva Tabla'}
                </h2>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                  isEditMode ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {isEditMode ? 'Modo Alter' : 'Modo Create'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Agrega, renombra, reordena campos y modifica tipos de datos en Firebird
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setActiveTab('designer')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'designer' 
                    ? 'bg-zinc-800 text-amber-400 font-medium shadow-xs' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Campos</span>
              </button>
              <button
                onClick={() => setActiveTab('sql')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'sql' 
                    ? 'bg-zinc-800 text-amber-400 font-medium shadow-xs' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Vista Previa SQL</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Table Name Toolbar */}
        <div className="px-6 py-3 border-b border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider shrink-0">
              Nombre de la Tabla:
            </span>
            <input
              type="text"
              value={currentTableName}
              onChange={(e) => setCurrentTableName(e.target.value.toUpperCase())}
              disabled={isEditMode}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-amber-400 uppercase focus:outline-none focus:border-amber-500 disabled:opacity-80"
              placeholder="NOMBRE_TABLA"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>{columns.length} campos</span>
            {deletedColumns.length > 0 && (
              <span className="text-red-400">({deletedColumns.length} a eliminar)</span>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoadingDetails ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-zinc-400">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
              <span className="text-xs">Cargando estructura de la tabla...</span>
            </div>
          ) : activeTab === 'designer' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Columns Table Header */}
              <div className="bg-zinc-950/80 border-b border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 grid grid-cols-12 px-6 py-2.5 shrink-0">
                <div className="col-span-1 text-center">Orden</div>
                <div className="col-span-3">Nombre del Campo</div>
                <div className="col-span-3">Tipo de Dato</div>
                <div className="col-span-1 text-center">Long / Esc</div>
                <div className="col-span-1 text-center">PK</div>
                <div className="col-span-1 text-center">Null</div>
                <div className="col-span-1">Valor Default</div>
                <div className="col-span-1 text-center">Acciones</div>
              </div>

              {/* Columns List Scrollable */}
              <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/50 px-6 py-2 space-y-1">
                {columns.map((col, index) => {
                  const typeMeta = FIREBIRD_DATA_TYPES.find(t => t.value === col.type);
                  const isRenamed = !col.isNew && col.originalName && col.originalName !== col.name;

                  return (
                    <div 
                      key={col.id} 
                      className={`grid grid-cols-12 items-center gap-2 py-1.5 px-2 rounded-lg transition-colors group ${
                        col.isNew 
                          ? 'bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-500/20' 
                          : isRenamed 
                          ? 'bg-amber-950/20 hover:bg-amber-950/30 border border-amber-500/20' 
                          : 'hover:bg-zinc-800/40'
                      }`}
                    >
                      {/* Reorder Buttons & Position */}
                      <div className="col-span-1 flex items-center justify-center gap-1">
                        <span className="text-xs font-mono text-zinc-500 w-4 text-center">
                          {index + 1}
                        </span>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            title="Subir posición"
                            className="p-0.5 text-zinc-500 hover:text-amber-400 disabled:opacity-20 transition-colors"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === columns.length - 1}
                            title="Bajar posición"
                            className="p-0.5 text-zinc-500 hover:text-amber-400 disabled:opacity-20 transition-colors"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Field Name */}
                      <div className="col-span-3">
                        <div className="relative">
                          <input
                            type="text"
                            value={col.name}
                            onChange={(e) => handleColumnChange(index, 'name', e.target.value.toUpperCase())}
                            className={`w-full bg-zinc-950 border rounded px-2 py-1 text-xs font-mono font-medium focus:outline-none transition-colors ${
                              isRenamed 
                                ? 'border-amber-500 text-amber-300' 
                                : col.isNew 
                                ? 'border-emerald-500/50 text-emerald-300' 
                                : 'border-zinc-700 text-zinc-100 focus:border-amber-500'
                            }`}
                            placeholder="NOMBRE_CAMPO"
                          />
                          {isRenamed && (
                            <span className="text-[10px] text-zinc-500 block truncate mt-0.5 font-mono">
                              orig: {col.originalName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Data Type Selector */}
                      <div className="col-span-3">
                        <select
                          value={col.type}
                          onChange={(e) => handleColumnChange(index, 'type', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                        >
                          {FIREBIRD_DATA_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Length & Scale Inputs */}
                      <div className="col-span-1 flex items-center justify-center gap-1">
                        {typeMeta?.hasLength ? (
                          <input
                            type="text"
                            value={col.length}
                            onChange={(e) => handleColumnChange(index, 'length', e.target.value)}
                            placeholder="Tam"
                            className="w-10 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-1 text-xs text-center font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                          />
                        ) : (
                          <span className="text-zinc-600 text-xs">-</span>
                        )}

                        {typeMeta?.hasScale && (
                          <input
                            type="text"
                            value={col.scale}
                            onChange={(e) => handleColumnChange(index, 'scale', e.target.value)}
                            placeholder="Esc"
                            className="w-8 bg-zinc-950 border border-zinc-700 rounded px-1 py-1 text-xs text-center font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                          />
                        )}
                      </div>

                      {/* Primary Key Checkbox */}
                      <div className="col-span-1 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            const newPk = !col.isPrimaryKey;
                            handleColumnChange(index, 'isPrimaryKey', newPk);
                            if (newPk) {
                              handleColumnChange(index, 'isNullable', false);
                            }
                          }}
                          className={`p-1 rounded transition-colors ${
                            col.isPrimaryKey 
                              ? 'text-amber-400 bg-amber-500/20' 
                              : 'text-zinc-600 hover:text-zinc-400'
                          }`}
                          title={col.isPrimaryKey ? 'Es Clave Primaria' : 'Hacer Clave Primaria'}
                        >
                          <Key className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Nullable Checkbox */}
                      <div className="col-span-1 flex items-center justify-center">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={col.isNullable}
                            disabled={col.isPrimaryKey}
                            onChange={(e) => handleColumnChange(index, 'isNullable', e.target.checked)}
                            className="rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-0 disabled:opacity-40"
                          />
                        </label>
                      </div>

                      {/* Default Value */}
                      <div className="col-span-1">
                        <input
                          type="text"
                          value={col.defaultValue}
                          onChange={(e) => handleColumnChange(index, 'defaultValue', e.target.value)}
                          placeholder="Default"
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-300 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Actions: Delete */}
                      <div className="col-span-1 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteColumn(index)}
                          title="Eliminar campo"
                          className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>

              {/* Add Column Bar */}
              <div className="px-6 py-2.5 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Campo</span>
                </button>

                <div className="text-[11px] text-zinc-500 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <ArrowUp className="w-3 h-3 text-amber-400" />
                    <ArrowDown className="w-3 h-3 text-amber-400" /> Reordenar campos
                  </span>
                  <span>•</span>
                  <span>Usa ALTER COLUMN POSITION nativo</span>
                </div>
              </div>
            </div>
          ) : (
            /* SQL DDL Preview Tab */
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Script DDL Generado para Firebird:
                </span>
                <span className="text-[11px] text-zinc-500">
                  {isEditMode ? 'Sentencias ALTER TABLE' : 'Sentencia CREATE TABLE'}
                </span>
              </div>
              <textarea
                readOnly
                value={generatedSql}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-amber-300/90 leading-relaxed resize-none focus:outline-none select-text"
              />
            </div>
          )}

          {/* Execution Error Banner */}
          {executionError && (
            <div className="mx-6 my-2 p-3 bg-red-950/40 border border-red-500/40 rounded-lg flex items-start gap-2.5 text-xs text-red-300 shrink-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <div className="whitespace-pre-wrap font-mono">{executionError}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleOpenInEditor}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-xs font-medium transition-colors"
            title="Copiar DDL a una pestaña de consulta SQL"
          >
            <FileCode className="w-4 h-4 text-amber-400" />
            <span>Abrir en Editor SQL</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleApplyChanges}
              disabled={isExecuting || columns.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs disabled:opacity-50 transition-all shadow-md shadow-emerald-600/20"
            >
              <Play className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
              {isExecuting 
                ? 'Aplicando cambios DDL...' 
                : isEditMode 
                ? 'Aplicar Cambios a la Tabla' 
                : 'Crear Tabla'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
