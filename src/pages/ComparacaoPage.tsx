import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOPEX } from '@/contexts/OPEXContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { groupBy, getMesesComReal, formatCurrency, formatPercent, getSummary } from '@/lib/opex-utils';
import { computeTotals } from '@/lib/totals-helper';
import { MESES_PT } from '@/types/opex';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, ReferenceLine, Cell } from 'recharts';
import { SortableTable, type ColumnDef } from '@/components/SortableTable';
import { ExpenseDetailModal } from '@/components/ExpenseDetailModal';
import { ChartTooltip } from '@/components/ChartTooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { getChartColors } from '@/lib/chart-colors';

function SemaforoIcon({ status }: { status: 'green' | 'yellow' | 'red' }) {
  const map = { green: '🟢', yellow: '🟡', red: '🔴' };
  return <span>{map[status]}</span>;
}

export default function ComparacaoPage() {
  const { filteredRecords, periodoView, mesSelecionado, projecaoTipo } = useOPEX();
  const { isCEO, isDiretoria } = useAuth();
  const { theme } = useTheme();
  const colors = getChartColors(theme);
  const isMobile = useIsMobile();
  const [detailModal, setDetailModal] = useState<{ open: boolean; records: any[]; title: string }>({ open: false, records: [], title: '' });
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const highlightParam = searchParams.get('highlight');
    const typeParam = searchParams.get('type');
    if (highlightParam && typeParam && filteredRecords.length > 0) {
      if (typeParam === 'Fornecedor') {
        const recs = filteredRecords.filter(r => r.nomeFornecedor === highlightParam);
        if (recs.length > 0) setDetailModal({ open: true, records: recs, title: `Fornecedor: ${highlightParam}` });
      } else if (typeParam === 'Histórico') {
        const recs = filteredRecords.filter(r => r.historico === highlightParam);
        if (recs.length > 0) setDetailModal({ open: true, records: recs, title: `Histórico: ${highlightParam}` });
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, filteredRecords]);
  const mesesComReal = getMesesComReal(filteredRecords);
  const summary = getSummary(filteredRecords, periodoView, mesSelecionado, projecaoTipo);

  const isMensal = periodoView === 'mensal' && mesSelecionado;
  const orcLabel = isMensal ? `Orçado ${MESES_PT[mesSelecionado! - 1]}` : 'Orçado YTD';
  const realLabel = isMensal ? `Realizado ${MESES_PT[mesSelecionado! - 1]}` : 'Realizado YTD';
  const periodoLabel = isMensal ? `Mês: ${MESES_PT[mesSelecionado! - 1]}` : 'YTD';

  const semaforoField = isCEO || isDiretoria ? 'areaGrupo1' : 'recurso';
  const semaforoLabel = isCEO || isDiretoria ? 'Área' : 'Recurso';
  const areaData = groupBy(filteredRecords, semaforoField as keyof typeof filteredRecords[0], mesesComReal, periodoView, mesSelecionado).filter(d => d.orcado > 0 || d.realizado > 0);
  const pacoteData = groupBy(filteredRecords, 'pacote', mesesComReal, periodoView, mesSelecionado).filter(d => d.variacao !== 0);
  const waterfallData = pacoteData.sort((a, b) => b.variacao - a.variacao).map(p => ({
    nome: p.nome.replace('PACOTE ', ''),
    variacao: p.variacao,
  }));

  // Month comparison
  type CompSelection = { mes: number; base: string };

  const defaultA: CompSelection = mesesComReal.length >= 1
    ? { mes: mesesComReal[0], base: 'REAL26' }
    : { mes: 1, base: 'ORÇ26' };
  const defaultB: CompSelection = mesesComReal.length >= 2
    ? { mes: mesesComReal[mesesComReal.length - 1], base: 'REAL26' }
    : mesesComReal.length === 1
      ? { mes: mesesComReal[0], base: 'ORÇ26' }
      : { mes: 1, base: 'ORÇ26' };

  const [selA, setSelA] = useState<CompSelection>(defaultA);
  const [selB, setSelB] = useState<CompSelection>(defaultB);

  const isSameSelection = selA.mes === selB.mes && selA.base === selB.base;

  const compOptions: { mes: number; base: string; label: string }[] = MESES_PT.flatMap((nome, i) => {
    const mes = i + 1;
    const opts: { mes: number; base: string; label: string }[] = [{ mes, base: 'ORÇ26', label: `${nome} Orçado` }];
    if (mesesComReal.includes(mes)) {
      opts.push({ mes, base: 'REAL26', label: `${nome} Realizado` });
    }
    return opts;
  });

  const encodeOpt = (s: CompSelection) => `${s.mes}-${s.base}`;
  const decodeOpt = (v: string): CompSelection => {
    const [m, ...rest] = v.split('-');
    return { mes: Number(m), base: rest.join('-') as 'ORÇ26' | 'REAL26' };
  };

  const compField = isCEO || isDiretoria ? 'areaGrupo1' : 'recurso';

  const recsA = filteredRecords.filter(r => r.mes === selA.mes && r.base === selA.base);
  const recsB = filteredRecords.filter(r => r.mes === selB.mes && r.base === selB.base);

  const groupExec = (recs: typeof filteredRecords, field: string) => {
    const map = new Map<string, number>();
    recs.forEach(r => {
      const key = String((r as any)[field]);
      map.set(key, (map.get(key) || 0) + r.executado);
    });
    return map;
  };

  const groupA = groupExec(recsA, compField);
  const groupB = groupExec(recsB, compField);

  const compMerged = [...new Set([...groupA.keys(), ...groupB.keys()])].map(nome => {
    const valA = groupA.get(nome) || 0;
    const valB = groupB.get(nome) || 0;
    return { nome, valA, valB, variacao: valB - valA, varPercent: valA !== 0 ? ((valB - valA) / valA) * 100 : 0 };
  }).filter(d => d.valA !== 0 || d.valB !== 0);

  const compTop10 = [...compMerged].sort((a, b) => Math.max(Math.abs(b.valA), Math.abs(b.valB)) - Math.max(Math.abs(a.valA), Math.abs(a.valB))).slice(0, 10);

  const labelA = compOptions.find(o => o.mes === selA.mes && o.base === selA.base)?.label || '';
  const labelB = compOptions.find(o => o.mes === selB.mes && o.base === selB.base)?.label || '';

  const compColumns: ColumnDef[] = [
    { key: 'nome', label: isCEO || isDiretoria ? 'Área' : 'Recurso', align: 'left' },
    { key: 'valA', label: labelA, align: 'right', format: 'currency' },
    { key: 'valB', label: labelB, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação A→B', align: 'right', format: 'currency' },
    { key: 'varPercent', label: 'Var %', align: 'right', format: 'percent' },
  ];

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
    { key: 'nome', label: semaforoLabel, align: 'left' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação R$', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
  ];

  const waterfallColumns: ColumnDef[] = [
    { key: 'nome', label: 'Pacote', align: 'left' },
    { key: 'variacao', label: 'Variação R$', align: 'right', format: 'currency' },
  ];

  const openDetail = (nome: string) => {
    const field = isCEO || isDiretoria ? 'areaGrupo1' : 'recurso';
    const recs = filteredRecords.filter(r => (r as any)[field] === nome);
    setDetailModal({ open: true, records: recs, title: `${semaforoLabel}: ${nome}` });
  };

  const marginLeft = isMobile ? 100 : 140;

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
                onClick={() => openDetail(a.nome)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${a.variacao > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}
              >
                {a.nome}: {formatPercent(a.variacaoPercent)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Month comparison */}
      {mesesComReal.length > 0 && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold">Comparação: {labelA} vs {labelB}</h3>
            <div className="flex items-center gap-2 text-xs">
              <label className="text-muted-foreground">Lado A:</label>
              <select value={encodeOpt(selA)} onChange={e => setSelA(decodeOpt(e.target.value))} className="bg-muted text-foreground rounded px-2 py-1 text-xs outline-none">
                {compOptions.map(o => (
                  <option key={encodeOpt(o)} value={encodeOpt(o)}>{o.label}</option>
                ))}
              </select>
              <label className="text-muted-foreground">Lado B:</label>
              <select value={encodeOpt(selB)} onChange={e => setSelB(decodeOpt(e.target.value))} className="bg-muted text-foreground rounded px-2 py-1 text-xs outline-none">
                {compOptions.map(o => (
                  <option key={encodeOpt(o)} value={encodeOpt(o)}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {isSameSelection ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Selecione períodos diferentes para comparar
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={Math.max(200, compTop10.length * 40)}>
                <BarChart data={compTop10} layout="vertical" margin={{ left: marginLeft }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                  <XAxis type="number" tick={{ fill: colors.axis, fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="nome" tick={{ fill: colors.axis, fontSize: 10 }} width={marginLeft - 5} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="valA" name={labelA} fill={colors.orcado} />
                  <Bar dataKey="valB" name={labelB} fill={colors.realizado} />
                </BarChart>
              </ResponsiveContainer>

              <SortableTable columns={compColumns} data={compMerged} exportFilename={`comparacao-${labelA}-vs-${labelB}.csv`} maxHeight="300px" />
            </>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Waterfall */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold">Variação por Pacote (Waterfall)</h3>
          <ResponsiveContainer width="100%" height={Math.max(250, waterfallData.length * 32)}>
            <BarChart data={waterfallData} layout="vertical" margin={{ left: marginLeft }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis type="number" tick={{ fill: colors.axis, fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="nome" tick={{ fill: colors.axis, fontSize: 10 }} width={marginLeft - 5} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine x={0} stroke={colors.reference} />
              <Bar dataKey="variacao" name="Variação">
                {waterfallData.map((d, i) => (
                  <Cell key={i} fill={d.variacao > 0 ? colors.positive : colors.negative} />
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
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis dataKey="mesNome" tick={{ fill: colors.axis, fontSize: 11 }} />
              <YAxis tick={{ fill: colors.axis, fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="orcadoAcc" name="Orçado Acum." stroke={colors.orcado} strokeWidth={2} />
              <Line type="monotone" dataKey="realizadoAcc" name="Realizado Acum." stroke={colors.realizado} strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
              <Line type="monotone" dataKey="projecaoAcc" name="Projeção" stroke={colors.warning} strokeWidth={1.5} strokeDasharray="6 4" dot={false} />
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

      {/* Semáforo */}
      <div>
        <div className="px-1 py-2"><h3 className="text-sm font-semibold">Semáforo por {semaforoLabel}</h3></div>
        <SortableTable
          columns={semaforoColumns}
          data={areaData}
          onRowClick={(row) => openDetail(row.nome)}
          exportFilename={`semaforo-${semaforoField}.csv`}
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
