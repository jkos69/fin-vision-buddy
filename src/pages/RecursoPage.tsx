import { useState, useEffect, useMemo, useRef } from 'react';
import { useOPEX } from '@/contexts/OPEXContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getMesesComReal, formatCurrency, formatCompact, getSemaforo } from '@/lib/opex-utils';
import { computeTotals } from '@/lib/totals-helper';
import { MESES_PT } from '@/types/opex';
import { Boxes, ChevronRight, Search } from 'lucide-react';
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

export default function RecursoPage() {
  const { filteredRecords, periodoView, mesSelecionado } = useOPEX();
  const { theme } = useTheme();
  const colors = getChartColors(theme);
  const isMobile = useIsMobile();
  const marginLeft = isMobile ? 100 : 200;

  const [selectedRecurso, setSelectedRecurso] = useState<string | null>(null);
  const [selectedDiretoria, setSelectedDiretoria] = useState<string | null>(null);
  const [selectedCC, setSelectedCC] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'diretoria' | 'todosCCs'>('diretoria');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [detailModal, setDetailModal] = useState<{ open: boolean; records: any[]; title: string }>({ open: false, records: [], title: '' });
  const searchRef = useRef<HTMLDivElement>(null);

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

  const accumulate = (recs: typeof filteredRecords) => {
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

  // Level 1: Recursos (aggregated across whole filtered set)
  const recursosData = useMemo(() => {
    const groups = new Map<string, { orcado: number; realizado: number; ccs: Set<string>; dirs: Set<string> }>();
    filteredRecords.forEach(r => {
      const key = r.recurso || '(sem recurso)';
      if (!groups.has(key)) groups.set(key, { orcado: 0, realizado: 0, ccs: new Set(), dirs: new Set() });
      const g = groups.get(key)!;
      if (r.centroCusto) g.ccs.add(r.centroCusto);
      if (r.diretoria) g.dirs.add(r.diretoria);
      if (r.base === 'ORÇ26') {
        if (isMensal) { if (r.mes === mesSelecionado) g.orcado += r.executado; }
        else if (mesesComReal.includes(r.mes)) g.orcado += r.executado;
      }
      if (r.base === 'REAL26') {
        if (isMensal) { if (r.mes === mesSelecionado) g.realizado += r.executado; }
        else g.realizado += r.executado;
      }
    });
    return Array.from(groups.entries())
      .map(([nome, g]) => ({
        nome,
        orcado: g.orcado,
        realizado: g.realizado,
        variacao: g.realizado - g.orcado,
        variacaoPercent: g.orcado !== 0 ? ((g.realizado - g.orcado) / g.orcado) * 100 : 0,
        qtdCCs: g.ccs.size,
        qtdDirs: g.dirs.size,
        semaforo: getSemaforo(g.realizado, g.orcado),
      }))
      .filter(d => d.orcado !== 0 || d.realizado !== 0)
      .sort((a, b) => Math.abs(b.realizado || b.orcado) - Math.abs(a.realizado || a.orcado));
  }, [filteredRecords, isMensal, mesSelecionado, mesesComReal]);

  // Search results — by recurso name
  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const q = searchQuery.toUpperCase();
    return recursosData.filter(r => r.nome.toUpperCase().includes(q)).slice(0, 10);
  }, [searchQuery, recursosData]);

  // Level 2: Diretorias for selected Recurso
  const diretoriasData = useMemo(() => {
    if (!selectedRecurso) return [];
    const recursoRecs = filteredRecords.filter(r => (r.recurso || '(sem recurso)') === selectedRecurso);
    const groups = new Map<string, { orcado: number; realizado: number; ccs: Set<string> }>();
    recursoRecs.forEach(r => {
      const key = r.diretoria || '(sem diretoria)';
      if (!groups.has(key)) groups.set(key, { orcado: 0, realizado: 0, ccs: new Set() });
      const g = groups.get(key)!;
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
    return Array.from(groups.entries())
      .map(([nome, g]) => ({
        nome, orcado: g.orcado, realizado: g.realizado,
        variacao: g.realizado - g.orcado,
        variacaoPercent: g.orcado !== 0 ? ((g.realizado - g.orcado) / g.orcado) * 100 : 0,
        qtdCCs: g.ccs.size,
        semaforo: getSemaforo(g.realizado, g.orcado),
      }))
      .filter(d => d.orcado !== 0 || d.realizado !== 0)
      .sort((a, b) => Math.abs(b.realizado || b.orcado) - Math.abs(a.realizado || a.orcado));
  }, [filteredRecords, selectedRecurso, isMensal, mesSelecionado, mesesComReal]);

  // Level 3: CCs for selected Recurso + Diretoria
  const ccData = useMemo(() => {
    if (!selectedRecurso || !selectedDiretoria) return [];
    const recs = filteredRecords.filter(r =>
      (r.recurso || '(sem recurso)') === selectedRecurso &&
      (r.diretoria || '(sem diretoria)') === selectedDiretoria
    );
    const groups = new Map<string, { codigo: string; descricao: string; area: string; orcado: number; realizado: number }>();
    recs.forEach(r => {
      const key = r.centroCusto || '(sem CC)';
      if (!groups.has(key)) groups.set(key, { codigo: r.centroCusto, descricao: r.descricaoCCusto, area: r.areaGrupo1, orcado: 0, realizado: 0 });
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
    return Array.from(groups.values())
      .map(g => ({
        codigo: g.codigo, descricao: g.descricao, area: g.area,
        nome: `${g.codigo} - ${g.descricao}`,
        orcado: g.orcado, realizado: g.realizado,
        variacao: g.realizado - g.orcado,
        variacaoPercent: g.orcado !== 0 ? ((g.realizado - g.orcado) / g.orcado) * 100 : 0,
        semaforo: getSemaforo(g.realizado, g.orcado),
      }))
      .filter(d => d.orcado !== 0 || d.realizado !== 0)
      .sort((a, b) => Math.abs(b.realizado || b.orcado) - Math.abs(a.realizado || a.orcado));
  }, [filteredRecords, selectedRecurso, selectedDiretoria, isMensal, mesSelecionado, mesesComReal]);

  // Flat view: ALL CCs that use the selected Recurso (across all Diretorias)
  const allCCsData = useMemo(() => {
    if (!selectedRecurso) return [];
    const recs = filteredRecords.filter(r => (r.recurso || '(sem recurso)') === selectedRecurso);
    const groups = new Map<string, { codigo: string; descricao: string; area: string; diretoria: string; orcado: number; realizado: number }>();
    recs.forEach(r => {
      const key = r.centroCusto || '(sem CC)';
      if (!groups.has(key)) groups.set(key, { codigo: r.centroCusto, descricao: r.descricaoCCusto, area: r.areaGrupo1, diretoria: r.diretoria, orcado: 0, realizado: 0 });
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
    return Array.from(groups.values())
      .map(g => ({
        codigo: g.codigo, descricao: g.descricao, area: g.area, diretoria: g.diretoria,
        nome: `${g.codigo} - ${g.descricao}`,
        orcado: g.orcado, realizado: g.realizado,
        variacao: g.realizado - g.orcado,
        variacaoPercent: g.orcado !== 0 ? ((g.realizado - g.orcado) / g.orcado) * 100 : 0,
        semaforo: getSemaforo(g.realizado, g.orcado),
      }))
      .filter(d => d.orcado !== 0 || d.realizado !== 0)
      .sort((a, b) => Math.abs(b.realizado || b.orcado) - Math.abs(a.realizado || a.orcado));
  }, [filteredRecords, selectedRecurso, isMensal, mesSelecionado, mesesComReal]);

  const recursoTotals = selectedRecurso ? accumulate(filteredRecords.filter(r => (r.recurso || '(sem recurso)') === selectedRecurso)) : { orcado: 0, realizado: 0 };

  const recursoColumns: ColumnDef[] = [
    { key: 'nome', label: 'Recurso', align: 'left' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação R$', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
    { key: 'qtdDirs', label: 'Diretorias', align: 'right', format: 'number' },
    { key: 'qtdCCs', label: 'CCs', align: 'right', format: 'number' },
    { key: 'semaforo', label: 'Status', align: 'center', sortable: false, render: (v) => <SemaforoIcon status={v} /> },
  ];

  const diretoriaColumns: ColumnDef[] = [
    { key: 'nome', label: 'Diretoria', align: 'left' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação R$', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
    { key: 'qtdCCs', label: 'CCs', align: 'right', format: 'number' },
    { key: 'semaforo', label: 'Status', align: 'center', sortable: false, render: (v) => <SemaforoIcon status={v} /> },
  ];

  const ccColumns: ColumnDef[] = [
    { key: 'codigo', label: 'Código', align: 'left' },
    { key: 'descricao', label: 'Descrição', align: 'left' },
    { key: 'area', label: 'Área', align: 'left' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação R$', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
    { key: 'semaforo', label: 'Status', align: 'center', sortable: false, render: (v) => <SemaforoIcon status={v} /> },
  ];

  const allCCsColumns: ColumnDef[] = [
    { key: 'codigo', label: 'Código', align: 'left' },
    { key: 'descricao', label: 'Descrição', align: 'left' },
    { key: 'diretoria', label: 'Diretoria', align: 'left' },
    { key: 'area', label: 'Área', align: 'left' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação R$', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
    { key: 'semaforo', label: 'Status', align: 'center', sortable: false, render: (v) => <SemaforoIcon status={v} /> },
  ];

  const openCCDetail = (codigo: string) => {
    const recs = filteredRecords.filter(r =>
      r.centroCusto === codigo &&
      (r.recurso || '(sem recurso)') === selectedRecurso
    );
    setDetailModal({ open: true, records: recs, title: `${selectedRecurso} → ${codigo}` });
  };

  const handleSearchSelect = (nome: string) => {
    setSelectedRecurso(nome);
    setSelectedDiretoria(null);
    setSelectedCC(null);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const showLevel1 = !selectedRecurso;
  const showLevel2 = selectedRecurso && !selectedDiretoria;
  const showLevel3 = selectedRecurso && selectedDiretoria;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Por Recurso</h1>
        <p className="text-sm text-muted-foreground">Consulte gastos por recurso, navegando por Diretoria e Centro de Custo</p>
      </div>

      {/* Search */}
      <div ref={searchRef} className="relative max-w-md">
        <div className="flex items-center gap-2 glass-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Digite o nome do recurso (ex: ENERGIA, FRETE)"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-64 overflow-y-auto">
            {searchResults.map(r => (
              <button
                key={r.nome}
                onClick={() => handleSearchSelect(r.nome)}
                className="flex flex-col w-full px-3 py-2 text-left hover:bg-accent transition-colors border-b border-border/50 last:border-0"
              >
                <span className="text-sm font-medium">{r.nome}</span>
                <span className="text-xs text-muted-foreground">{r.qtdDirs} diretorias · {r.qtdCCs} CCs · Real {formatCompact(r.realizado)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <button
          onClick={() => { setSelectedRecurso(null); setSelectedDiretoria(null); setSelectedCC(null); }}
          className="text-primary hover:underline"
        >
          Recursos
        </button>
        {selectedRecurso && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button
              onClick={() => { setSelectedDiretoria(null); setSelectedCC(null); }}
              className={selectedDiretoria ? 'text-primary hover:underline' : 'text-foreground'}
            >
              {selectedRecurso}
            </button>
          </>
        )}
        {selectedDiretoria && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground">{selectedDiretoria}</span>
          </>
        )}
      </div>

      {/* Level 1: All resources */}
      {showLevel1 && (
        <div className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Boxes className="h-4 w-4 text-primary" />
              Top 10 Recursos por Realizado
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(220, Math.min(recursosData.length, 10) * 36)}>
              <BarChart data={recursosData.slice(0, 10)} layout="vertical" margin={{ left: marginLeft }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis type="number" tick={{ fill: colors.axis, fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="nome" tick={{ fill: colors.axis, fontSize: 10 }} width={marginLeft - 5} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="orcado" name="Orçado" fill={colors.orcado} opacity={0.4} />
                <Bar dataKey="realizado" name="Realizado" fill={colors.realizado} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <div className="px-1 py-2">
              <h3 className="text-sm font-semibold">Todos os Recursos ({recursosData.length})</h3>
            </div>
            <SortableTable
              columns={recursoColumns}
              data={recursosData}
              onRowClick={(row) => setSelectedRecurso(row.nome)}
              exportFilename="recursos.csv"
              totalsRow={computeTotals(recursosData, ['orcado', 'realizado', 'variacao', 'variacaoPercent', 'qtdCCs', 'qtdDirs'])}
            />
          </div>
        </div>
      )}

      {/* Level 2: Diretorias for selected Recurso */}
      {showLevel2 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground">{orcLabel}</p>
              <p className="text-lg font-semibold font-mono">{formatCurrency(recursoTotals.orcado)}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground">{realLabel}</p>
              <p className="text-lg font-semibold font-mono">{formatCurrency(recursoTotals.realizado)}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground">Variação</p>
              <p className={`text-lg font-semibold font-mono ${recursoTotals.realizado - recursoTotals.orcado > 0 ? 'text-destructive' : 'text-success'}`}>
                {formatCurrency(recursoTotals.realizado - recursoTotals.orcado)}
              </p>
            </div>
          </div>

          <div>
            <div className="px-1 py-2">
              <h3 className="text-sm font-semibold">Diretorias que usam {selectedRecurso} ({diretoriasData.length})</h3>
            </div>
            <SortableTable
              columns={diretoriaColumns}
              data={diretoriasData}
              onRowClick={(row) => setSelectedDiretoria(row.nome)}
              exportFilename={`recurso-${selectedRecurso}-diretorias.csv`}
              totalsRow={computeTotals(diretoriasData, ['orcado', 'realizado', 'variacao', 'variacaoPercent', 'qtdCCs'])}
            />
          </div>
        </div>
      )}

      {/* Level 3: CCs for selected Recurso + Diretoria */}
      {showLevel3 && (
        <div>
          <div className="px-1 py-2">
            <h3 className="text-sm font-semibold">
              Centros de Custo — {selectedRecurso} em {selectedDiretoria} ({ccData.length})
            </h3>
            <p className="text-xs text-muted-foreground">Clique numa linha para ver os lançamentos detalhados</p>
          </div>
          <SortableTable
            columns={ccColumns}
            data={ccData}
            onRowClick={(row) => openCCDetail(row.codigo)}
            exportFilename={`recurso-${selectedRecurso}-${selectedDiretoria}.csv`}
            totalsRow={computeTotals(ccData, ['orcado', 'realizado', 'variacao', 'variacaoPercent'])}
          />
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
