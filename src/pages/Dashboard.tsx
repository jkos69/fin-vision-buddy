import { TrendingDown, TrendingUp, DollarSign, Target, Calendar, Activity } from 'lucide-react';
import { useOPEX } from '@/contexts/OPEXContext';
import { getSummary, getMonthlyData, groupBy, getMesesComReal, formatCurrency, formatPercent, formatCompact } from '@/lib/opex-utils';
import { MESES_PT } from '@/types/opex';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Line, ComposedChart } from 'recharts';
import { FileUpload } from '@/components/FileUpload';

const DIRETORIA_COLORS = [
  'hsl(175, 70%, 45%)',
  'hsl(210, 80%, 60%)',
  'hsl(38, 92%, 55%)',
  'hsl(280, 60%, 55%)',
  'hsl(152, 60%, 42%)',
  'hsl(0, 72%, 55%)',
];

function SummaryCard({ title, value, subtitle, icon: Icon, variant }: {
  title: string; value: string; subtitle?: string; icon: any; variant?: 'default' | 'success' | 'danger';
}) {
  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className={`mt-2 text-2xl font-bold font-mono ${variant === 'success' ? 'text-success' : variant === 'danger' ? 'text-destructive' : 'text-foreground'}`}>
            {value}
          </p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${variant === 'success' ? 'bg-success/10 text-success' : variant === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="glass-card p-3 text-xs space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { filteredRecords, hasData } = useOPEX();

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-primary">OPEX</span> Control 2026
          </h1>
          <p className="text-muted-foreground">Importe sua planilha Excel para começar</p>
        </div>
        <div className="w-full max-w-lg">
          <FileUpload />
        </div>
      </div>
    );
  }

  const summary = getSummary(filteredRecords);
  const monthlyData = getMonthlyData(filteredRecords);
  const mesesComReal = getMesesComReal(filteredRecords);
  const diretoriaData = groupBy(filteredRecords, 'diretoria', mesesComReal);
  
  // Accumulated data
  let accOrcado = 0;
  let accReal = 0;
  const accData = monthlyData.map(m => {
    accOrcado += m.orcado;
    accReal += m.realizado;
    return { ...m, accOrcado, accReal: mesesComReal.includes(m.mes) ? accReal : undefined };
  });

  const varVariant = summary.variacao > 0 ? 'danger' : 'success';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral OPEX 2026</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          Dados reais: {mesesComReal.map(m => MESES_PT[m - 1]).join(', ')}/26
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard title="Orçado YTD" value={formatCompact(summary.orcadoYTD)} icon={Target} />
        <SummaryCard title="Realizado YTD" value={formatCompact(summary.realizadoYTD)} icon={DollarSign} />
        <SummaryCard
          title="Variação YTD"
          value={formatCompact(summary.variacao)}
          subtitle={formatPercent(summary.variacaoPercent)}
          icon={summary.variacao > 0 ? TrendingUp : TrendingDown}
          variant={varVariant}
        />
        <SummaryCard title="Orçado Anual" value={formatCompact(summary.orcadoAnual)} icon={Target} />
        <SummaryCard
          title="Projeção Anual"
          value={formatCompact(summary.projecaoAnual)}
          subtitle={`${((summary.projecaoAnual / summary.orcadoAnual) * 100).toFixed(1)}% do orçado`}
          icon={Activity}
          variant={summary.projecaoAnual > summary.orcadoAnual ? 'danger' : 'success'}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Monthly bar chart */}
        <div className="glass-card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4">Orçado vs Realizado — Mensal + Acumulado</h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={accData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,20%,16%)" />
              <XAxis dataKey="mesNome" tick={{ fill: 'hsl(215,15%,55%)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'hsl(215,15%,55%)', fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="orcado" name="Orçado" fill="hsl(175,70%,45%)" opacity={0.4} radius={[3, 3, 0, 0]} />
              <Bar dataKey="realizado" name="Realizado" fill="hsl(210,80%,60%)" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="accOrcado" name="Acum. Orçado" stroke="hsl(175,70%,45%)" strokeWidth={2} dot={false} strokeDasharray="5 3" />
              <Line type="monotone" dataKey="accReal" name="Acum. Realizado" stroke="hsl(210,80%,60%)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart by Diretoria */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Orçado Anual por Diretoria</h3>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={diretoriaData.filter(d => d.orcado > 0)}
                dataKey="orcado"
                nameKey="nome"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
              >
                {diretoriaData.filter(d => d.orcado > 0).map((_, i) => (
                  <Cell key={i} fill={DIRETORIA_COLORS[i % DIRETORIA_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend
                verticalAlign="bottom"
                iconSize={8}
                formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
