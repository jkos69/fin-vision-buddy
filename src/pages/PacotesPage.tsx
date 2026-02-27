import { useState } from 'react';
import { useOPEX } from '@/contexts/OPEXContext';
import { groupBy, getMesesComReal, formatCurrency, formatPercent } from '@/lib/opex-utils';
import { MESES_PT } from '@/types/opex';
import { Package, ChevronRight, LayoutGrid, Table2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { SortableTable, type ColumnDef } from '@/components/SortableTable';
import { ExpenseDetailModal } from '@/components/ExpenseDetailModal';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  const orc = payload.find((p: any) => p.name === 'Orçado');
  const real = payload.find((p: any) => p.name === 'Realizado');
  const variacao = orc && real ? real.value - orc.value : null;
  return (
    <div className="glass-card p-3 text-xs space-y-1">
      <p className="font-semibold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value)}</p>
      ))}
      {variacao !== null && (
        <p className={variacao > 0 ? 'text-destructive' : 'text-success'}>Variação: {formatCurrency(variacao)}</p>
      )}
    </div>
  );
};

export default function PacotesPage() {
  const { filteredRecords, periodoView } = useOPEX();
  const [selectedPacote, setSelectedPacote] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [detailModal, setDetailModal] = useState<{ open: boolean; records: any[]; title: string }>({ open: false, records: [], title: '' });
  const mesesComReal = getMesesComReal(filteredRecords);

  const pacoteOverview = groupBy(filteredRecords, 'pacote', mesesComReal, periodoView).filter(p => p.orcado > 0 || p.realizado > 0);
  const isAnual = periodoView === 'anual';
  const orcLabel = isAnual ? 'Orçado Anual' : 'Orçado YTD';
  const realLabel = isAnual ? 'Realizado Acum.' : 'Realizado YTD';

  const drillRecords = selectedPacote ? filteredRecords.filter(r => r.pacote === selectedPacote) : [];
  const areaBreakdown = selectedPacote ? groupBy(drillRecords, 'areaGrupo1', mesesComReal, periodoView).filter(d => d.orcado > 0 || d.realizado > 0) : [];
  const recursoBreakdown = selectedPacote ? groupBy(drillRecords, 'recurso', mesesComReal, periodoView).filter(d => d.orcado > 0 || d.realizado > 0) : [];

  const monthlyEvolution = selectedPacote ? Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const orcado = drillRecords.filter(r => r.base === 'ORÇ26' && r.mes === mes).reduce((s, r) => s + r.executado, 0);
    const realizado = drillRecords.filter(r => r.base === 'REAL26' && r.mes === mes).reduce((s, r) => s + r.executado, 0);
    return { mesNome: MESES_PT[i], orcado, realizado: mesesComReal.includes(mes) ? realizado : undefined };
  }) : [];

  const overviewColumns: ColumnDef[] = [
    { key: 'nome', label: 'Pacote', align: 'left' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação R$', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
  ];

  const areaColumns: ColumnDef[] = [
    { key: 'nome', label: 'Área', align: 'left' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
  ];

  const recursoColumns: ColumnDef[] = [
    { key: 'nome', label: 'Recurso', align: 'left' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
  ];

  const openAreaDetail = (areaNome: string) => {
    const recs = drillRecords.filter(r => r.areaGrupo1 === areaNome);
    setDetailModal({ open: true, records: recs, title: `${selectedPacote} → ${areaNome}` });
  };

  const openRecursoDetail = (recursoNome: string) => {
    const recs = drillRecords.filter(r => r.recurso === recursoNome);
    setDetailModal({ open: true, records: recs, title: `${selectedPacote} → ${recursoNome}` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Por Pacote</h1>
          <p className="text-sm text-muted-foreground">Análise por agrupamento de despesas</p>
        </div>
        {!selectedPacote && (
          <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
            <button onClick={() => setViewMode('cards')} className={`p-1.5 rounded ${viewMode === 'cards' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setViewMode('table')} className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}><Table2 className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => setSelectedPacote(null)} className="text-primary hover:underline">Pacotes</button>
        {selectedPacote && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground">{selectedPacote}</span>
          </>
        )}
      </div>

      {!selectedPacote && viewMode === 'cards' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pacoteOverview.map(p => (
            <button key={p.nome} onClick={() => setSelectedPacote(p.nome)} className="glass-card p-5 text-left hover:border-primary/50 transition-all">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-semibold text-xs">{p.nome}</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">{orcLabel}</span><span className="font-mono">{formatCurrency(p.orcado)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{realLabel}</span><span className="font-mono">{formatCurrency(p.realizado)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Variação</span>
                  <span className={`font-mono font-medium ${p.variacao > 0 ? 'text-destructive' : 'text-success'}`}>{formatPercent(p.variacaoPercent)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!selectedPacote && viewMode === 'table' && (
        <SortableTable
          columns={overviewColumns}
          data={pacoteOverview}
          onRowClick={(row) => setSelectedPacote(row.nome)}
          exportFilename="pacotes-overview.csv"
        />
      )}

      {selectedPacote && (
        <div className="space-y-6">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Contribuição por Área</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, areaBreakdown.length * 35)}>
              <BarChart data={areaBreakdown} layout="vertical" margin={{ left: 160 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,20%,16%)" />
                <XAxis type="number" tick={{ fill: 'hsl(215,15%,55%)', fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="nome" tick={{ fill: 'hsl(215,15%,55%)', fontSize: 10 }} width={155} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="orcado" name="Orçado" fill="hsl(175,70%,45%)" opacity={0.4} />
                <Bar dataKey="realizado" name="Realizado" fill="hsl(210,80%,60%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Evolução Mensal</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,20%,16%)" />
                <XAxis dataKey="mesNome" tick={{ fill: 'hsl(215,15%,55%)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(215,15%,55%)', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="orcado" name="Orçado" stroke="hsl(175,70%,45%)" strokeWidth={2} strokeDasharray="5 3" />
                <Line type="monotone" dataKey="realizado" name="Realizado" stroke="hsl(210,80%,60%)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <div className="px-1 py-2"><h3 className="text-sm font-semibold">Breakdown por Área</h3></div>
            <SortableTable columns={areaColumns} data={areaBreakdown} onRowClick={(row) => openAreaDetail(row.nome)} exportFilename={`areas-${selectedPacote}.csv`} />
          </div>

          <div>
            <div className="px-1 py-2"><h3 className="text-sm font-semibold">Detalhamento por Recurso</h3></div>
            <SortableTable columns={recursoColumns} data={recursoBreakdown} onRowClick={(row) => openRecursoDetail(row.nome)} exportFilename={`recursos-${selectedPacote}.csv`} />
          </div>
        </div>
      )}

      <ExpenseDetailModal
        open={detailModal.open}
        onOpenChange={(o) => setDetailModal(prev => ({ ...prev, open: o }))}
        records={detailModal.records}
        title={detailModal.title}
      />
    </div>
  );
}
