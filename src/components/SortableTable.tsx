import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import { formatCurrency, formatPercent, exportCSV } from '@/lib/opex-utils';

export interface ColumnDef<T = any> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'currency' | 'percent' | 'number' | 'text';
  sortable?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

interface SortableTableProps<T = any> {
  columns: ColumnDef<T>[];
  data: T[];
  onRowClick?: (row: T, index: number) => void;
  highlightTop?: number;
  maxHeight?: string;
  exportFilename?: string;
  emptyMessage?: string;
  totalsRow?: Record<string, any>;
}

function formatValue(value: any, format?: string): string {
  if (value == null) return '—';
  switch (format) {
    case 'currency': return formatCurrency(Number(value));
    case 'percent': return formatPercent(Number(value));
    case 'number': return Number(value).toLocaleString('pt-BR');
    default: return String(value);
  }
}

export function SortableTable<T extends Record<string, any>>({
  columns, data, onRowClick, highlightTop, maxHeight = '480px', exportFilename, emptyMessage = 'Sem dados', totalsRow,
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollFade, setShowScrollFade] = useState(false);

  const toggleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }, [sortKey]);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  // Check for horizontal scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setShowScrollFade(el.scrollWidth > el.clientWidth && el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    check();
    el.addEventListener('scroll', check);
    window.addEventListener('resize', check);
    return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, [data]);

  const handleExport = useCallback(() => {
    if (!exportFilename) return;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleTimeString('pt-BR');
    const baseName = exportFilename.replace('.csv', '');
    const finalName = `${baseName}-${dateStr}.csv`;

    const headers = columns.map(c => c.label);
    const rows = sortedData.map(row => columns.map(c => {
      const v = row[c.key];
      if (c.format === 'currency') return Number(v).toFixed(2);
      if (c.format === 'percent') return Number(v).toFixed(1);
      return String(v ?? '');
    }));

    const bom = '\uFEFF';
    const comment = `# Exportado de OPEX Control em ${dateStr} ${timeStr}`;
    const csv = bom + [comment, headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalName;
    a.click();
    URL.revokeObjectURL(url);
  }, [columns, sortedData, exportFilename]);

  const isVariationCol = (col: ColumnDef) => col.key.toLowerCase().includes('variacao') || col.key.toLowerCase().includes('variação') || col.key.toLowerCase().includes('varpercent');

  return (
    <div className="data-grid">
      {exportFilename && (
        <div className="flex justify-end px-4 pt-3">
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors" title="Exportar CSV">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      )}
      <div className="relative">
        <div ref={scrollRef} className="overflow-x-auto" style={{ maxHeight }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.sortable !== false ? 'cursor-pointer hover:text-foreground select-none' : ''}`}
                    onClick={() => col.sortable !== false && toggleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable !== false && (
                        sortKey === col.key
                          ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                          : <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {totalsRow && (
                <tr className="border-b-2 border-primary/30 bg-primary/5 font-semibold sticky top-[calc(2.5rem)] z-[9]">
                  {columns.map((col, colIdx) => {
                    const val = totalsRow[col.key];
                    const firstLeftIdx = columns.findIndex(c => c.align === 'left' || !c.align);
                    if (val === undefined || val === null || val === '') {
                      if (colIdx === firstLeftIdx) {
                        return <td key={col.key} className="px-4 py-2.5 text-xs font-bold text-primary">TOTAL</td>;
                      }
                      return <td key={col.key} className="px-4 py-2.5"></td>;
                    }
                    const isVar = col.key.toLowerCase().includes('variacao') || col.key.toLowerCase().includes('variação') || col.key.toLowerCase().includes('varpercent');
                    const colorClass = isVar && typeof val === 'number' ? (val > 0 ? 'text-destructive' : val < 0 ? 'text-success' : 'text-foreground') : 'text-foreground';
                    return (
                      <td key={col.key} className={`px-4 py-2.5 text-xs font-mono font-bold ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${colorClass}`}>
                        {col.format === 'currency' ? formatCurrency(val) : col.format === 'percent' ? formatPercent(val) : col.format === 'number' ? Number(val).toLocaleString('pt-BR') : String(val)}
                      </td>
                    );
                  })}
                </tr>
              )}
                <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">{emptyMessage}</td></tr>
              )}
              {sortedData.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-border/30 transition-colors ${onRowClick ? 'cursor-pointer hover:bg-accent/50' : 'hover:bg-accent/30'} ${highlightTop && idx < highlightTop ? 'bg-primary/5' : ''}`}
                  onClick={() => onRowClick?.(row, idx)}
                >
                  {columns.map(col => {
                    const val = row[col.key];
                    const isVar = isVariationCol(col);
                    const colorClass = isVar && typeof val === 'number' ? (val > 0 ? 'text-destructive' : val < 0 ? 'text-success' : '') : '';
                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-2 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${(col.format === 'currency' || col.format === 'percent' || col.format === 'number') ? 'font-mono' : ''} ${colorClass}`}
                      >
                        {col.render ? col.render(val, row, idx) : formatValue(val, col.format)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {showScrollFade && (
          <div className="absolute right-0 top-0 bottom-0 w-5 pointer-events-none bg-gradient-to-r from-transparent to-card" />
        )}
      </div>
    </div>
  );
}
