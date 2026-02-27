import { useState } from 'react';
import { useOPEX } from '@/contexts/OPEXContext';
import { groupBy, getMesesComReal, formatCurrency, formatPercent, getSummary } from '@/lib/opex-utils';
import { MESES_PT } from '@/types/opex';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, ReferenceLine } from 'recharts';

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
  const { filteredRecords } = useOPEX();
  const mesesComReal = getMesesComReal(filteredRecords);
  const summary = getSummary(filteredRecords);

  // Semáforo por Área
  const areaData = groupBy(filteredRecords, 'areaGrupo1', mesesComReal).filter(d => d.orcado > 0 || d.realizado > 0);
  
  // Waterfall by Pacote
  const pacoteData = groupBy(filteredRecords, 'pacote', mesesComReal).filter(d => d.variacao !== 0);
  const waterfallData = pacoteData.sort((a, b) => b.variacao - a.variacao).map(p => ({
    nome: p.nome.replace('PACOTE ', ''),
    variacao: p.variacao,
    fill: p.variacao > 0 ? 'hsl(0,72%,55%)' : 'hsl(152,60%,42%)',
  }));

  // Accumulated evolution
  let accOrcado = 0;
  let accReal = 0;
  const accData = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const orc = filteredRecords.filter(r => r.base === 'ORÇ26' && r.mes === mes).reduce((s, r) => s + r.executado, 0);
    const real = filteredRecords.filter(r => r.base === 'REAL26' && r.mes === mes).reduce((s, r) => s + r.executado, 0);
    accOrcado += orc;
    accReal += real;
    return {
      mesNome: MESES_PT[i],
      orcadoAcc: accOrcado,
      realizadoAcc: mesesComReal.includes(mes) ? accReal : undefined,
    };
  });

  // Alerts
  const alertAreas = areaData.filter(a => Math.abs(a.variacaoPercent) > 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orçado vs Realizado</h1>
        <p className="text-sm text-muted-foreground">Análise comparativa e variações</p>
      </div>

      {/* Alerts */}
      {alertAreas.length > 0 && (
        <div className="glass-card p-4 border-warning/30">
          <h3 className="text-sm font-semibold text-warning mb-2">⚠️ Alertas — Variação &gt; 20%</h3>
          <div className="flex flex-wrap gap-2">
            {alertAreas.map(a => (
              <span key={a.nome} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${a.variacao > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                {a.nome}: {formatPercent(a.variacaoPercent)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Waterfall by Pacote */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Variação por Pacote (Waterfall)</h3>
          <ResponsiveContainer width="100%" height={Math.max(250, waterfallData.length * 32)}>
            <BarChart data={waterfallData} layout="vertical" margin={{ left: 140 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,20%,16%)" />
              <XAxis type="number" tick={{ fill: 'hsl(215,15%,55%)', fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="nome" tick={{ fill: 'hsl(215,15%,55%)', fontSize: 10 }} width={135} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine x={0} stroke="hsl(220,20%,25%)" />
              <Bar dataKey="variacao" name="Variação">
                {waterfallData.map((d, i) => (
                  <rect key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
            </LineChart>
          </ResponsiveContainer>
          {/* Projeção */}
          <div className="mt-3 p-3 rounded-md bg-muted/50 text-xs">
            <span className="text-muted-foreground">Projeção anual: </span>
            <span className={`font-mono font-semibold ${summary.projecaoAnual > summary.orcadoAnual ? 'text-destructive' : 'text-success'}`}>
              {formatCurrency(summary.projecaoAnual)}
            </span>
            <span className="text-muted-foreground"> ({((summary.projecaoAnual / summary.orcadoAnual) * 100).toFixed(1)}% do orçado)</span>
          </div>
        </div>
      </div>

      {/* Semáforo por Área */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-4">Semáforo por Área</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {areaData.map(a => (
            <div key={a.nome} className="flex items-center gap-2 rounded-md border border-border/50 px-3 py-2 text-xs">
              <SemaforoIcon status={a.semaforo} />
              <span className="flex-1 truncate font-medium">{a.nome}</span>
              <span className={`font-mono ${a.variacao > 0 ? 'text-destructive' : 'text-success'}`}>
                {formatPercent(a.variacaoPercent)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
