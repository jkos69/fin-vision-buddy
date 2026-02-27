import { useState } from 'react';
import { useOPEX } from '@/contexts/OPEXContext';
import { groupBy, getMesesComReal, getMonthlyData, formatCurrency, formatPercent } from '@/lib/opex-utils';
import { PACOTES, MESES_PT } from '@/types/opex';
import { Package, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';

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

export default function PacotesPage() {
  const { filteredRecords } = useOPEX();
  const [selectedPacote, setSelectedPacote] = useState<string | null>(null);
  const mesesComReal = getMesesComReal(filteredRecords);
  
  const pacoteOverview = groupBy(filteredRecords, 'pacote', mesesComReal).filter(p => p.orcado > 0 || p.realizado > 0);

  // Drill-down
  const drillRecords = selectedPacote ? filteredRecords.filter(r => r.pacote === selectedPacote) : [];
  const areaBreakdown = selectedPacote ? groupBy(drillRecords, 'areaGrupo1', mesesComReal).filter(d => d.orcado > 0 || d.realizado > 0) : [];
  const recursoBreakdown = selectedPacote ? groupBy(drillRecords, 'recurso', mesesComReal).filter(d => d.orcado > 0 || d.realizado > 0) : [];
  
  // Monthly evolution for selected pacote
  const monthlyEvolution = selectedPacote ? Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const orcado = drillRecords.filter(r => r.base === 'ORÇ26' && r.mes === mes).reduce((s, r) => s + r.executado, 0);
    const realizado = drillRecords.filter(r => r.base === 'REAL26' && r.mes === mes).reduce((s, r) => s + r.executado, 0);
    return { mesNome: MESES_PT[i], orcado, realizado: mesesComReal.includes(mes) ? realizado : undefined };
  }) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Por Pacote</h1>
        <p className="text-sm text-muted-foreground">Análise por agrupamento de despesas</p>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => setSelectedPacote(null)} className="text-primary hover:underline">Pacotes</button>
        {selectedPacote && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground">{selectedPacote}</span>
          </>
        )}
      </div>

      {!selectedPacote && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pacoteOverview.map(p => (
            <button
              key={p.nome}
              onClick={() => setSelectedPacote(p.nome)}
              className="glass-card p-5 text-left hover:border-primary/50 transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-semibold text-xs">{p.nome}</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Orçado YTD</span><span className="font-mono">{formatCurrency(p.orcado)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Realizado YTD</span><span className="font-mono">{formatCurrency(p.realizado)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Variação</span>
                  <span className={`font-mono font-medium ${p.variacao > 0 ? 'text-destructive' : 'text-success'}`}>{formatPercent(p.variacaoPercent)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedPacote && (
        <div className="space-y-6">
          {/* Area breakdown chart */}
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

          {/* Monthly evolution */}
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

          {/* Resource table */}
          <div className="data-grid">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">Detalhamento por Recurso</h3>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Recurso</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Orçado</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Realizado</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {recursoBreakdown.map(r => (
                    <tr key={r.nome} className="border-b border-border/30 hover:bg-accent/30">
                      <td className="px-4 py-2">{r.nome}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatCurrency(r.orcado)}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatCurrency(r.realizado)}</td>
                      <td className={`px-4 py-2 text-right font-mono ${r.variacao > 0 ? 'text-destructive' : 'text-success'}`}>
                        {formatCurrency(r.variacao)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
