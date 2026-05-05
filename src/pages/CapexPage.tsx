import { useEffect, useMemo, useState } from 'react';
import { Building2, Upload as UploadIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CapexFileUpload } from '@/components/CapexFileUpload';
import { SortableTable, ColumnDef } from '@/components/SortableTable';
import { CapexDrillModal, DrillState } from '@/components/CapexDrillModal';
import { formatCurrency, formatPercent } from '@/lib/opex-utils';
import { computeTotals } from '@/lib/totals-helper';
import { MESES_PT } from '@/types/opex';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface DBRow {
  id: string;
  base: 'orc' | 'real';
  tipo: string | null;
  diretoria: string | null;
  area: string | null;
  centro_custo: string | null;
  desc_centro_custo: string | null;
  nome_projeto: string | null;
  sponsor_projeto: string | null;
  projeto_novo: string | null;
  grupo_pacotes: string | null;
  responsavel_area: string | null;
  razao_social: string | null;
  historico: string | null;
  data_lancamento: string | null;
  nf_numero: string | null;
  conta_contabil: string | null;
  desc_conta_contabil: string | null;
  executado: number;
  mes_num: number;
}

interface UploadInfo { uploaded_at: string; uploaded_by: string; file_name: string; record_count: number; }

type PeriodView = 'ytd' | 'mensal';
type TipoFilter = 'all' | 'Capex' | 'FOLHA';
type BaseFilter = 'all' | 'orc' | 'real';
type ViewMode = 'diretoria' | 'projeto' | 'pacote';

function fmtCompact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (a >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return formatCurrency(v);
}

function inPeriod(r: DBRow, periodView: PeriodView, mesSel: number, lastReal: number): boolean {
  if (periodView === 'mensal') return r.mes_num === mesSel;
  const limite = lastReal || 12;
  if (r.base === 'orc') return r.mes_num <= limite;
  return true;
}

export default function CapexPage() {
  const { session, isCEO, isDiretoria, isArea } = useAuth();
  const [rows, setRows] = useState<DBRow[]>([]);
  const [uploadInfo, setUploadInfo] = useState<UploadInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  // Filters
  const [periodView, setPeriodView] = useState<PeriodView>('ytd');
  const [mesSel, setMesSel] = useState<number>(1);
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('Capex');
  const [baseFilter, setBaseFilter] = useState<BaseFilter>('all');
  const [diretoria, setDiretoria] = useState<string>(
    isDiretoria || isArea ? (session?.diretoria || 'Todas') : 'Todas'
  );
  const [area, setArea] = useState<string>(
    isArea ? (session?.area || 'Todas') : 'Todas'
  );
  const [projeto, setProjeto] = useState<string>('Todos');
  const [pacote, setPacote] = useState<string>('Todos');

  const [viewMode, setViewMode] = useState<ViewMode>(isCEO ? 'diretoria' : 'projeto');
  const [drill, setDrill] = useState<DrillState | null>(null);

  const reload = async () => {
    setLoading(true);
    const PAGE = 1000;
    let from = 0;
    const all: DBRow[] = [];
    while (true) {
      const { data, error } = await supabase.from('capex_records')
        .select('id, base, tipo, diretoria, area, centro_custo, desc_centro_custo, nome_projeto, sponsor_projeto, projeto_novo, grupo_pacotes, responsavel_area, razao_social, historico, data_lancamento, nf_numero, conta_contabil, desc_conta_contabil, executado, mes_num')
        .range(from, from + PAGE - 1);
      if (error) { console.error(error); break; }
      if (!data || data.length === 0) break;
      all.push(...(data as DBRow[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }
    setRows(all);
    const { data: up } = await supabase.from('capex_uploads').select('uploaded_at, uploaded_by, file_name, record_count').order('uploaded_at', { ascending: false }).limit(1);
    setUploadInfo(up?.[0] as any || null);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const scopedRows = useMemo(() => {
    if (isCEO) return rows;
    if (isDiretoria && session?.diretoria) return rows.filter(r => r.diretoria === session.diretoria);
    if (isArea && session?.area) return rows.filter(r => r.area === session.area);
    return [];
  }, [rows, isCEO, isDiretoria, isArea, session]);

  const mesesComReal = useMemo(() => [...new Set(scopedRows.filter(r => r.base === 'real').map(r => r.mes_num))].sort((a, b) => a - b), [scopedRows]);
  const lastReal = mesesComReal[mesesComReal.length - 1] || 0;

  const allDir = useMemo(() => [...new Set(scopedRows.map(r => r.diretoria || '').filter(Boolean))].sort(), [scopedRows]);
  const allArea = useMemo(() => [...new Set(scopedRows.filter(r => diretoria === 'Todas' || r.diretoria === diretoria).map(r => r.area || '').filter(Boolean))].sort(), [scopedRows, diretoria]);
  const allProj = useMemo(() => [...new Set(scopedRows.map(r => r.nome_projeto || '').filter(Boolean))].sort(), [scopedRows]);
  const allPac = useMemo(() => [...new Set(scopedRows.map(r => (r.grupo_pacotes || '').trim()).filter(Boolean))].sort(), [scopedRows]);

  // filteredSemBase: applies all filters except baseFilter (used for tables that compare orc vs real)
  const filteredSemBase = useMemo(() => scopedRows.filter(r => {
    if (tipoFilter !== 'all' && r.tipo !== tipoFilter) return false;
    if (diretoria !== 'Todas' && r.diretoria !== diretoria) return false;
    if (area !== 'Todas' && r.area !== area) return false;
    if (projeto !== 'Todos' && r.nome_projeto !== projeto) return false;
    if (pacote !== 'Todos' && (r.grupo_pacotes || '').trim() !== pacote) return false;
    return true;
  }), [scopedRows, tipoFilter, diretoria, area, projeto, pacote]);

  const filtered = useMemo(() => filteredSemBase.filter(r => baseFilter === 'all' || r.base === baseFilter), [filteredSemBase, baseFilter]);

  const filteredByPeriod = useMemo(() => filtered.filter(r => inPeriod(r, periodView, mesSel, lastReal)), [filtered, periodView, mesSel, lastReal]);
  const filteredSemBaseByPeriod = useMemo(() => filteredSemBase.filter(r => inPeriod(r, periodView, mesSel, lastReal)), [filteredSemBase, periodView, mesSel, lastReal]);

  // KPIs (use filteredByPeriod; orcAnual ignores period)
  const kpis = useMemo(() => {
    const orcAnual = filtered.filter(r => r.base === 'orc').reduce((s, r) => s + r.executado, 0);
    const orcado = filteredByPeriod.filter(r => r.base === 'orc').reduce((s, r) => s + r.executado, 0);
    const realizado = filteredByPeriod.filter(r => r.base === 'real').reduce((s, r) => s + r.executado, 0);
    const exec = orcado !== 0 ? (realizado / orcado) * 100 : 0;
    const realAnual = filtered.filter(r => r.base === 'real').reduce((s, r) => s + r.executado, 0);
    return { orcAnual, orcado, realizado, exec, saldo: orcAnual - realAnual };
  }, [filtered, filteredByPeriod]);

  const execColor = kpis.exec >= 80 && kpis.exec <= 110 ? 'text-success' : (kpis.exec >= 60 && kpis.exec < 80) || (kpis.exec > 110 && kpis.exec <= 130) ? 'text-warning' : 'text-destructive';

  // Monthly chart respects baseFilter
  const monthly = useMemo(() => {
    return MESES_PT.map((nome, i) => {
      const m = i + 1;
      const orc = baseFilter === 'real' ? null : filtered.filter(r => r.base === 'orc' && r.mes_num === m).reduce((s, r) => s + r.executado, 0);
      const realVal = baseFilter === 'orc' ? null : filtered.filter(r => r.base === 'real' && r.mes_num === m).reduce((s, r) => s + r.executado, 0);
      return { mes: nome, orcado: orc, realizado: realVal != null && m <= lastReal ? realVal : null };
    });
  }, [filtered, lastReal, baseFilter]);

  // Aggregations using filteredSemBaseByPeriod (always show both orc/real columns)
  type AggRow = { chave: string; orcado: number; realizado: number; saldo: number; variacaoPercent: number; diretoria?: string; sponsor?: string; status?: string };

  function aggregate(keyFn: (r: DBRow) => string, extra?: (r: DBRow, row: AggRow) => void): AggRow[] {
    const map = new Map<string, AggRow>();
    for (const r of filteredSemBaseByPeriod) {
      const k = keyFn(r);
      if (!k) continue;
      let row = map.get(k);
      if (!row) { row = { chave: k, orcado: 0, realizado: 0, saldo: 0, variacaoPercent: 0 }; map.set(k, row); }
      if (extra) extra(r, row);
      if (r.base === 'orc') row.orcado += r.executado;
      else row.realizado += r.executado;
    }
    return Array.from(map.values()).map(r => ({
      ...r,
      saldo: r.orcado - r.realizado,
      variacaoPercent: r.orcado !== 0 ? ((r.realizado - r.orcado) / r.orcado) * 100 : 0,
    })).filter(r => r.orcado !== 0 || r.realizado !== 0).sort((a, b) => b.orcado - a.orcado);
  }

  const dirData = useMemo(() => aggregate(r => r.diretoria || ''), [filteredSemBaseByPeriod]);
  const pacData = useMemo(() => aggregate(r => (r.grupo_pacotes || '').trim()), [filteredSemBaseByPeriod]);
  const projData = useMemo(() => aggregate(
    r => r.nome_projeto || '',
    (r, row) => { if (!row.diretoria) { row.diretoria = r.diretoria || ''; row.sponsor = r.sponsor_projeto || ''; row.status = r.projeto_novo || ''; } }
  ), [filteredSemBaseByPeriod]);

  const projTotals = computeTotals(projData, ['orcado', 'realizado', 'saldo', 'variacaoPercent']);
  const dirTotals = computeTotals(dirData, ['orcado', 'realizado', 'saldo', 'variacaoPercent']);
  const pacTotals = computeTotals(pacData, ['orcado', 'realizado', 'saldo', 'variacaoPercent']);

  const projColumns: ColumnDef[] = [
    { key: 'chave', label: 'Projeto', align: 'left' },
    { key: 'diretoria', label: 'Diretoria', align: 'left' },
    { key: 'sponsor', label: 'Sponsor', align: 'left' },
    { key: 'status', label: 'Status', align: 'left' },
    { key: 'orcado', label: 'Orçado', align: 'right', format: 'currency' },
    { key: 'realizado', label: 'Realizado', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: '% Var', align: 'right', format: 'percent' },
    { key: 'saldo', label: 'Saldo', align: 'right', format: 'currency' },
  ];
  const dirColumns: ColumnDef[] = [
    { key: 'chave', label: 'Diretoria', align: 'left' },
    { key: 'orcado', label: 'Orçado', align: 'right', format: 'currency' },
    { key: 'realizado', label: 'Realizado', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: '% Var', align: 'right', format: 'percent' },
    { key: 'saldo', label: 'Saldo', align: 'right', format: 'currency' },
  ];
  const pacColumns: ColumnDef[] = [
    { key: 'chave', label: 'Pacote', align: 'left' },
    { key: 'orcado', label: 'Orçado', align: 'right', format: 'currency' },
    { key: 'realizado', label: 'Realizado', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: '% Var', align: 'right', format: 'percent' },
    { key: 'saldo', label: 'Saldo', align: 'right', format: 'currency' },
  ];

  if (!isCEO && !isDiretoria && !isArea) {
    return <div className="glass-card p-8"><p className="text-muted-foreground">Acesso restrito.</p></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" /> Análise de Capex 2026</h1>
          {uploadInfo && (
            <p className="text-xs text-muted-foreground mt-1">
              Último upload: {new Date(uploadInfo.uploaded_at).toLocaleString('pt-BR')} · {uploadInfo.file_name} · {uploadInfo.record_count.toLocaleString('pt-BR')} registros
            </p>
          )}
        </div>
        {isCEO && (
          <button onClick={() => setShowUpload(s => !s)} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
            <UploadIcon className="h-3.5 w-3.5" /> {showUpload ? 'Fechar' : 'Upload Planilha Capex'}
          </button>
        )}
      </div>

      {isCEO && showUpload && <CapexFileUpload onUploaded={() => { setShowUpload(false); reload(); }} />}

      {loading && <div className="glass-card p-8 text-center text-muted-foreground">Carregando...</div>}

      {!loading && rows.length === 0 && (
        <div className="glass-card p-8 text-center text-muted-foreground">
          {isCEO
            ? 'Nenhum dado de Capex importado ainda. Clique em "Upload Planilha Capex" para começar.'
            : 'Nenhum dado de Capex disponível ainda.'}
        </div>
      )}

      {!loading && rows.length > 0 && scopedRows.length === 0 && (
        <div className="glass-card p-8 text-center text-muted-foreground">
          Nenhum dado de Capex para {isArea ? `a área "${session?.area}"` : `a diretoria "${session?.diretoria}"`}.
        </div>
      )}

      {!loading && scopedRows.length > 0 && (
        <>
          {/* Filters */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground">Período:</span>
              <button onClick={() => setPeriodView('ytd')} className={`text-xs px-3 py-1 rounded-md ${periodView === 'ytd' ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-accent'}`}>YTD ({MESES_PT[lastReal - 1] || '—'})</button>
              <button onClick={() => setPeriodView('mensal')} className={`text-xs px-3 py-1 rounded-md ${periodView === 'mensal' ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-accent'}`}>Mês</button>
              {periodView === 'mensal' && (
                <select value={mesSel} onChange={e => setMesSel(Number(e.target.value))} className="text-xs bg-card border border-border rounded px-2 py-1">
                  {MESES_PT.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
                </select>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground">Tipo:</span>
              {(['Capex', 'FOLHA', 'all'] as TipoFilter[]).map(t => (
                <button key={t} onClick={() => setTipoFilter(t)} className={`text-xs px-3 py-1 rounded-md ${tipoFilter === t ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-accent'}`}>
                  {t === 'all' ? 'Todos' : t}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground">Base:</span>
              {(['all', 'orc', 'real'] as BaseFilter[]).map(b => (
                <button key={b} onClick={() => setBaseFilter(b)} className={`text-xs px-3 py-1 rounded-md ${baseFilter === b ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-accent'}`}>
                  {b === 'all' ? 'Ambos' : b === 'orc' ? 'Orçado' : 'Realizado'}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Selector
                label="Diretoria"
                value={diretoria}
                options={isDiretoria || isArea ? [session?.diretoria || ''] : ['Todas', ...allDir]}
                onChange={v => { setDiretoria(v); setArea('Todas'); }}
                disabled={isDiretoria || isArea}
              />
              <Selector
                label="Área"
                value={area}
                options={isArea ? [session?.area || ''] : ['Todas', ...allArea]}
                onChange={setArea}
                disabled={isArea}
              />
              <Selector label="Projeto" value={projeto} options={['Todos', ...allProj]} onChange={setProjeto} />
              <Selector label="Pacote" value={pacote} options={['Todos', ...allPac]} onChange={setPacote} />
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label={periodView === 'ytd' ? 'Orçado YTD' : `Orçado ${MESES_PT[mesSel - 1]}`} value={fmtCompact(kpis.orcado)} />
            <Kpi label={periodView === 'ytd' ? 'Realizado YTD' : `Realizado ${MESES_PT[mesSel - 1]}`} value={fmtCompact(kpis.realizado)} />
            <Kpi label="% Execução" value={formatPercent(kpis.exec)} valueClass={execColor} />
            <Kpi label="Saldo a Executar" value={fmtCompact(kpis.saldo)} />
          </div>

          {/* Monthly chart */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold mb-3">Curva Mensal · Orçado vs Realizado</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => v == null ? '—' : formatCurrency(Number(v))}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {periodView === 'mensal' && (
                  <ReferenceLine x={MESES_PT[mesSel - 1]} stroke="hsl(var(--primary))" strokeDasharray="4 4" label={{ value: 'Selecionado', fontSize: 10, fill: 'hsl(var(--primary))', position: 'top' }} />
                )}
                <Line type="monotone" dataKey="orcado" name="Orçado" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                <Line type="monotone" dataKey="realizado" name="Realizado" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* View toggle + table */}
          <div className="glass-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold">
                {viewMode === 'diretoria' ? `Resumo por Diretoria (${dirData.length})` : viewMode === 'pacote' ? `Resumo por Pacote (${pacData.length})` : `Resumo por Projeto (${projData.length})`}
              </h3>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-muted-foreground">Visão:</span>
                {([
                  { id: 'diretoria' as const, label: 'Por Diretoria', show: isCEO },
                  { id: 'projeto' as const, label: 'Por Projeto', show: true },
                  { id: 'pacote' as const, label: 'Por Pacote', show: true },
                ]).filter(v => v.show).map(v => (
                  <button
                    key={v.id}
                    onClick={() => setViewMode(v.id as ViewMode)}
                    className={`text-xs px-3 py-1 rounded-md ${viewMode === v.id ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-accent'}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            {viewMode === 'diretoria' && (
              <SortableTable
                columns={dirColumns}
                data={dirData}
                totalsRow={dirTotals}
                exportFilename="capex-por-diretoria.csv"
                maxHeight="520px"
                onRowClick={(row) => setDrill({ level: 'area', diretoria: row.chave })}
              />
            )}
            {viewMode === 'projeto' && (
              <SortableTable
                columns={projColumns}
                data={projData}
                totalsRow={projTotals}
                exportFilename="capex-por-projeto.csv"
                maxHeight="520px"
                onRowClick={(row) => setDrill({ level: 'centro_custo', projeto: row.chave })}
              />
            )}
            {viewMode === 'pacote' && (
              <SortableTable
                columns={pacColumns}
                data={pacData}
                totalsRow={pacTotals}
                exportFilename="capex-por-pacote.csv"
                maxHeight="520px"
                onRowClick={(row) => setDrill({ level: 'projeto', pacote: row.chave })}
              />
            )}
          </div>

          {drill && (
            <CapexDrillModal
              rows={filteredSemBaseByPeriod}
              drill={drill}
              onDrillChange={setDrill}
            />
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="glass-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 font-mono ${valueClass}`}>{value}</p>
    </div>
  );
}

function Selector({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <select value={value} onChange={e => onChange(e.target.value)} className="bg-card border border-border rounded px-2 py-1 max-w-[180px]">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
