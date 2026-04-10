import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { useOPEX } from '@/contexts/OPEXContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getChartColors } from '@/lib/chart-colors';
import { getMesesComReal, formatCurrency, formatCompact } from '@/lib/opex-utils';
import { computeTotals } from '@/lib/totals-helper';
import { MESES_PT, DIRETORIAS, type OPEXRecord } from '@/types/opex';
import { SortableTable, type ColumnDef } from '@/components/SortableTable';
import { ExpenseDetailModal } from '@/components/ExpenseDetailModal';
import { AlertCircle } from 'lucide-react';

const SGA_COLORS = [
  'hsl(210, 80%, 35%)',
  'hsl(210, 15%, 60%)',
  'hsl(190, 70%, 50%)',
  'hsl(280, 50%, 55%)',
  'hsl(152, 60%, 42%)',
  'hsl(38, 92%, 55%)',
  'hsl(0, 72%, 55%)',
  'hsl(320, 50%, 50%)',
  'hsl(175, 70%, 45%)',
  'hsl(45, 80%, 50%)',
  'hsl(260, 60%, 50%)',
  'hsl(15, 80%, 55%)',
];

type SGAFilter = 'comerciais' | 'gerais' | 'todas' | 'custos';

function getSubcategoria(agrupamento: string): string {
  const parts = agrupamento.split('-');
  return parts.length > 1 ? parts.slice(1).join('-').trim() : agrupamento;
}

function getCategoriaPrincipal(agrupamento: string): string {
  return agrupamento.split('-')[0].trim();
}

function matchesSGAFilter(agrupamento: string, filter: SGAFilter): boolean {
  const cat = getCategoriaPrincipal(agrupamento);
  switch (filter) {
    case 'comerciais': return cat.startsWith('Despesas com Comercial') || cat.startsWith('Despesas Comerciais');
    case 'gerais': return cat.startsWith('Despesas Gerais e Adm');
    case 'todas': return cat.startsWith('Despesas com Comercial') || cat.startsWith('Despesas Comerciais') || cat.startsWith('Despesas Gerais e Adm');
    case 'custos': return cat.startsWith('Custo Direto') || cat.startsWith('Custo Indireto');
  }
}

function SGATooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
  return (
    <div className="glass-card p-3 text-xs space-y-1 max-w-xs border border-border">
      <p className="font-semibold">{label} — Total: R$ {total.toFixed(0)}K</p>
      {payload.filter((p: any) => p.value > 0).sort((a: any, b: any) => b.value - a.value).map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: R$ {p.value.toFixed(0)}K ({total > 0 ? ((p.value / total) * 100).toFixed(1) : 0}%)
        </p>
      ))}
    </div>
  );
}

export default function SGAPage() {
  const { filteredRecords, periodoView, mesSelecionado } = useOPEX();
  const { session, isCEO, isDiretoria, isArea } = useAuth();
  const { theme } = useTheme();
  const colors = getChartColors(theme);

  const [sgaFilter, setSgaFilter] = useState<SGAFilter>('todas');
  const [dirFilter, setDirFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [detailModal, setDetailModal] = useState<{ open: boolean; records: OPEXRecord[]; title: string }>({ open: false, records: [], title: '' });

  // Lock filters based on access level
  const effectiveDirFilter = isDiretoria ? session?.diretoria || 'all' : isArea ? session?.diretoria || 'all' : dirFilter;
  const effectiveAreaFilter = isArea ? session?.area || 'all' : areaFilter;

  const areas = useMemo(() => {
    let recs = filteredRecords;
    if (effectiveDirFilter !== 'all') recs = recs.filter(r => r.diretoria === effectiveDirFilter);
    return [...new Set(recs.map(r => r.areaGrupo1))].sort();
  }, [filteredRecords, effectiveDirFilter]);

  const sgaRecords = useMemo(() => {
    let recs = filteredRecords.filter(r => r.agrupamento && matchesSGAFilter(r.agrupamento, sgaFilter));
    if (effectiveDirFilter !== 'all') recs = recs.filter(r => r.diretoria === effectiveDirFilter);
    if (effectiveAreaFilter !== 'all') recs = recs.filter(r => r.areaGrupo1 === effectiveAreaFilter);
    return recs;
  }, [filteredRecords, sgaFilter, effectiveDirFilter, effectiveAreaFilter]);

  const mesesComReal = useMemo(() => getMesesComReal(filteredRecords), [filteredRecords]);
  const lastMesReal = periodoView === 'mensal' && mesSelecionado ? mesSelecionado : (mesesComReal[mesesComReal.length - 1] || 1);

  const subcategorias = useMemo(() =>
    [...new Set(sgaRecords.map(r => getSubcategoria(r.agrupamento)))].sort(),
    [sgaRecords]
  );

  const calcValue = (recs: OPEXRecord[], base: string, meses: number[], sub: string) =>
    recs.filter(r => r.base === base && meses.includes(r.mes) && getSubcategoria(r.agrupamento) === sub)
      .reduce((s, r) => s + r.executado, 0) / 1000;

  const chartData = useMemo(() => {
    if (subcategorias.length === 0) return [];
    return [
      { name: `${MESES_PT[lastMesReal - 1]} Orç`, _type: 'mesOrc', ...Object.fromEntries(subcategorias.map(sub => [sub, calcValue(sgaRecords, 'ORÇ26', [lastMesReal], sub)])) },
      { name: `${MESES_PT[lastMesReal - 1]} Real`, _type: 'mesReal', ...Object.fromEntries(subcategorias.map(sub => [sub, calcValue(sgaRecords, 'REAL26', [lastMesReal], sub)])) },
      { name: 'Acum Orç', _type: 'acumOrc', ...Object.fromEntries(subcategorias.map(sub => [sub, calcValue(sgaRecords, 'ORÇ26', mesesComReal, sub)])) },
      { name: 'Acum Real', _type: 'acumReal', ...Object.fromEntries(subcategorias.map(sub => [sub, calcValue(sgaRecords, 'REAL26', mesesComReal, sub)])) },
    ];
  }, [sgaRecords, subcategorias, lastMesReal, mesesComReal]);

  // Variation badges
  const barTotal = (d: any) => subcategorias.reduce((s, sub) => s + (d[sub] || 0), 0);
  const mesOrcTotal = chartData[0] ? barTotal(chartData[0]) : 0;
  const mesRealTotal = chartData[1] ? barTotal(chartData[1]) : 0;
  const acumOrcTotal = chartData[2] ? barTotal(chartData[2]) : 0;
  const acumRealTotal = chartData[3] ? barTotal(chartData[3]) : 0;
  const mesVar = mesRealTotal - mesOrcTotal;
  const mesVarPct = mesOrcTotal > 0 ? (mesVar / mesOrcTotal) * 100 : 0;
  const acumVar = acumRealTotal - acumOrcTotal;
  const acumVarPct = acumOrcTotal > 0 ? (acumVar / acumOrcTotal) * 100 : 0;

  // Table data
  const tableData = useMemo(() => subcategorias.map(sub => ({
    nome: sub,
    mesOrc: calcValue(sgaRecords, 'ORÇ26', [lastMesReal], sub) * 1000,
    mesReal: calcValue(sgaRecords, 'REAL26', [lastMesReal], sub) * 1000,
    get mesVarR() { return this.mesReal - this.mesOrc; },
    get mesVarPct() { return this.mesOrc !== 0 ? ((this.mesReal - this.mesOrc) / this.mesOrc) * 100 : 0; },
    acumOrc: calcValue(sgaRecords, 'ORÇ26', mesesComReal, sub) * 1000,
    acumReal: calcValue(sgaRecords, 'REAL26', mesesComReal, sub) * 1000,
    get acumVarR() { return this.acumReal - this.acumOrc; },
    get acumVarPct() { return this.acumOrc !== 0 ? ((this.acumReal - this.acumOrc) / this.acumOrc) * 100 : 0; },
  })).filter(d => d.mesOrc !== 0 || d.mesReal !== 0 || d.acumOrc !== 0 || d.acumReal !== 0), [sgaRecords, subcategorias, lastMesReal, mesesComReal]);

  const tableColumns: ColumnDef<any>[] = [
    { key: 'nome', label: 'Subcategoria', align: 'left' },
    { key: 'mesOrc', label: `${MESES_PT[lastMesReal - 1]} Orç`, align: 'right', format: 'currency' },
    { key: 'mesReal', label: `${MESES_PT[lastMesReal - 1]} Real`, align: 'right', format: 'currency' },
    { key: 'mesVarR', label: 'Var Mês R$', align: 'right', format: 'currency' },
    { key: 'mesVarPct', label: 'Var Mês %', align: 'right', format: 'percent' },
    { key: 'acumOrc', label: 'Acum Orç', align: 'right', format: 'currency' },
    { key: 'acumReal', label: 'Acum Real', align: 'right', format: 'currency' },
    { key: 'acumVarR', label: 'Var Acum R$', align: 'right', format: 'currency' },
    { key: 'acumVarPct', label: 'Var Acum %', align: 'right', format: 'percent' },
  ];

  const filterOptions: { value: SGAFilter; label: string }[] = [
    { value: 'todas', label: 'Todas SG&A' },
    { value: 'comerciais', label: 'Desp. Comerciais' },
    { value: 'gerais', label: 'Desp. Gerais e Adm.' },
    { value: 'custos', label: 'Custos' },
  ];

  const hasData = sgaRecords.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">SG&A — Selling, General & Administrative</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Análise de despesas por agrupamento</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* SGA filter */}
        <div className="flex gap-1">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSgaFilter(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${sgaFilter === opt.value ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Diretoria filter */}
        {isCEO && (
          <select
            value={effectiveDirFilter}
            onChange={e => { setDirFilter(e.target.value); setAreaFilter('all'); }}
            className="text-xs px-3 py-1.5 rounded-md bg-background border border-border text-foreground"
          >
            <option value="all">Todas Diretorias</option>
            {DIRETORIAS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}

        {/* Area filter */}
        {(isCEO || isDiretoria) && (
          <select
            value={effectiveAreaFilter}
            onChange={e => setAreaFilter(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-md bg-background border border-border text-foreground"
          >
            <option value="all">Todas Áreas</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>

      {!hasData && (
        <div className="glass-card p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum dado de agrupamento encontrado. É necessário refazer o upload da planilha para popular o campo "Agrupamento".
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Variation badges */}
          <div className="flex flex-wrap gap-4">
            <div className="glass-card p-3 flex-1 min-w-[180px]">
              <p className="text-xs text-muted-foreground">{MESES_PT[lastMesReal - 1]} — Orç vs Real</p>
              <p className="text-lg font-bold font-mono">{formatCompact(mesRealTotal * 1000)}</p>
              <span className={`text-xs font-medium ${mesVar > 0 ? 'text-destructive' : 'text-success'}`}>
                {mesVar >= 0 ? '+' : ''}{mesVar.toFixed(0)}K ({mesVarPct >= 0 ? '+' : ''}{mesVarPct.toFixed(1)}%)
              </span>
            </div>
            <div className="glass-card p-3 flex-1 min-w-[180px]">
              <p className="text-xs text-muted-foreground">Acumulado — Orç vs Real</p>
              <p className="text-lg font-bold font-mono">{formatCompact(acumRealTotal * 1000)}</p>
              <span className={`text-xs font-medium ${acumVar > 0 ? 'text-destructive' : 'text-success'}`}>
                {acumVar >= 0 ? '+' : ''}{acumVar.toFixed(0)}K ({acumVarPct >= 0 ? '+' : ''}{acumVarPct.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Stacked bar chart */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Composição por Subcategoria</h3>
            <ResponsiveContainer width="100%" height={450}>
              <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="name" tick={{ fill: colors.axis, fontSize: 11 }} />
                <YAxis tick={{ fill: colors.axis, fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}`} label={{ value: 'R$ mil', angle: -90, position: 'insideLeft', style: { fill: colors.axis, fontSize: 10 } }} />
                <Tooltip content={<SGATooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {subcategorias.map((sub, i) => (
                  <Bar
                    key={sub}
                    dataKey={sub}
                    stackId="a"
                    fill={SGA_COLORS[i % SGA_COLORS.length]}
                    name={sub}
                    cursor="pointer"
                    onClick={() => {
                      const recs = sgaRecords.filter(r => getSubcategoria(r.agrupamento) === sub);
                      setDetailModal({ open: true, records: recs, title: `SG&A: ${sub}` });
                    }}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail table */}
          <div>
            <div className="px-1 py-2">
              <h3 className="text-sm font-semibold">Detalhamento por Subcategoria ({tableData.length})</h3>
            </div>
            <SortableTable
              columns={tableColumns}
              data={tableData}
              onRowClick={(row) => {
                const recs = sgaRecords.filter(r => getSubcategoria(r.agrupamento) === row.nome);
                setDetailModal({ open: true, records: recs, title: `SG&A: ${row.nome}` });
              }}
              exportFilename="sga-detalhamento.csv"
              totalsRow={computeTotals(tableData, ['mesOrc', 'mesReal', 'mesVarR', 'mesVarPct', 'acumOrc', 'acumReal', 'acumVarR', 'acumVarPct'], { orcadoKey: 'acumOrc', realizadoKey: 'acumReal', varPercentKey: 'acumVarPct' })}
            />
          </div>
        </>
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
