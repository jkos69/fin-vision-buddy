import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SortableTable, type ColumnDef } from '@/components/SortableTable';
import { formatCurrency } from '@/lib/opex-utils';
import { MESES_PT, type OPEXRecord } from '@/types/opex';
import { useOPEX } from '@/contexts/OPEXContext';

interface ExpenseDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: OPEXRecord[];
  title: string;
}

export function ExpenseDetailModal({ open, onOpenChange, records, title }: ExpenseDetailModalProps) {
  const { periodoView, mesSelecionado } = useOPEX();
  const [mesesSelecionados, setMesesSelecionados] = useState<number[]>([]);
  const [baseFilter, setBaseFilter] = useState<'all' | 'ORÇ26' | 'REAL26'>('all');

  useEffect(() => {
    if (open) {
      if (periodoView === 'mensal' && mesSelecionado) {
        setMesesSelecionados([mesSelecionado]);
      } else {
        setMesesSelecionados([]);
      }
      setBaseFilter('all');
    }
  }, [open, periodoView, mesSelecionado]);

  const mesesPresentes = useMemo(() => {
    const s = new Set<number>();
    records.forEach(r => s.add(r.mes));
    return Array.from(s).sort((a, b) => a - b);
  }, [records]);

  const mesesComRealNoModal = useMemo(() => {
    const s = new Set<number>();
    records.forEach(r => { if (r.base === 'REAL26') s.add(r.mes); });
    return Array.from(s).sort((a, b) => a - b);
  }, [records]);

  const toggleMes = (mes: number) => {
    setMesesSelecionados(prev =>
      prev.includes(mes) ? prev.filter(m => m !== mes) : [...prev, mes]
    );
  };

  const selecionarTodos = () => setMesesSelecionados([]);
  const selecionarYTD = () => setMesesSelecionados([...mesesComRealNoModal]);

  const isYTD = mesesSelecionados.length > 0 &&
    JSON.stringify([...mesesSelecionados].sort((a, b) => a - b)) === JSON.stringify([...mesesComRealNoModal].sort((a, b) => a - b));

  const filtered = useMemo(() => {
    let recs = records;
    if (mesesSelecionados.length > 0) {
      recs = recs.filter(r => mesesSelecionados.includes(r.mes));
    }
    if (baseFilter !== 'all') {
      recs = recs.filter(r => r.base === baseFilter);
    }
    return recs;
  }, [records, mesesSelecionados, baseFilter]);

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
          {baseFilter !== 'REAL26' && totalOrcado !== 0 && <span>Orçado: <strong className="font-mono">{formatCurrency(totalOrcado)}</strong></span>}
          {baseFilter !== 'ORÇ26' && totalReal !== 0 && <span>Realizado: <strong className="font-mono">{formatCurrency(totalReal)}</strong></span>}
        </div>

        {/* Month filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={selecionarTodos}
            className={`px-2.5 py-1 rounded-md text-xs transition-colors ${mesesSelecionados.length === 0 ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
          >
            Todos
          </button>
          <button
            onClick={selecionarYTD}
            className={`px-2.5 py-1 rounded-md text-xs transition-colors ${isYTD ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
          >
            YTD
          </button>
          {mesesPresentes.map(m => (
            <button
              key={m}
              onClick={() => toggleMes(m)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${mesesSelecionados.includes(m) ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            >
              {MESES_PT[m - 1]}
            </button>
          ))}
        </div>

        {/* Base filter */}
        <div className="flex gap-1.5">
          <span className="text-xs text-muted-foreground self-center mr-1">Base:</span>
          {([
            { value: 'all', label: 'Orçado + Real' },
            { value: 'REAL26', label: 'Só Realizado' },
            { value: 'ORÇ26', label: 'Só Orçado' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => setBaseFilter(opt.value)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${baseFilter === opt.value ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          <SortableTable
            columns={columns}
            data={filtered}
            maxHeight="calc(90vh - 260px)"
            exportFilename={`detalhe-${title.replace(/\s+/g, '-').toLowerCase()}.csv`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
