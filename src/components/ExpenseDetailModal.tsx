import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SortableTable, type ColumnDef } from '@/components/SortableTable';
import { formatCurrency } from '@/lib/opex-utils';
import { MESES_PT, type OPEXRecord } from '@/types/opex';

interface ExpenseDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: OPEXRecord[];
  title: string;
}

export function ExpenseDetailModal({ open, onOpenChange, records, title }: ExpenseDetailModalProps) {
  const [mesFilter, setMesFilter] = useState<number | null>(null);

  const mesesPresentes = useMemo(() => {
    const s = new Set<number>();
    records.forEach(r => s.add(r.mes));
    return Array.from(s).sort((a, b) => a - b);
  }, [records]);

  const filtered = useMemo(() => {
    return mesFilter ? records.filter(r => r.mes === mesFilter) : records;
  }, [records, mesFilter]);

  const totalExecutado = filtered.reduce((s, r) => s + r.executado, 0);
  const totalOrcado = filtered.filter(r => r.base === 'ORÇ26').reduce((s, r) => s + r.executado, 0);
  const totalReal = filtered.filter(r => r.base === 'REAL26').reduce((s, r) => s + r.executado, 0);

  const columns: ColumnDef<OPEXRecord>[] = [
    { key: 'base', label: 'Base', align: 'left' },
    { key: 'mes', label: 'Mês', align: 'center', render: (v) => MESES_PT[(v as number) - 1] || v },
    { key: '_ccusto', label: 'Centro de Custo', align: 'left', render: (_, row) => `${row.centroCusto} - ${row.descricaoCCusto}` },
    { key: 'descricaoConta', label: 'Desc. Conta', align: 'left' },
    { key: 'historico', label: 'Histórico', align: 'left' },
    { key: '_fornecedor', label: 'Fornecedor', align: 'left', render: (_, row) => row.nomeFornecedor || row.fornecedorGerencial || '—' },
    { key: 'descPedido', label: 'Desc. Pedido', align: 'left' },
    { key: 'debito', label: 'Débito', align: 'right', format: 'currency' },
    { key: 'credito', label: 'Crédito', align: 'right', format: 'currency' },
    { key: 'executado', label: 'Executado', align: 'right', format: 'currency' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="flex flex-wrap gap-4 text-xs pb-2 border-b border-border">
          <span className="text-muted-foreground">{filtered.length} registros</span>
          <span>Total: <strong className="font-mono">{formatCurrency(totalExecutado)}</strong></span>
          {totalOrcado > 0 && <span>Orçado: <strong className="font-mono">{formatCurrency(totalOrcado)}</strong></span>}
          {totalReal > 0 && <span>Realizado: <strong className="font-mono">{formatCurrency(totalReal)}</strong></span>}
        </div>

        {/* Month filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setMesFilter(null)}
            className={`px-2.5 py-1 rounded-md text-xs transition-colors ${mesFilter === null ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
          >
            Todos
          </button>
          {mesesPresentes.map(m => (
            <button
              key={m}
              onClick={() => setMesFilter(m)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${mesFilter === m ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            >
              {MESES_PT[m - 1]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          <SortableTable
            columns={columns}
            data={filtered}
            maxHeight="calc(90vh - 220px)"
            exportFilename={`detalhe-${title.replace(/\s+/g, '-').toLowerCase()}.csv`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
