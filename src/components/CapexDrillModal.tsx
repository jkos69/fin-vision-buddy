import { useEffect, useMemo } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { SortableTable, ColumnDef } from './SortableTable';
import { computeTotals } from '@/lib/totals-helper';

export interface DrillDBRow {
  id: string;
  base: 'orc' | 'real';
  diretoria: string | null;
  area: string | null;
  centro_custo: string | null;
  desc_centro_custo: string | null;
  nome_projeto: string | null;
  grupo_pacotes: string | null;
  razao_social: string | null;
  historico: string | null;
  data_lancamento: string | null;
  nf_numero: string | null;
  executado: number;
  mes_num: number;
}

export type DrillLevel = 'diretoria' | 'area' | 'projeto' | 'centro_custo' | 'lancamento';

export interface DrillState {
  level: DrillLevel;
  diretoria?: string;
  area?: string;
  projeto?: string;
  pacote?: string;
  centro_custo?: string;
}

interface Props {
  rows: DrillDBRow[];
  drill: DrillState;
  onDrillChange: (newDrill: DrillState | null) => void;
}

export function CapexDrillModal({ rows, drill, onDrillChange }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDrillChange(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDrillChange]);

  const scoped = useMemo(() => rows.filter(r => {
    if (drill.diretoria && r.diretoria !== drill.diretoria) return false;
    if (drill.area && r.area !== drill.area) return false;
    if (drill.projeto && r.nome_projeto !== drill.projeto) return false;
    if (drill.pacote && (r.grupo_pacotes || '').trim() !== drill.pacote) return false;
    if (drill.centro_custo && r.centro_custo !== drill.centro_custo) return false;
    return true;
  }), [rows, drill]);

  const crumbs: string[] = [];
  if (drill.pacote) crumbs.push(`Pacote: ${drill.pacote}`);
  if (drill.diretoria) crumbs.push(drill.diretoria);
  if (drill.area) crumbs.push(drill.area);
  if (drill.projeto) crumbs.push(drill.projeto);
  if (drill.centro_custo) crumbs.push(drill.centro_custo);

  const isLanc = drill.level === 'lancamento';

  const data = useMemo(() => {
    if (isLanc) {
      return scoped.filter(r => r.base === 'real').map(r => ({
        data_lancamento: r.data_lancamento || '',
        historico: r.historico || '',
        nf_numero: r.nf_numero || '',
        razao_social: r.razao_social || '',
        centro_custo: r.centro_custo ? `${r.centro_custo} - ${r.desc_centro_custo || ''}` : '',
        grupo_pacotes: (r.grupo_pacotes || '').trim(),
        executado: r.executado,
      })).sort((a, b) => (a.data_lancamento < b.data_lancamento ? 1 : -1));
    }
    const keyFn: (r: DrillDBRow) => string =
      drill.level === 'area' ? r => r.area || '' :
      drill.level === 'projeto' ? r => r.nome_projeto || '' :
      drill.level === 'centro_custo' ? r => r.centro_custo ? `${r.centro_custo} - ${r.desc_centro_custo || ''}` : '' :
      r => r.diretoria || '';
    const map = new Map<string, { chave: string; orcado: number; realizado: number }>();
    for (const r of scoped) {
      const k = keyFn(r);
      if (!k) continue;
      let row = map.get(k);
      if (!row) { row = { chave: k, orcado: 0, realizado: 0 }; map.set(k, row); }
      if (r.base === 'orc') row.orcado += r.executado;
      else row.realizado += r.executado;
    }
    return Array.from(map.values()).map(r => ({
      ...r,
      saldo: r.orcado - r.realizado,
      variacaoPercent: r.orcado !== 0 ? ((r.realizado - r.orcado) / r.orcado) * 100 : 0,
    })).filter(r => r.orcado !== 0 || r.realizado !== 0).sort((a, b) => b.orcado - a.orcado);
  }, [scoped, drill.level, isLanc]);

  const levelLabel = drill.level === 'area' ? 'Área' : drill.level === 'projeto' ? 'Projeto' : drill.level === 'centro_custo' ? 'Centro de Custo' : 'Diretoria';

  const aggColumns: ColumnDef[] = [
    { key: 'chave', label: levelLabel, align: 'left' },
    { key: 'orcado', label: 'Orçado', align: 'right', format: 'currency' },
    { key: 'realizado', label: 'Realizado', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: '% Var', align: 'right', format: 'percent' },
    { key: 'saldo', label: 'Saldo', align: 'right', format: 'currency' },
  ];

  const lancColumns: ColumnDef[] = [
    { key: 'data_lancamento', label: 'Data', align: 'left' },
    { key: 'nf_numero', label: 'NF', align: 'left' },
    { key: 'razao_social', label: 'Fornecedor', align: 'left' },
    { key: 'historico', label: 'Histórico', align: 'left' },
    { key: 'centro_custo', label: 'Centro de Custo', align: 'left' },
    { key: 'grupo_pacotes', label: 'Pacote', align: 'left' },
    { key: 'executado', label: 'Valor', align: 'right', format: 'currency' },
  ];

  const handleRowClick = (row: any) => {
    if (drill.level === 'diretoria') onDrillChange({ ...drill, level: 'area', diretoria: row.chave });
    else if (drill.level === 'area') onDrillChange({ ...drill, level: 'projeto', area: row.chave });
    else if (drill.level === 'projeto') onDrillChange({ ...drill, level: 'centro_custo', projeto: row.chave });
    else if (drill.level === 'centro_custo') onDrillChange({ ...drill, level: 'lancamento', centro_custo: (row.chave as string).split(' - ')[0] });
  };

  const goBack = () => {
    const { level, diretoria, area, projeto, pacote } = drill;
    if (level === 'lancamento') onDrillChange({ level: 'centro_custo', diretoria, area, projeto, pacote });
    else if (level === 'centro_custo') onDrillChange({ level: 'projeto', diretoria, area, pacote });
    else if (level === 'projeto') onDrillChange(pacote ? { level: 'projeto', pacote } : { level: 'area', diretoria });
    else if (level === 'area') onDrillChange({ level: 'diretoria' });
    else onDrillChange(null);
  };

  const totals = isLanc
    ? computeTotals(data, ['executado'])
    : computeTotals(data, ['orcado', 'realizado', 'saldo', 'variacaoPercent']);

  const canGoBack = drill.level !== 'diretoria' || !!drill.pacote;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => onDrillChange(null)}>
      <div className="glass-card w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 p-4 border-b border-border">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
              <button onClick={() => onDrillChange(null)} className="hover:text-primary">Capex</button>
              {crumbs.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-foreground">{c}</span>
                </span>
              ))}
            </div>
            <h3 className="text-sm font-semibold mt-1">
              {isLanc ? 'Lançamentos individuais' : `Detalhamento por ${levelLabel}`}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canGoBack && (
              <button onClick={goBack} className="text-xs px-3 py-1 rounded-md text-muted-foreground hover:bg-accent">← Voltar</button>
            )}
            <button onClick={() => onDrillChange(null)} className="p-1 rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="overflow-auto p-4">
          <SortableTable
            columns={isLanc ? lancColumns : aggColumns}
            data={data}
            totalsRow={totals}
            onRowClick={isLanc ? undefined : handleRowClick}
            maxHeight="65vh"
            emptyMessage="Sem dados"
          />
          {!isLanc && data.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">Clique em uma linha para descer um nível.</p>
          )}
        </div>
      </div>
    </div>
  );
}
