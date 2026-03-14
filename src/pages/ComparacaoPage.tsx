import { useState } from 'react';
import { useOPEX } from '@/contexts/OPEXContext';
import { groupBy, getMesesComReal, formatCurrency, formatPercent, getSummary } from '@/lib/opex-utils';
import { MESES_PT } from '@/types/opex';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, ReferenceLine, Cell } from 'recharts';
import { SortableTable, type ColumnDef } from '@/components/SortableTable';
import { ExpenseDetailModal } from '@/components/ExpenseDetailModal';

function SemaforoIcon({ status }: { status: 'green' | 'yellow' | 'red' }) {
  const map = { green: '🟢', yellow: '🟡', red: '🔴' };
  return <span>{map[status]}</span>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="glass-card p-3 text-xs space-y-1">
      <p className="font-semibold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value)}</p>
      ))}
    </div>
  );
};

export default function ComparacaoPage() {
  const { filteredRecords, periodoView, mesSelecionado } = useOPEX();
  const [detailModal, setDetailModal] = useState<{ open: boolean; records: any[]; title: string }>({ open: false, records: [], title: '' });
  const mesesComReal = getMesesComReal(filteredRecords);
  const summary = getSummary(filteredRecords, periodoView, mesSelecionado);

  const isMensal = periodoView === 'mensal' && mesSelecionado;
  const isAnual = periodoView === 'anual';
  const orcLabel = isAnual ? 'Orçado Anual' : isMensal ? `Orçado ${MESES_PT[mesSelecionado! - 1]}` : 'Orçado YTD';
  const realLabel = isAnual ? 'Realizado Acum.' : isMensal ? `Realizado ${MESES_PT[mesSelecionado! - 1]}` : 'Realizado YTD';
  const periodoLabel = isAnual ? 'Visão Anual' : isMensal ? `Mês: ${MESES_PT[mesSelecionado! - 1]}` : 'YTD';

  const areaData = groupBy(filteredRecords, 'areaGrupo1', mesesComReal, periodoView, mesSelecionado).filter(d => d.orcado > 0 || d.realizado > 0);
  const pacoteData = groupBy(filteredRecords, 'pacote', mesesComReal, periodoView, mesSelecionado).filter(d => d.variacao !== 0);
  const waterfallData = pacoteData.sort((a, b) => b.variacao - a.variacao).map(p => ({
    nome: p.nome.replace('PACOTE ', ''),
    variacao: p.variacao,
  }));

  // Accumulated evolution
  let accOrcado = 0;
  let accReal = 0;
  const projecaoMensal = mesesComReal.length > 0 ? summary.projecaoAnual / 12 : 0;
  let accProjecao = 0;
  const accData = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const orc = filteredRecords.filter(r => r.base === 'ORÇ26' && r.mes === mes).reduce((s, r) => s + r.executado, 0);
    const real = filteredRecords.filter(r => r.base === 'REAL26' && r.mes === mes).reduce((s, r) => s + r.executado, 0);
    accOrcado += orc;
    accReal += real;
    accProjecao += projecaoMensal;
    return {
      mesNome: MESES_PT[i],
      orcadoAcc: accOrcado,
      realizadoAcc: mesesComReal.includes(mes) ? accReal : undefined,
      projecaoAcc: mesesComReal.length > 0 ? accProjecao : undefined,
    };
  });

  const alertAreas = areaData.filter(a => Math.abs(a.variacaoPercent) > 20);

  const semaforoColumns: ColumnDef[] = [
    { key: 'semaforo', label: 'Status', align: 'center', sortable: false, render: (v) => <SemaforoIcon status={v} /> },
    { key: 'nome', label: 'Área', align: 'left' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação R$', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
  ];

  const waterfallColumns: ColumnDef[] = [
    { key: 'nome', label: 'Pacote', align: 'left' },
    { key: 'variacao', label: 'Variação R$', align: 'right', format: 'currency' },
  ];

  const openAreaDetail = (areaNome: string) => {
    const recs = filteredRecords.filter(r => r.areaGrupo1 === areaNome);
    setDetailModal({ open: true, records: recs, title: `Área: ${areaNome}` });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orçado vs Realizado</h1>
        <p className="text-sm text-muted-foreground">Análise comparativa e variações — {periodoLabel}</p>
      </div>

      {/* Alerts */}
      {alertAreas.length > 0 && (
        <div className="glass-card p-4 border-warning/30">
          <h3 className="text-sm font-semibold text-warning mb-2">⚠️ Alertas — Variação &gt; 20%</h3>
          <div className="flex flex-wrap gap-2">
            {alertAreas.map(a => (
              <button
                key={a.nome}
                onClick={() => openAreaDetail(a.nome)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${a.variacao > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}
              >
                {a.nome}: {formatPercent(a.variacaoPercent)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Waterfall */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold">Variação por Pacote (Waterfall)</h3>
          <ResponsiveContainer width="100%" height={Math.max(250, waterfallData.length * 32)}>
            <BarChart data={waterfallData} layout="vertical" margin={{ left: 140 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,20%,16%)" />
              <XAxis type="number" tick={{ fill: 'hsl(215,15%,55%)', fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="nome" tick={{ fill: 'hsl(215,15%,55%)', fontSize: 10 }} width={135} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine x={0} stroke="hsl(220,20%,25%)" />
              <Bar dataKey="variacao" name="Variação">
                {waterfallData.map((d, i) => (
                  <Cell key={i} fill={d.variacao > 0 ? 'hsl(0,72%,55%)' : 'hsl(152,60%,42%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <SortableTable columns={waterfallColumns} data={waterfallData} exportFilename="waterfall-pacotes.csv" maxHeight="200px" />
        </div>

        {/* Accumulated evolution */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Evolução Acumulada</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={accData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,20%,16%)" />
              <XAxis dataKey="mesNome" tick={{ fill: 'hsl(215,15%,55%)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'hsl(215,15%,55%)', fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="orcadoAcc" name="Orçado Acum." stroke="hsl(175,70%,45%)" strokeWidth={2} />
              <Line type="monotone" dataKey="realizadoAcc" name="Realizado Acum." stroke="hsl(210,80%,60%)" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
              <Line type="monotone" dataKey="projecaoAcc" name="Projeção" stroke="hsl(38,92%,55%)" strokeWidth={1.5} strokeDasharray="6 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 p-3 rounded-md bg-muted/50 text-xs">
            <span className="text-muted-foreground">Projeção anual: </span>
            <span className={`font-mono font-semibold ${summary.projecaoAnual > summary.orcadoAnual ? 'text-destructive' : 'text-success'}`}>
              {formatCurrency(summary.projecaoAnual)}
            </span>
            <span className="text-muted-foreground"> ({summary.orcadoAnual > 0 ? ((summary.projecaoAnual / summary.orcadoAnual) * 100).toFixed(1) : 0}% do orçado)</span>
          </div>
        </div>
      </div>

      {/* Semáforo por Área */}
      <div>
        <div className="px-1 py-2"><h3 className="text-sm font-semibold">Semáforo por Área</h3></div>
        <SortableTable
          columns={semaforoColumns}
          data={areaData}
          onRowClick={(row) => openAreaDetail(row.nome)}
          exportFilename="semaforo-areas.csv"
        />
      </div>

      <ExpenseDetailModal
        open={detailModal.open}
        onOpenChange={(o) => setDetailModal(prev => ({ ...prev, open: o }))}
        records={detailModal.records}
        title={detailModal.title}
      />
    </div>
  );
}
