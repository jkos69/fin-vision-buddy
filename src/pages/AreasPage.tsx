import { useState } from 'react';
import { useOPEX } from '@/contexts/OPEXContext';
import { groupBy, getMesesComReal, formatCurrency, formatPercent } from '@/lib/opex-utils';
import { DIRETORIAS } from '@/types/opex';
import { Building2, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { SortableTable, type ColumnDef } from '@/components/SortableTable';
import { ExpenseDetailModal } from '@/components/ExpenseDetailModal';

function SemaforoIcon({ status }: { status: 'green' | 'yellow' | 'red' }) {
  const colors = { green: 'bg-success', yellow: 'bg-warning', red: 'bg-destructive' };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status]}`} />;
}

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

export default function AreasPage() {
  const { filteredRecords, periodoView } = useOPEX();
  const [selectedDiretoria, setSelectedDiretoria] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<{ open: boolean; records: any[]; title: string }>({ open: false, records: [], title: '' });

  const mesesComReal = getMesesComReal(filteredRecords);
  const diretoriaData = groupBy(filteredRecords, 'diretoria', mesesComReal, periodoView);

  const areaRecords = selectedDiretoria ? filteredRecords.filter(r => r.diretoria === selectedDiretoria) : [];
  const areaData = selectedDiretoria ? groupBy(areaRecords, 'areaGrupo1', mesesComReal, periodoView) : [];

  const drillRecords = selectedArea ? areaRecords.filter(r => r.areaGrupo1 === selectedArea) : [];
  const pacoteData = selectedArea ? groupBy(drillRecords, 'pacote', mesesComReal, periodoView).filter(d => d.orcado > 0 || d.realizado > 0) : [];
  const recursoData = selectedArea ? groupBy(drillRecords, 'recurso', mesesComReal, periodoView).filter(d => d.orcado > 0 || d.realizado > 0) : [];
  const top5 = recursoData.slice(0, 5);
  const totalArea = recursoData.reduce((s, r) => s + (r.realizado || r.orcado), 0);

  const isAnual = periodoView === 'anual';
  const orcLabel = isAnual ? 'Orçado Anual' : 'Orçado YTD';
  const realLabel = isAnual ? 'Realizado Acum.' : 'Realizado YTD';

  const areaColumns: ColumnDef[] = [
    { key: 'nome', label: 'Área', align: 'left' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação R$', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
    { key: 'semaforo', label: 'Status', align: 'center', sortable: false, render: (v) => <SemaforoIcon status={v} /> },
    { key: '_exec', label: 'Execução', align: 'right', sortable: false, render: (_, row) => {
      const pct = row.orcado ? (row.realizado / row.orcado) * 100 : 0;
      return (
        <div className="flex items-center gap-2 justify-end">
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${row.semaforo === 'green' ? 'bg-success' : row.semaforo === 'yellow' ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <span className="text-xs text-muted-foreground font-mono w-10 text-right">{row.orcado ? `${pct.toFixed(0)}%` : '—'}</span>
        </div>
      );
    }},
  ];

  const recursoColumns: ColumnDef[] = [
    { key: 'nome', label: 'Recurso', align: 'left' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
  ];

  const openDetail = (recursoNome: string) => {
    const recs = drillRecords.filter(r => r.recurso === recursoNome);
    setDetailModal({ open: true, records: recs, title: `${selectedArea} → ${recursoNome}` });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Por Diretoria / Área</h1>
        <p className="text-sm text-muted-foreground">Navegue pela hierarquia organizacional</p>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => { setSelectedDiretoria(null); setSelectedArea(null); }} className="text-primary hover:underline">Diretorias</button>
        {selectedDiretoria && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button onClick={() => setSelectedArea(null)} className="text-primary hover:underline">Diretoria: {selectedDiretoria}</button>
          </>
        )}
        {selectedArea && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground">Área: {selectedArea}</span>
          </>
        )}
      </div>

      {/* Level 1: Diretorias */}
      {!selectedDiretoria && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {diretoriaData.map(d => (
            <button key={d.nome} onClick={() => setSelectedDiretoria(d.nome)} className="glass-card p-5 text-left hover:border-primary/50 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{d.nome}</span>
                </div>
                <SemaforoIcon status={d.semaforo} />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">{orcLabel}</span><span className="font-mono">{formatCurrency(d.orcado)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{realLabel}</span><span className="font-mono">{formatCurrency(d.realizado)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Variação</span>
                  <span className={`font-mono font-medium ${d.variacao > 0 ? 'text-destructive' : 'text-success'}`}>{formatPercent(d.variacaoPercent)}</span>
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${d.semaforo === 'green' ? 'bg-success' : d.semaforo === 'yellow' ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${Math.min((d.realizado / (d.orcado || 1)) * 100, 100)}%` }} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Level 2: Áreas table */}
      {selectedDiretoria && !selectedArea && (
        <SortableTable
          columns={areaColumns}
          data={areaData}
          onRowClick={(row) => setSelectedArea(row.nome)}
          exportFilename={`areas-${selectedDiretoria}.csv`}
        />
      )}

      {/* Level 3: Drill-down */}
      {selectedArea && (
        <div className="space-y-6">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Composição por Pacote — {selectedArea}</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, pacoteData.length * 40)}>
              <BarChart data={pacoteData} layout="vertical" margin={{ left: 180 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,20%,16%)" />
                <XAxis type="number" tick={{ fill: 'hsl(215,15%,55%)', fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="nome" tick={{ fill: 'hsl(215,15%,55%)', fontSize: 10 }} width={175} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="orcado" name="Orçado" fill="hsl(175,70%,45%)" opacity={0.4} />
                <Bar dataKey="realizado" name="Realizado" fill="hsl(210,80%,60%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top 5 as sortable table */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Top 5 Maiores Custos (por Recurso)</h3>
            <SortableTable
              columns={[
                { key: '_rank', label: '#', align: 'center', sortable: false, render: (_, __, i) => <span className="text-primary font-bold">#{i+1}</span> },
                { key: 'nome', label: 'Recurso', align: 'left' },
                { key: '_valor', label: 'Valor', align: 'right', format: 'currency', render: (_, row) => formatCurrency(row.realizado || row.orcado) },
                { key: '_pct', label: '% Total', align: 'right', render: (_, row) => `${totalArea > 0 ? ((row.realizado || row.orcado) / totalArea * 100).toFixed(1) : 0}%` },
                { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
                { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
                { key: 'variacao', label: 'Variação', align: 'right', format: 'currency' },
              ]}
              data={top5}
              highlightTop={5}
              onRowClick={(row) => openDetail(row.nome)}
            />
          </div>

          {/* Full resource table */}
          <div>
            <div className="px-1 py-2"><h3 className="text-sm font-semibold">Detalhamento por Recurso</h3></div>
            <SortableTable
              columns={recursoColumns}
              data={recursoData}
              onRowClick={(row) => openDetail(row.nome)}
              exportFilename={`recursos-${selectedArea}.csv`}
            />
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
