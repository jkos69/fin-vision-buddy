import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOPEX } from '@/contexts/OPEXContext';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency, formatCompact, formatPercent, getSemaforo } from '@/lib/opex-utils';
import { computeTotals } from '@/lib/totals-helper';
import { MESES_PT } from '@/types/opex';
import { Building, ChevronRight, Search, Layers, Factory } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Line, Legend } from 'recharts';
import { SortableTable, type ColumnDef } from '@/components/SortableTable';
import { ChartTooltip } from '@/components/ChartTooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { getChartColors } from '@/lib/chart-colors';

type Modo = 'capex' | 'consolidado';

interface CapexDBRow {
  id: string;
  base: 'orc' | 'real';
  tipo: string | null;
  diretoria: string | null;
  area: string | null;
  centro_custo: string | null;
  desc_centro_custo: string | null;
  responsavel_area: string | null;
  nome_projeto: string | null;
  grupo_pacotes: string | null;
  razao_social: string | null;
  historico: string | null;
  data_lancamento: string | null;
  nf_numero: string | null;
  conta_contabil: string | null;
  desc_conta_contabil: string | null;
  executado: number;
  mes_num: number;
}

interface UnifiedRow {
  fonte: 'opex' | 'capex';
  base: 'orc' | 'real';
  diretoria: string;
  area: string;
  centro_custo: string;
  desc_centro_custo: string;
  responsavel: string;
  pacote: string;
  recurso: string;
  projeto: string;
  fornecedor: string;
  historico: string;
  data: string;
  nf: string;
  executado: number;
  mes: number;
}

function SemaforoIcon({ status }: { status: 'green' | 'yellow' | 'red' }) {
  const c = { green: 'bg-success', yellow: 'bg-warning', red: 'bg-destructive' };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${c[status]}`} />;
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1 font-mono">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function CapexCentroCustoPage() {
  const { filteredRecords: opexRecords, periodoView, mesSelecionado } = useOPEX();
  const { isCEO, isDiretoria, isArea, session } = useAuth();
  const { theme } = useTheme();
  const colors = getChartColors(theme);
  const isMobile = useIsMobile();

  const [capexRows, setCapexRows] = useState<CapexDBRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [modo, setModo] = useState<Modo>('capex');
  const [selectedDiretoria, setSelectedDiretoria] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedCC, setSelectedCC] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchRef = useRef<HTMLDivElement>(null);

  // Load capex
  useEffect(() => {
    (async () => {
      setLoading(true);
      const PAGE = 1000;
      let from = 0;
      const all: CapexDBRow[] = [];
      while (true) {
        const { data, error } = await supabase.from('capex_records')
          .select('id, base, tipo, diretoria, area, centro_custo, desc_centro_custo, responsavel_area, nome_projeto, grupo_pacotes, razao_social, historico, data_lancamento, nf_numero, conta_contabil, desc_conta_contabil, executado, mes_num')
          .range(from, from + PAGE - 1);
        if (error) { console.error(error); break; }
        if (!data || data.length === 0) break;
        all.push(...(data as any as CapexDBRow[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setCapexRows(all);
      setLoading(false);
    })();
  }, []);

  // Initialize by access level
  useEffect(() => {
    if (isDiretoria) setSelectedDiretoria(session?.diretoria || null);
    if (isArea) {
      setSelectedDiretoria(session?.diretoria || null);
      setSelectedArea(session?.area || null);
    }
  }, [isDiretoria, isArea, session]);

  // Highlight from URL
  useEffect(() => {
    const highlight = searchParams.get('highlight');
    if (highlight && capexRows.length > 0) {
      const rec = capexRows.find(r => r.centro_custo === highlight);
      if (rec) {
        setSelectedDiretoria(rec.diretoria);
        setSelectedArea(rec.area);
        setSelectedCC(rec.centro_custo);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, capexRows, setSearchParams]);

  // Outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scoped capex by access
  const scopedCapex = useMemo(() => {
    if (isCEO) return capexRows;
    if (isDiretoria && session?.diretoria) return capexRows.filter(r => r.diretoria === session.diretoria);
    if (isArea && session?.area) return capexRows.filter(r => r.area === session.area);
    return [];
  }, [capexRows, isCEO, isDiretoria, isArea, session]);

  // Unified
  const unified = useMemo<UnifiedRow[]>(() => {
    const out: UnifiedRow[] = [];
    for (const r of scopedCapex) {
      out.push({
        fonte: 'capex',
        base: r.base,
        diretoria: r.diretoria || '',
        area: r.area || '',
        centro_custo: r.centro_custo || '',
        desc_centro_custo: r.desc_centro_custo || '',
        responsavel: r.responsavel_area || '',
        pacote: (r.grupo_pacotes || '').trim(),
        recurso: '',
        projeto: r.nome_projeto || '',
        fornecedor: r.razao_social || '',
        historico: r.historico || '',
        data: r.data_lancamento || '',
        nf: r.nf_numero || '',
        executado: Number(r.executado) || 0,
        mes: r.mes_num,
      });
    }
    if (modo === 'consolidado') {
      for (const r of opexRecords) {
        const baseNorm: 'orc' | 'real' = r.base === 'REAL26' ? 'real' : 'orc';
        out.push({
          fonte: 'opex',
          base: baseNorm,
          diretoria: r.diretoria || '',
          area: r.areaGrupo1 || '',
          centro_custo: r.centroCusto || '',
          desc_centro_custo: r.descricaoCCusto || '',
          responsavel: r.responsavelArea || '',
          pacote: r.pacote || '',
          recurso: r.recurso || '',
          projeto: '',
          fornecedor: r.nomeFornecedor || '',
          historico: r.historico || '',
          data: r.dataLcto || '',
          nf: '',
          executado: r.executado,
          mes: r.mes,
        });
      }
    }
    return out;
  }, [scopedCapex, opexRecords, modo]);

  const isMensal = periodoView === 'mensal' && !!mesSelecionado;
  const orcLabel = isMensal ? `Orçado ${MESES_PT[mesSelecionado! - 1]}` : 'Orçado YTD';
  const realLabel = isMensal ? `Realizado ${MESES_PT[mesSelecionado! - 1]}` : 'Realizado YTD';

  const mesesComReal = useMemo(() => {
    const set = new Set<number>();
    for (const r of unified) if (r.base === 'real' && r.executado !== 0) set.add(r.mes);
    return [...set].sort((a, b) => a - b);
  }, [unified]);

  const computeValues = (recs: UnifiedRow[]) => {
    let orcado = 0, realizado = 0;
    for (const r of recs) {
      if (r.base === 'orc') {
        if (isMensal) { if (r.mes === mesSelecionado) orcado += r.executado; }
        else if (mesesComReal.includes(r.mes)) orcado += r.executado;
      } else {
        if (isMensal) { if (r.mes === mesSelecionado) realizado += r.executado; }
        else realizado += r.executado;
      }
    }
    return { orcado, realizado };
  };

  // Search
  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const q = searchQuery.toUpperCase();
    const seen = new Set<string>();
    const results: { codigo: string; descricao: string; area: string; diretoria: string }[] = [];
    for (const r of unified) {
      if (results.length >= 10) break;
      const key = r.centro_custo;
      if (!key || seen.has(key)) continue;
      if (key.toUpperCase().includes(q) || (r.desc_centro_custo || '').toUpperCase().includes(q)) {
        seen.add(key);
        results.push({ codigo: r.centro_custo, descricao: r.desc_centro_custo, area: r.area, diretoria: r.diretoria });
      }
    }
    return results;
  }, [searchQuery, unified]);

  const handleSearchSelect = (r: { codigo: string; area: string; diretoria: string }) => {
    setSelectedDiretoria(r.diretoria);
    setSelectedArea(r.area);
    setSelectedCC(r.codigo);
    setSearchQuery('');
    setShowDropdown(false);
  };

  // Diretorias
  const diretoriasData = useMemo(() => {
    const groups = new Map<string, { orcado: number; realizado: number; ccs: Set<string> }>();
    for (const r of unified) {
      if (!r.diretoria) continue;
      if (!groups.has(r.diretoria)) groups.set(r.diretoria, { orcado: 0, realizado: 0, ccs: new Set() });
      const g = groups.get(r.diretoria)!;
      if (r.centro_custo) g.ccs.add(r.centro_custo);
      if (r.base === 'orc') {
        if (isMensal) { if (r.mes === mesSelecionado) g.orcado += r.executado; }
        else if (mesesComReal.includes(r.mes)) g.orcado += r.executado;
      } else {
        if (isMensal) { if (r.mes === mesSelecionado) g.realizado += r.executado; }
        else g.realizado += r.executado;
      }
    }
    return Array.from(groups.entries())
      .map(([nome, g]) => ({
        nome, orcado: g.orcado, realizado: g.realizado, qtdCCs: g.ccs.size,
        variacao: g.realizado - g.orcado,
        variacaoPercent: g.orcado !== 0 ? ((g.realizado - g.orcado) / g.orcado) * 100 : 0,
        semaforo: getSemaforo(g.realizado, g.orcado),
      }))
      .filter(d => d.orcado !== 0 || d.realizado !== 0)
      .sort((a, b) => b.orcado - a.orcado);
  }, [unified, isMensal, mesSelecionado, mesesComReal]);

  const areasData = useMemo(() => {
    if (!selectedDiretoria) return [];
    const recs = unified.filter(r => r.diretoria === selectedDiretoria);
    const groups = new Map<string, { orcado: number; realizado: number; ccs: Set<string>; responsavel: string }>();
    for (const r of recs) {
      if (!r.area) continue;
      if (!groups.has(r.area)) groups.set(r.area, { orcado: 0, realizado: 0, ccs: new Set(), responsavel: r.responsavel || '' });
      const g = groups.get(r.area)!;
      if (r.centro_custo) g.ccs.add(r.centro_custo);
      if (r.base === 'orc') {
        if (isMensal) { if (r.mes === mesSelecionado) g.orcado += r.executado; }
        else if (mesesComReal.includes(r.mes)) g.orcado += r.executado;
      } else {
        if (isMensal) { if (r.mes === mesSelecionado) g.realizado += r.executado; }
        else g.realizado += r.executado;
      }
    }
    return Array.from(groups.entries()).map(([nome, g]) => ({
      nome, orcado: g.orcado, realizado: g.realizado, qtdCCs: g.ccs.size, responsavel: g.responsavel,
      variacao: g.realizado - g.orcado,
      variacaoPercent: g.orcado !== 0 ? ((g.realizado - g.orcado) / g.orcado) * 100 : 0,
      semaforo: getSemaforo(g.realizado, g.orcado),
    }))
      .filter(d => d.orcado !== 0 || d.realizado !== 0)
      .sort((a, b) => b.orcado - a.orcado);
  }, [unified, selectedDiretoria, isMensal, mesSelecionado, mesesComReal]);

  const ccData = useMemo(() => {
    if (!selectedArea) return [];
    const recs = unified.filter(r => r.diretoria === selectedDiretoria && r.area === selectedArea);
    const groups = new Map<string, { codigo: string; descricao: string; orcado: number; realizado: number }>();
    for (const r of recs) {
      const key = r.centro_custo;
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, { codigo: key, descricao: r.desc_centro_custo, orcado: 0, realizado: 0 });
      const g = groups.get(key)!;
      if (r.base === 'orc') {
        if (isMensal) { if (r.mes === mesSelecionado) g.orcado += r.executado; }
        else if (mesesComReal.includes(r.mes)) g.orcado += r.executado;
      } else {
        if (isMensal) { if (r.mes === mesSelecionado) g.realizado += r.executado; }
        else g.realizado += r.executado;
      }
    }
    return Array.from(groups.values()).map(g => ({
      codigo: g.codigo, descricao: g.descricao,
      orcado: g.orcado, realizado: g.realizado,
      variacao: g.realizado - g.orcado,
      variacaoPercent: g.orcado !== 0 ? ((g.realizado - g.orcado) / g.orcado) * 100 : 0,
      semaforo: getSemaforo(g.realizado, g.orcado),
    }))
      .filter(d => d.orcado !== 0 || d.realizado !== 0)
      .sort((a, b) => b.orcado - a.orcado);
  }, [unified, selectedDiretoria, selectedArea, isMensal, mesSelecionado, mesesComReal]);

  // CC detail
  const ccDetail = useMemo(() => {
    if (!selectedCC) return null;
    const recs = unified.filter(r => r.centro_custo === selectedCC);
    if (recs.length === 0) return null;
    const total = computeValues(recs);
    const opexVals = computeValues(recs.filter(r => r.fonte === 'opex'));
    const capexVals = computeValues(recs.filter(r => r.fonte === 'capex'));
    const lancs = recs.filter(r => r.base === 'real')
      .filter(r => isMensal ? r.mes === mesSelecionado : true)
      .sort((a, b) => (a.data < b.data ? 1 : -1));
    const lastReal = mesesComReal[mesesComReal.length - 1] || 0;
    const monthly = MESES_PT.map((nome, i) => {
      const m = i + 1;
      const orc = recs.filter(r => r.base === 'orc' && r.mes === m).reduce((s, r) => s + r.executado, 0);
      const real = recs.filter(r => r.base === 'real' && r.mes === m).reduce((s, r) => s + r.executado, 0);
      return { mes: nome, orcado: orc, realizado: m <= lastReal ? real : null as number | null };
    });
    return { info: recs[0], total, opexVals, capexVals, lancs, monthly };
  }, [selectedCC, unified, isMensal, mesSelecionado, mesesComReal]);

  // Columns
  const diretoriaColumns: ColumnDef[] = [
    { key: 'nome', label: 'Diretoria', align: 'left' },
    { key: 'qtdCCs', label: 'CCs', align: 'right', format: 'number' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
    { key: 'semaforo', label: 'Status', align: 'center', sortable: false, render: (v) => <SemaforoIcon status={v} /> },
  ];

  const areaColumns: ColumnDef[] = [
    { key: 'nome', label: 'Área', align: 'left' },
    { key: 'responsavel', label: 'Responsável', align: 'left' },
    { key: 'qtdCCs', label: 'CCs', align: 'right', format: 'number' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
    { key: 'semaforo', label: 'Status', align: 'center', sortable: false, render: (v) => <SemaforoIcon status={v} /> },
  ];

  const ccColumns: ColumnDef[] = [
    { key: 'codigo', label: 'Código', align: 'left' },
    { key: 'descricao', label: 'Descrição', align: 'left' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
    { key: 'semaforo', label: 'Status', align: 'center', sortable: false, render: (v) => <SemaforoIcon status={v} /> },
  ];

  const lancsColumns: ColumnDef[] = modo === 'consolidado' ? [
    { key: 'fonte', label: 'Fonte', align: 'left', render: (v) => (
      <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${v === 'capex' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>{v}</span>
    ) },
    { key: 'data', label: 'Data', align: 'left' },
    { key: 'fornecedor', label: 'Fornecedor', align: 'left' },
    { key: 'historico', label: 'Histórico', align: 'left' },
    { key: 'pacote', label: 'Pacote', align: 'left' },
    { key: 'executado', label: 'Valor', align: 'right', format: 'currency' },
  ] : [
    { key: 'data', label: 'Data', align: 'left' },
    { key: 'nf', label: 'NF', align: 'left' },
    { key: 'fornecedor', label: 'Fornecedor', align: 'left' },
    { key: 'historico', label: 'Histórico', align: 'left' },
    { key: 'projeto', label: 'Projeto', align: 'left' },
    { key: 'pacote', label: 'Pacote', align: 'left' },
    { key: 'executado', label: 'Valor', align: 'right', format: 'currency' },
  ];

  const showLevel1 = isCEO && !selectedDiretoria;
  const showLevel2 = selectedDiretoria && !selectedArea && !isArea;
  const showLevel3 = selectedArea && !selectedCC;
  const showLevel4 = !!selectedCC;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building className="h-6 w-6 text-primary" />
            CC Capex
          </h1>
          <p className="text-sm text-muted-foreground">
            {modo === 'capex'
              ? 'Análise de Capex por Centro de Custo'
              : 'Visão consolidada: OPEX + Capex (custo total do CC)'}
          </p>
        </div>

        <div className="flex gap-1 glass-card p-1">
          <button
            onClick={() => setModo('capex')}
            className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${modo === 'capex' ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-accent'}`}
          >
            <Factory className="h-3.5 w-3.5" /> Capex
          </button>
          <button
            onClick={() => setModo('consolidado')}
            className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${modo === 'consolidado' ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-accent'}`}
          >
            <Layers className="h-3.5 w-3.5" /> OPEX + Capex
          </button>
        </div>
      </div>

      {/* Search */}
      <div ref={searchRef} className="relative max-w-md">
        <div className="flex items-center gap-2 glass-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Buscar por código ou descrição do CC..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-64 overflow-y-auto">
            {searchResults.map(r => (
              <button
                key={r.codigo}
                onClick={() => handleSearchSelect(r)}
                className="flex flex-col w-full px-3 py-2 text-left hover:bg-accent transition-colors border-b border-border/50 last:border-0"
              >
                <span className="text-sm font-medium">{r.codigo} - {r.descricao}</span>
                <span className="text-xs text-muted-foreground">{r.area} · {r.diretoria}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <button
          onClick={() => { setSelectedDiretoria(isCEO ? null : session?.diretoria || null); setSelectedArea(isArea ? session?.area || null : null); setSelectedCC(null); }}
          className="text-primary hover:underline"
        >
          CC Capex
        </button>
        {selectedDiretoria && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button
              onClick={() => { setSelectedArea(isArea ? session?.area || null : null); setSelectedCC(null); }}
              className={selectedArea || selectedCC ? 'text-primary hover:underline' : 'text-foreground'}
            >
              {selectedDiretoria}
            </button>
          </>
        )}
        {selectedArea && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button
              onClick={() => setSelectedCC(null)}
              className={selectedCC ? 'text-primary hover:underline' : 'text-foreground'}
            >
              {selectedArea}
            </button>
          </>
        )}
        {selectedCC && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground">{selectedCC}{ccDetail?.info?.desc_centro_custo ? ` - ${ccDetail.info.desc_centro_custo}` : ''}</span>
          </>
        )}
      </div>

      {loading && <div className="glass-card p-6 text-center text-sm text-muted-foreground">Carregando...</div>}

      {!loading && (
        <>
          {showLevel1 && (
            <SortableTable
              columns={diretoriaColumns}
              data={diretoriasData}
              onRowClick={(row) => setSelectedDiretoria(row.nome)}
              exportFilename="cc-capex-diretorias.csv"
              totalsRow={computeTotals(diretoriasData, ['qtdCCs', 'orcado', 'realizado', 'variacao', 'variacaoPercent'])}
              emptyMessage="Sem dados para os filtros selecionados"
            />
          )}

          {showLevel2 && (
            <SortableTable
              columns={areaColumns}
              data={areasData}
              onRowClick={(row) => setSelectedArea(row.nome)}
              exportFilename={`cc-capex-areas-${selectedDiretoria}.csv`}
              totalsRow={computeTotals(areasData, ['qtdCCs', 'orcado', 'realizado', 'variacao', 'variacaoPercent'])}
              emptyMessage="Sem dados"
            />
          )}

          {showLevel3 && (
            <SortableTable
              columns={ccColumns}
              data={ccData}
              onRowClick={(row) => setSelectedCC(row.codigo)}
              exportFilename={`cc-capex-${selectedArea}.csv`}
              totalsRow={computeTotals(ccData, ['orcado', 'realizado', 'variacao', 'variacaoPercent'])}
              emptyMessage="Sem CCs para esta área"
            />
          )}

          {showLevel4 && ccDetail && (
            <div className="space-y-6">
              <div className="glass-card p-5">
                <h3 className="text-lg font-semibold">{ccDetail.info?.centro_custo} — {ccDetail.info?.desc_centro_custo}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {ccDetail.info?.area} · {ccDetail.info?.diretoria}
                  {ccDetail.info?.responsavel && ` · Resp.: ${ccDetail.info.responsavel}`}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KPI label={orcLabel} value={formatCompact(ccDetail.total.orcado)} />
                <KPI label={realLabel} value={formatCompact(ccDetail.total.realizado)} />
                <KPI
                  label="% Execução"
                  value={ccDetail.total.orcado !== 0 ? formatPercent((ccDetail.total.realizado / ccDetail.total.orcado) * 100) : '—'}
                />
                <KPI label="Saldo" value={formatCompact(ccDetail.total.orcado - ccDetail.total.realizado)} />
              </div>

              {modo === 'consolidado' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="glass-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold">OPEX</h4>
                      <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">OPEX</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Orçado: <span className="font-mono text-foreground">{formatCompact(ccDetail.opexVals.orcado)}</span></span>
                      <span className="text-muted-foreground">Real: <span className="font-mono text-foreground">{formatCompact(ccDetail.opexVals.realizado)}</span></span>
                    </div>
                  </div>
                  <div className="glass-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold">Capex</h4>
                      <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary">CAPEX</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Orçado: <span className="font-mono text-foreground">{formatCompact(ccDetail.capexVals.orcado)}</span></span>
                      <span className="text-muted-foreground">Real: <span className="font-mono text-foreground">{formatCompact(ccDetail.capexVals.realizado)}</span></span>
                    </div>
                  </div>
                </div>
              )}

              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold mb-4">Curva Mensal — Orçado vs Realizado</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={ccDetail.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="mes" tick={{ fill: colors.axis, fontSize: 11 }} />
                    <YAxis tick={{ fill: colors.axis, fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="orcado" name="Orçado" fill={colors.orcado} opacity={0.5} />
                    <Line type="monotone" dataKey="realizado" name="Realizado" stroke={colors.realizado} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div>
                <div className="px-1 py-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Lançamentos ({ccDetail.lancs.length})</h3>
                </div>
                <SortableTable
                  columns={lancsColumns}
                  data={ccDetail.lancs}
                  exportFilename={`lancamentos-${selectedCC}.csv`}
                  totalsRow={computeTotals(ccDetail.lancs, ['executado'])}
                  emptyMessage="Sem lançamentos para o período"
                  maxHeight="500px"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
