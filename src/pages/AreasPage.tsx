import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOPEX } from '@/contexts/OPEXContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { groupBy, getMesesComReal, formatCurrency, formatPercent, getSemaforo } from '@/lib/opex-utils';
import { computeTotals } from '@/lib/totals-helper';
import { MESES_PT } from '@/types/opex';
import { Building2, ChevronRight } from 'lucide-react';
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

export default function AreasPage() {
  const { filteredRecords, periodoView, mesSelecionado, origemFilter, records } = useOPEX();
  const { isCEO, isDiretoria, isArea, session } = useAuth();
  const { theme } = useTheme();
  const colors = getChartColors(theme);
  const isMobile = useIsMobile();

  const [selectedDiretoria, setSelectedDiretoria] = useState<string | null>(
    isDiretoria || isArea ? session?.diretoria || null : null
  );
  const [selectedArea, setSelectedArea] = useState<string | null>(
    isArea ? session?.area || null : null
  );
  const [selectedCC, setSelectedCC] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<{ open: boolean; records: any[]; title: string }>({ open: false, records: [], title: '' });
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const highlightParam = searchParams.get('highlight');
    const typeParam = searchParams.get('type');
    if (highlightParam && typeParam && filteredRecords.length > 0) {
      if (typeParam === 'Área') {
        const areaRecord = filteredRecords.find(r => r.areaGrupo1 === highlightParam);
        if (areaRecord) {
          setSelectedDiretoria(areaRecord.diretoria);
          setSelectedArea(highlightParam);
          setSelectedCC(null);
        }
      } else if (typeParam === 'Recurso') {
        const recursoRecord = filteredRecords.find(r => r.recurso === highlightParam);
        if (recursoRecord) {
          setSelectedDiretoria(recursoRecord.diretoria);
          setSelectedArea(recursoRecord.areaGrupo1);
          setSelectedCC(null);
          const recs = filteredRecords.filter(r => r.recurso === highlightParam);
          setDetailModal({ open: true, records: recs, title: `Recurso: ${highlightParam}` });
        }
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, filteredRecords]);

  const mesesComReal = getMesesComReal(filteredRecords);
  const diretoriaData = groupBy(filteredRecords, 'diretoria', mesesComReal, periodoView, mesSelecionado);

  const areaRecords = selectedDiretoria ? filteredRecords.filter(r => r.diretoria === selectedDiretoria) : [];
  const areaData = selectedDiretoria ? groupBy(areaRecords, 'areaGrupo1', mesesComReal, periodoView, mesSelecionado) : [];

  const drillRecords = selectedArea ? areaRecords.filter(r => r.areaGrupo1 === selectedArea) : [];
  const pacoteData = selectedArea ? groupBy(drillRecords, 'pacote', mesesComReal, periodoView, mesSelecionado).filter(d => d.orcado !== 0 || d.realizado !== 0) : [];
  const recursoData = selectedArea && !selectedCC ? groupBy(drillRecords, 'recurso', mesesComReal, periodoView, mesSelecionado).filter(d => d.orcado !== 0 || d.realizado !== 0) : [];

  // Centro de Custo data
  const ccData = selectedArea ? (() => {
    const groups = new Map<string, { codigo: string; descricao: string; orcado: number; realizado: number }>();
    drillRecords.forEach(r => {
      const key = r.centroCusto;
      if (!key) return;
      if (!groups.has(key)) {
        groups.set(key, { codigo: r.centroCusto, descricao: r.descricaoCCusto, orcado: 0, realizado: 0 });
      }
      const g = groups.get(key)!;
      if (r.base === 'ORÇ26') {
        if (periodoView === 'mensal' && mesSelecionado) {
          if (r.mes === mesSelecionado) g.orcado += r.executado;
        } else if (mesesComReal.includes(r.mes)) {
          g.orcado += r.executado;
        }
      }
      if (r.base === 'REAL26') {
        if (periodoView === 'mensal' && mesSelecionado) {
          if (r.mes === mesSelecionado) g.realizado += r.executado;
        } else {
          g.realizado += r.executado;
        }
      }
    });
    return Array.from(groups.values()).map(g => ({
      nome: `${g.codigo} - ${g.descricao}`,
      codigo: g.codigo,
      descricao: g.descricao,
      orcado: g.orcado,
      realizado: g.realizado,
      variacao: g.realizado - g.orcado,
      variacaoPercent: g.orcado !== 0 ? ((g.realizado - g.orcado) / g.orcado) * 100 : 0,
      semaforo: getSemaforo(g.realizado, g.orcado),
    })).sort((a, b) => b.orcado - a.orcado);
  })() : [];

  // Total CCs for the area without classification filter — for auto-skip logic
  const totalCCsArea = selectedArea ? new Set(
    records.filter(r => r.areaGrupo1 === selectedArea).map(r => r.centroCusto).filter(Boolean)
  ).size : 0;

  // Level 4: CC drill-down data
  const ccRecords = selectedCC ? drillRecords.filter(r => r.centroCusto === selectedCC) : [];
  const ccPacoteData = selectedCC ? groupBy(ccRecords, 'pacote', mesesComReal, periodoView, mesSelecionado).filter(d => d.orcado !== 0 || d.realizado !== 0) : [];
  const ccRecursoData = selectedCC ? groupBy(ccRecords, 'recurso', mesesComReal, periodoView, mesSelecionado).filter(d => d.orcado !== 0 || d.realizado !== 0) : [];
  const ccTop5 = ccRecursoData.slice(0, 5);
  const ccTotal = ccRecursoData.reduce((s, r) => s + (r.realizado || r.orcado), 0);
  const ccDescricao = ccRecords[0]?.descricaoCCusto || '';

  const isMensal = periodoView === 'mensal' && mesSelecionado;
  const orcLabel = isMensal ? `Orçado ${MESES_PT[mesSelecionado! - 1]}` : 'Orçado YTD';
  const realLabel = isMensal ? `Realizado ${MESES_PT[mesSelecionado! - 1]}` : 'Realizado YTD';

  const pageTitle = isCEO ? 'Por Diretoria / Área' : isDiretoria ? 'Minhas Áreas' : 'Minha Área';
  const marginLeft = isMobile ? 100 : 180;

  // Navigation handlers
  const handleBackToDiretorias = () => { setSelectedDiretoria(null); setSelectedArea(null); setSelectedCC(null); };
  const handleBackToAreas = () => { setSelectedArea(null); setSelectedCC(null); };
  const handleBackToArea = () => { setSelectedCC(null); };
  const handleSelectArea = (areaNome: string) => { setSelectedArea(areaNome); setSelectedCC(null); };

  const areaColumns: ColumnDef[] = [
    { key: 'nome', label: 'Área', align: 'left' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação R$', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
    { key: 'semaforo', label: 'Status', align: 'center', sortable: false, render: (v) => <SemaforoIcon status={v} /> },
    { key: '_exec', label: 'Execução', align: 'right', sortable: false, render: (_, row) => {
      const pct = row.orcado ? (row.realizado / row.orcado) * 100 : 0;
      return (
        <div className="flex items-center gap-2 justify-end">
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${row.semaforo === 'green' ? 'bg-success' : row.semaforo === 'yellow' ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <span className="text-xs text-muted-foreground font-mono w-10 text-right">{row.orcado ? `${pct.toFixed(0)}%` : '—'}</span>
        </div>
      );
    }},
  ];

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

  const openDetail = (recursoNome: string, sourceRecords: any[]) => {
    const recs = sourceRecords.filter(r => r.recurso === recursoNome);
    const prefix = selectedCC ? `${selectedCC} → ${recursoNome}` : `${selectedArea} → ${recursoNome}`;
    setDetailModal({ open: true, records: recs, title: prefix });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground">Navegue pela hierarquia organizacional</p>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        {isCEO && (
          <button onClick={handleBackToDiretorias} className="text-primary hover:underline">Diretorias</button>
        )}
        {!isCEO && selectedDiretoria && (
          <span className="text-muted-foreground">Diretoria: {selectedDiretoria}</span>
        )}
        {isCEO && selectedDiretoria && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button onClick={handleBackToAreas} className="text-primary hover:underline">Diretoria: {selectedDiretoria}</button>
          </>
        )}
        {isDiretoria && selectedArea && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button onClick={handleBackToAreas} className="text-primary hover:underline">Áreas</button>
          </>
        )}
        {selectedArea && !selectedCC && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground">Área: {selectedArea}</span>
          </>
        )}
        {selectedArea && selectedCC && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button onClick={handleBackToArea} className="text-primary hover:underline">Área: {selectedArea}</button>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground">CC: {selectedCC} - {ccDescricao}</span>
          </>
        )}
      </div>

      {/* Level 1: Diretorias — CEO only */}
      {isCEO && !selectedDiretoria && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {diretoriaData.map(d => (
            <button key={d.nome} onClick={() => setSelectedDiretoria(d.nome)} className="glass-card p-5 text-left hover:border-primary/50 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{d.nome}</span>
                </div>
                <SemaforoIcon status={d.semaforo} />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">{orcLabel}</span><span className="font-mono">{formatCurrency(d.orcado)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{realLabel}</span><span className="font-mono">{formatCurrency(d.realizado)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Variação</span>
                  <span className={`font-mono font-medium ${d.variacao > 0 ? 'text-destructive' : 'text-success'}`}>{formatPercent(d.variacaoPercent)}</span>
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${d.semaforo === 'green' ? 'bg-success' : d.semaforo === 'yellow' ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${Math.min((d.realizado / (d.orcado || 1)) * 100, 100)}%` }} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Level 2: Áreas table */}
      {selectedDiretoria && !selectedArea && (isCEO || isDiretoria) && (
        <SortableTable
          columns={areaColumns}
          data={areaData}
          onRowClick={(row) => handleSelectArea(row.nome)}
          exportFilename={`areas-${selectedDiretoria}.csv`}
          totalsRow={computeTotals(areaData, ['orcado', 'realizado', 'variacao', 'variacaoPercent'])}
        />
      )}

      {/* Level 3: Area drill-down (no CC selected) */}
      {selectedArea && !selectedCC && (
        <div className="space-y-6">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Composição por Pacote — {selectedArea}</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, pacoteData.length * 40)}>
              <BarChart data={pacoteData} layout="vertical" margin={{ left: marginLeft }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis type="number" tick={{ fill: colors.axis, fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="nome" tick={{ fill: colors.axis, fontSize: 10 }} width={marginLeft - 5} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="orcado" name="Orçado" fill={colors.orcado} opacity={0.4} />
                <Bar dataKey="realizado" name="Realizado" fill={colors.realizado} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* CC table — show if multiple CCs total, or if classification filter is active */}
          {ccData.length >= 1 && (totalCCsArea > 1 || origemFilter !== 'all') && (
            <div>
              <div className="px-1 py-2">
                <h3 className="text-sm font-semibold">Centros de Custo ({ccData.length})</h3>
              </div>
              <SortableTable
                columns={ccColumns}
                data={ccData}
                onRowClick={(row) => setSelectedCC(row.codigo)}
                exportFilename={`centros-custo-${selectedArea}.csv`}
                totalsRow={computeTotals(ccData, ['orcado', 'realizado', 'variacao', 'variacaoPercent'])}
              />
            </div>
          )}

          <div>
            <div className="px-1 py-2"><h3 className="text-sm font-semibold">Detalhamento por Recurso</h3></div>
            <SortableTable
              columns={recursoColumns}
              data={recursoData}
              onRowClick={(row) => openDetail(row.nome, drillRecords)}
              exportFilename={`recursos-${selectedArea}.csv`}
              totalsRow={computeTotals(recursoData, ['orcado', 'realizado', 'variacao', 'variacaoPercent'])}
            />
          </div>
        </div>
      )}

      {/* Level 4: CC drill-down */}
      {selectedCC && (
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

          <div>
            <div className="px-1 py-2"><h3 className="text-sm font-semibold">Detalhamento por Recurso</h3></div>
            <SortableTable
              columns={recursoColumns}
              data={ccRecursoData}
              onRowClick={(row) => openDetail(row.nome, ccRecords)}
              exportFilename={`recursos-${selectedCC}.csv`}
              totalsRow={computeTotals(ccRecursoData, ['orcado', 'realizado', 'variacao', 'variacaoPercent'])}
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
