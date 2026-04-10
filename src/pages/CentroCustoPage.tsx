import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOPEX } from '@/contexts/OPEXContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { groupBy, getMesesComReal, formatCurrency, formatCompact, formatPercent, getSemaforo } from '@/lib/opex-utils';
import { computeTotals } from '@/lib/totals-helper';
import { MESES_PT } from '@/types/opex';
import { Building, ChevronRight, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { SortableTable, type ColumnDef } from '@/components/SortableTable';
import { ExpenseDetailModal } from '@/components/ExpenseDetailModal';
import { ChartTooltip } from '@/components/ChartTooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { getChartColors } from '@/lib/chart-colors';

function SemaforoIcon({ status }: { status: 'green' | 'yellow' | 'red' }) {
  const c = { green: 'bg-success', yellow: 'bg-warning', red: 'bg-destructive' };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${c[status]}`} />;
}

export default function CentroCustoPage() {
  const { filteredRecords, periodoView, mesSelecionado } = useOPEX();
  const { isCEO, isDiretoria, isArea, session } = useAuth();
  const { theme } = useTheme();
  const colors = getChartColors(theme);
  const isMobile = useIsMobile();
  const marginLeft = isMobile ? 100 : 180;

  const [selectedDiretoria, setSelectedDiretoria] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedCC, setSelectedCC] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [detailModal, setDetailModal] = useState<{ open: boolean; records: any[]; title: string }>({ open: false, records: [], title: '' });
  const [searchParams, setSearchParams] = useSearchParams();
  const searchRef = useRef<HTMLDivElement>(null);

  // Initialize based on access level
  useEffect(() => {
    if (isDiretoria) setSelectedDiretoria(session?.diretoria || null);
    if (isArea) {
      setSelectedDiretoria(session?.diretoria || null);
      setSelectedArea(session?.area || null);
    }
  }, [isDiretoria, isArea, session]);

  // Handle highlight from search param
  useEffect(() => {
    const highlight = searchParams.get('highlight');
    if (highlight && filteredRecords.length > 0) {
      const rec = filteredRecords.find(r => r.centroCusto === highlight);
      if (rec) {
        setSelectedDiretoria(rec.diretoria);
        setSelectedArea(rec.areaGrupo1);
        setSelectedCC(rec.centroCusto);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, filteredRecords]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const mesesComReal = getMesesComReal(filteredRecords);
  const isMensal = periodoView === 'mensal' && mesSelecionado;
  const orcLabel = isMensal ? `Orçado ${MESES_PT[mesSelecionado! - 1]}` : 'Orçado YTD';
  const realLabel = isMensal ? `Realizado ${MESES_PT[mesSelecionado! - 1]}` : 'Realizado YTD';

  // Search results
  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const q = searchQuery.toUpperCase();
    const seen = new Set<string>();
    const results: { codigo: string; descricao: string; area: string; diretoria: string }[] = [];
    for (const r of filteredRecords) {
      if (results.length >= 10) break;
      const key = r.centroCusto;
      if (!key || seen.has(key)) continue;
      if (key.includes(q) || r.descricaoCCusto.toUpperCase().includes(q)) {
        seen.add(key);
        results.push({ codigo: r.centroCusto, descricao: r.descricaoCCusto, area: r.areaGrupo1, diretoria: r.diretoria });
      }
    }
    return results;
  }, [searchQuery, filteredRecords]);

  const handleSearchSelect = (result: { codigo: string; area: string; diretoria: string }) => {
    setSelectedDiretoria(result.diretoria);
    setSelectedArea(result.area);
    setSelectedCC(result.codigo);
    setSearchQuery('');
    setShowDropdown(false);
  };

  // Helper to compute orcado/realizado for a set of records
  const computeValues = (recs: typeof filteredRecords) => {
    let orcado = 0, realizado = 0;
    recs.forEach(r => {
      if (r.base === 'ORÇ26') {
        if (isMensal) { if (r.mes === mesSelecionado) orcado += r.executado; }
        else if (mesesComReal.includes(r.mes)) orcado += r.executado;
      }
      if (r.base === 'REAL26') {
        if (isMensal) { if (r.mes === mesSelecionado) realizado += r.executado; }
        else realizado += r.executado;
      }
    });
    return { orcado, realizado };
  };

  // Level 1: Diretorias
  const diretoriasData = useMemo(() => {
    const groups = new Map<string, { orcado: number; realizado: number; ccs: Set<string> }>();
    filteredRecords.forEach(r => {
      if (!groups.has(r.diretoria)) groups.set(r.diretoria, { orcado: 0, realizado: 0, ccs: new Set() });
      const g = groups.get(r.diretoria)!;
      if (r.centroCusto) g.ccs.add(r.centroCusto);
      if (r.base === 'ORÇ26') {
        if (isMensal) { if (r.mes === mesSelecionado) g.orcado += r.executado; }
        else if (mesesComReal.includes(r.mes)) g.orcado += r.executado;
      }
      if (r.base === 'REAL26') {
        if (isMensal) { if (r.mes === mesSelecionado) g.realizado += r.executado; }
        else g.realizado += r.executado;
      }
    });
    return Array.from(groups.entries()).map(([nome, g]) => ({
      nome, orcado: g.orcado, realizado: g.realizado, qtdCCs: g.ccs.size,
      semaforo: getSemaforo(g.realizado, g.orcado),
    })).sort((a, b) => b.orcado - a.orcado);
  }, [filteredRecords, isMensal, mesSelecionado, mesesComReal]);

  // Level 2: Áreas
  const areasData = useMemo(() => {
    if (!selectedDiretoria) return [];
    const areaRecs = filteredRecords.filter(r => r.diretoria === selectedDiretoria);
    const groups = new Map<string, { orcado: number; realizado: number; ccs: Set<string>; responsavel: string }>();
    areaRecs.forEach(r => {
      if (!groups.has(r.areaGrupo1)) groups.set(r.areaGrupo1, { orcado: 0, realizado: 0, ccs: new Set(), responsavel: r.responsavelArea || '' });
      const g = groups.get(r.areaGrupo1)!;
      if (r.centroCusto) g.ccs.add(r.centroCusto);
      if (r.base === 'ORÇ26') {
        if (isMensal) { if (r.mes === mesSelecionado) g.orcado += r.executado; }
        else if (mesesComReal.includes(r.mes)) g.orcado += r.executado;
      }
      if (r.base === 'REAL26') {
        if (isMensal) { if (r.mes === mesSelecionado) g.realizado += r.executado; }
        else g.realizado += r.executado;
      }
    });
    return Array.from(groups.entries()).map(([nome, g]) => ({
      nome, orcado: g.orcado, realizado: g.realizado, qtdCCs: g.ccs.size, responsavel: g.responsavel,
      semaforo: getSemaforo(g.realizado, g.orcado),
    })).sort((a, b) => b.orcado - a.orcado);
  }, [filteredRecords, selectedDiretoria, isMensal, mesSelecionado, mesesComReal]);

  // Level 3: CCs
  const ccData = useMemo(() => {
    if (!selectedArea) return [];
    const areaRecs = filteredRecords.filter(r => r.diretoria === selectedDiretoria && r.areaGrupo1 === selectedArea);
    const groups = new Map<string, { codigo: string; descricao: string; orcado: number; realizado: number }>();
    areaRecs.forEach(r => {
      const key = r.centroCusto;
      if (!key) return;
      if (!groups.has(key)) groups.set(key, { codigo: r.centroCusto, descricao: r.descricaoCCusto, orcado: 0, realizado: 0 });
      const g = groups.get(key)!;
      if (r.base === 'ORÇ26') {
        if (isMensal) { if (r.mes === mesSelecionado) g.orcado += r.executado; }
        else if (mesesComReal.includes(r.mes)) g.orcado += r.executado;
      }
      if (r.base === 'REAL26') {
        if (isMensal) { if (r.mes === mesSelecionado) g.realizado += r.executado; }
        else g.realizado += r.executado;
      }
    });
    return Array.from(groups.values()).map(g => ({
      codigo: g.codigo, descricao: g.descricao, nome: `${g.codigo} - ${g.descricao}`,
      orcado: g.orcado, realizado: g.realizado,
      variacao: g.realizado - g.orcado,
      variacaoPercent: g.orcado !== 0 ? ((g.realizado - g.orcado) / g.orcado) * 100 : 0,
      semaforo: getSemaforo(g.realizado, g.orcado),
    })).sort((a, b) => b.orcado - a.orcado);
  }, [filteredRecords, selectedDiretoria, selectedArea, isMensal, mesSelecionado, mesesComReal]);

  // Level 4: CC drill-down
  const ccRecords = selectedCC ? filteredRecords.filter(r => r.centroCusto === selectedCC) : [];
  const ccPacoteData = selectedCC ? groupBy(ccRecords, 'pacote', mesesComReal, periodoView, mesSelecionado).filter(d => d.orcado > 0 || d.realizado > 0) : [];
  const ccRecursoData = selectedCC ? groupBy(ccRecords, 'recurso', mesesComReal, periodoView, mesSelecionado).filter(d => d.orcado > 0 || d.realizado > 0) : [];
  const ccTop5 = ccRecursoData.slice(0, 5);
  const ccTotal = ccRecursoData.reduce((s, r) => s + (r.realizado || r.orcado), 0);
  const ccDescricao = ccRecords[0]?.descricaoCCusto || '';

  const ccColumns: ColumnDef[] = [
    { key: 'codigo', label: 'Código', align: 'left' },
    { key: 'descricao', label: 'Descrição', align: 'left' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação R$', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
    { key: 'semaforo', label: 'Status', align: 'center', sortable: false, render: (v) => <SemaforoIcon status={v} /> },
  ];

  const recursoColumns: ColumnDef[] = [
    { key: 'nome', label: 'Recurso', align: 'left' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
  ];

  const openDetail = (recursoNome: string) => {
    const recs = ccRecords.filter(r => r.recurso === recursoNome);
    setDetailModal({ open: true, records: recs, title: `${selectedCC} → ${recursoNome}` });
  };

  // Determine which level to show
  const showLevel1 = isCEO && !selectedDiretoria;
  const showLevel2 = selectedDiretoria && !selectedArea && !isArea;
  const showLevel3 = selectedArea && !selectedCC;
  const showLevel4 = !!selectedCC;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Centro de Custo</h1>
        <p className="text-sm text-muted-foreground">Consulte centros de custo por busca ou navegação hierárquica</p>
      </div>

      {/* Search */}
      <div ref={searchRef} className="relative max-w-md">
        <div className="flex items-center gap-2 glass-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Digite o código do CC (ex: 600048) ou descrição"
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
          onClick={() => { setSelectedDiretoria(isCEO ? null : selectedDiretoria); setSelectedArea(isArea ? selectedArea : null); setSelectedCC(null); }}
          className="text-primary hover:underline"
        >
          Centro de Custo
        </button>
        {selectedDiretoria && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button
              onClick={() => { setSelectedArea(isArea ? selectedArea : null); setSelectedCC(null); }}
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
            <span className="text-foreground">{selectedCC} - {ccDescricao}</span>
          </>
        )}
      </div>

      {/* Level 1: Diretorias */}
      {showLevel1 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {diretoriasData.map(d => (
            <button key={d.nome} onClick={() => setSelectedDiretoria(d.nome)} className="glass-card p-4 text-left hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{d.nome}</span>
                </div>
                <span className="text-xs text-muted-foreground">{d.qtdCCs} CCs</span>
              </div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-muted-foreground">Orçado: <span className="font-mono">{formatCompact(d.orcado)}</span></span>
                <span className="text-muted-foreground">Real: <span className="font-mono">{formatCompact(d.realizado)}</span></span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${d.semaforo === 'green' ? 'bg-success' : d.semaforo === 'yellow' ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${Math.min((d.realizado / (d.orcado || 1)) * 100, 100)}%` }} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Level 2: Áreas */}
      {showLevel2 && (
        <div className="space-y-2">
          {areasData.map(a => (
            <button key={a.nome} onClick={() => setSelectedArea(a.nome)} className="glass-card p-4 w-full text-left hover:border-primary/50 transition-all flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm">{a.nome}</span>
                {a.responsavel && <span className="text-xs text-muted-foreground ml-2">({a.responsavel})</span>}
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted-foreground">{a.qtdCCs} CCs</span>
                <SemaforoIcon status={a.semaforo} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Level 3: CCs da Área */}
      {showLevel3 && (
        <div>
          <div className="px-1 py-2">
            <h3 className="text-sm font-semibold">Centros de Custo — {selectedArea} ({ccData.length})</h3>
          </div>
          <SortableTable
            columns={ccColumns}
            data={ccData}
            onRowClick={(row) => setSelectedCC(row.codigo)}
            exportFilename={`centros-custo-${selectedArea}.csv`}
          />
        </div>
      )}

      {/* Level 4: CC drill-down */}
      {showLevel4 && (
        <div className="space-y-6">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Composição por Pacote — {selectedCC} - {ccDescricao}</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, ccPacoteData.length * 40)}>
              <BarChart data={ccPacoteData} layout="vertical" margin={{ left: marginLeft }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis type="number" tick={{ fill: colors.axis, fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="nome" tick={{ fill: colors.axis, fontSize: 10 }} width={marginLeft - 5} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="orcado" name="Orçado" fill={colors.orcado} opacity={0.4} />
                <Bar dataKey="realizado" name="Realizado" fill={colors.realizado} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Top 5 Maiores Custos</h3>
            <SortableTable
              columns={[
                { key: '_rank', label: '#', align: 'center', sortable: false, render: (_, __, i) => <span className="text-primary font-bold">#{i! + 1}</span> },
                { key: 'nome', label: 'Recurso', align: 'left' },
                { key: '_valor', label: 'Valor', align: 'right', format: 'currency', render: (_, row) => formatCurrency(row.realizado || row.orcado) },
                { key: '_pct', label: '% Total', align: 'right', render: (_, row) => `${ccTotal > 0 ? ((row.realizado || row.orcado) / ccTotal * 100).toFixed(1) : 0}%` },
                { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
                { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
                { key: 'variacao', label: 'Variação', align: 'right', format: 'currency' },
              ]}
              data={ccTop5}
              highlightTop={5}
              onRowClick={(row) => openDetail(row.nome)}
            />
          </div>

          <div>
            <div className="px-1 py-2"><h3 className="text-sm font-semibold">Detalhamento por Recurso</h3></div>
            <SortableTable
              columns={recursoColumns}
              data={ccRecursoData}
              onRowClick={(row) => openDetail(row.nome)}
              exportFilename={`recursos-${selectedCC}.csv`}
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
