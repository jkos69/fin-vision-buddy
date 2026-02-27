import { useState } from 'react';
import { useOPEX } from '@/contexts/OPEXContext';
import { groupBy, getMesesComReal, formatCurrency, formatPercent, getSemaforo } from '@/lib/opex-utils';
import { DIRETORIAS } from '@/types/opex';
import { Building2, ChevronRight, ArrowUpDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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

function SemaforoIcon({ status }: { status: 'green' | 'yellow' | 'red' }) {
  const colors = { green: 'bg-success', yellow: 'bg-warning', red: 'bg-destructive' };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status]}`} />;
}

export default function AreasPage() {
  const { filteredRecords } = useOPEX();
  const [selectedDiretoria, setSelectedDiretoria] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'nome' | 'orcado' | 'variacao'>('orcado');

  const mesesComReal = getMesesComReal(filteredRecords);
  
  // Diretoria overview
  const diretoriaData = groupBy(filteredRecords, 'diretoria', mesesComReal);

  // Áreas for selected Diretoria
  const areaRecords = selectedDiretoria ? filteredRecords.filter(r => r.diretoria === selectedDiretoria) : [];
  const areaData = selectedDiretoria ? groupBy(areaRecords, 'areaGrupo1', mesesComReal) : [];
  const sortedAreas = [...areaData].sort((a, b) => {
    if (sortKey === 'nome') return a.nome.localeCompare(b.nome);
    if (sortKey === 'variacao') return Math.abs(b.variacaoPercent) - Math.abs(a.variacaoPercent);
    return b.orcado - a.orcado;
  });

  // Drill-down: Pacotes + Top 5 for selected Area
  const drillRecords = selectedArea ? areaRecords.filter(r => r.areaGrupo1 === selectedArea) : [];
  const pacoteData = selectedArea ? groupBy(drillRecords, 'pacote', mesesComReal).filter(d => d.orcado > 0 || d.realizado > 0) : [];
  const recursoData = selectedArea ? groupBy(drillRecords, 'recurso', mesesComReal).filter(d => d.orcado > 0 || d.realizado > 0) : [];
  const top5 = recursoData.slice(0, 5);
  const totalArea = recursoData.reduce((s, r) => s + (r.realizado || r.orcado), 0);

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
            <button onClick={() => setSelectedArea(null)} className="text-primary hover:underline">{selectedDiretoria}</button>
          </>
        )}
        {selectedArea && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground">{selectedArea}</span>
          </>
        )}
      </div>

      {/* Level 1: Diretorias */}
      {!selectedDiretoria && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {diretoriaData.map(d => (
            <button
              key={d.nome}
              onClick={() => setSelectedDiretoria(d.nome)}
              className="glass-card p-5 text-left hover:border-primary/50 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{d.nome}</span>
                </div>
                <SemaforoIcon status={d.semaforo} />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Orçado YTD</span><span className="font-mono">{formatCurrency(d.orcado)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Realizado YTD</span><span className="font-mono">{formatCurrency(d.realizado)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Variação</span>
                  <span className={`font-mono font-medium ${d.variacao > 0 ? 'text-destructive' : 'text-success'}`}>{formatPercent(d.variacaoPercent)}</span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${d.semaforo === 'green' ? 'bg-success' : d.semaforo === 'yellow' ? 'bg-warning' : 'bg-destructive'}`}
                  style={{ width: `${Math.min((d.realizado / (d.orcado || 1)) * 100, 100)}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Level 2: Áreas table */}
      {selectedDiretoria && !selectedArea && (
        <div className="data-grid">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer" onClick={() => setSortKey('nome')}>
                    <span className="flex items-center gap-1">Área <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground cursor-pointer" onClick={() => setSortKey('orcado')}>Orçado YTD</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Realizado YTD</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground cursor-pointer" onClick={() => setSortKey('variacao')}>Variação</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Var %</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Execução</th>
                </tr>
              </thead>
              <tbody>
                {sortedAreas.map(a => (
                  <tr
                    key={a.nome}
                    className="border-b border-border/50 hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedArea(a.nome)}
                  >
                    <td className="px-4 py-3 font-medium">{a.nome}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{formatCurrency(a.orcado)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{formatCurrency(a.realizado)}</td>
                    <td className={`px-4 py-3 text-right font-mono text-xs font-medium ${a.variacao > 0 ? 'text-destructive' : 'text-success'}`}>
                      {formatCurrency(a.variacao)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono text-xs font-medium ${a.variacao > 0 ? 'text-destructive' : 'text-success'}`}>
                      {formatPercent(a.variacaoPercent)}
                    </td>
                    <td className="px-4 py-3 text-center"><SemaforoIcon status={a.semaforo} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${a.semaforo === 'green' ? 'bg-success' : a.semaforo === 'yellow' ? 'bg-warning' : 'bg-destructive'}`}
                            style={{ width: `${Math.min((a.realizado / (a.orcado || 1)) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono w-10 text-right">
                          {a.orcado ? `${((a.realizado / a.orcado) * 100).toFixed(0)}%` : '—'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Level 3: Drill-down */}
      {selectedArea && (
        <div className="space-y-6">
          {/* Pacotes chart */}
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

          {/* Top 5 */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Top 5 Maiores Custos (por Recurso)</h3>
            <div className="space-y-3">
              {top5.map((r, i) => {
                const value = r.realizado || r.orcado;
                const pct = totalArea > 0 ? (value / totalArea) * 100 : 0;
                return (
                  <div key={r.nome} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-primary w-5 text-right">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium truncate">{r.nome}</span>
                        <span className="text-xs font-mono ml-2">{formatCurrency(value)} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    {r.realizado > 0 && (
                      <span className={`text-xs font-mono ${r.variacao > 0 ? 'text-destructive' : 'text-success'}`}>
                        {formatPercent(r.variacaoPercent)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full resource table */}
          <div className="data-grid">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">Detalhamento por Recurso</h3>
            </div>
            <div className="overflow-x-auto max-h-96">
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
                  {recursoData.map(r => (
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
