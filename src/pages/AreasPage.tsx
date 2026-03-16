import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOPEX } from '@/contexts/OPEXContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { groupBy, getMesesComReal, formatCurrency, formatPercent } from '@/lib/opex-utils';
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
  const { filteredRecords, periodoView, mesSelecionado } = useOPEX();
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
        }
      } else if (typeParam === 'Recurso') {
        const recursoRecord = filteredRecords.find(r => r.recurso === highlightParam);
        if (recursoRecord) {
          setSelectedDiretoria(recursoRecord.diretoria);
          setSelectedArea(recursoRecord.areaGrupo1);
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
  const pacoteData = selectedArea ? groupBy(drillRecords, 'pacote', mesesComReal, periodoView, mesSelecionado).filter(d => d.orcado > 0 || d.realizado > 0) : [];
  const recursoData = selectedArea ? groupBy(drillRecords, 'recurso', mesesComReal, periodoView, mesSelecionado).filter(d => d.orcado > 0 || d.realizado > 0) : [];
  const top5 = recursoData.slice(0, 5);
  const totalArea = recursoData.reduce((s, r) => s + (r.realizado || r.orcado), 0);

  const isMensal = periodoView === 'mensal' && mesSelecionado;
  const orcLabel = isMensal ? `Orçado ${MESES_PT[mesSelecionado! - 1]}` : 'Orçado YTD';
  const realLabel = isMensal ? `Realizado ${MESES_PT[mesSelecionado! - 1]}` : 'Realizado YTD';

  const pageTitle = isCEO ? 'Por Diretoria / Área' : isDiretoria ? 'Minhas Áreas' : 'Minha Área';
  const marginLeft = isMobile ? 100 : 180;

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

  const recursoColumns: ColumnDef[] = [
    { key: 'nome', label: 'Recurso', align: 'left' },
    { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
    { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
    { key: 'variacao', label: 'Variação', align: 'right', format: 'currency' },
    { key: 'variacaoPercent', label: 'Var %', align: 'right', format: 'percent' },
  ];

  const openDetail = (recursoNome: string) => {
    const recs = drillRecords.filter(r => r.recurso === recursoNome);
    setDetailModal({ open: true, records: recs, title: `${selectedArea} → ${recursoNome}` });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground">Navegue pela hierarquia organizacional</p>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        {isCEO && (
          <button onClick={() => { setSelectedDiretoria(null); setSelectedArea(null); }} className="text-primary hover:underline">Diretorias</button>
        )}
        {!isCEO && selectedDiretoria && (
          <span className="text-muted-foreground">Diretoria: {selectedDiretoria}</span>
        )}
        {isCEO && selectedDiretoria && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button onClick={() => setSelectedArea(null)} className="text-primary hover:underline">Diretoria: {selectedDiretoria}</button>
          </>
        )}
        {isDiretoria && selectedArea && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button onClick={() => setSelectedArea(null)} className="text-primary hover:underline">Áreas</button>
          </>
        )}
        {selectedArea && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground">Área: {selectedArea}</span>
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
          onRowClick={(row) => setSelectedArea(row.nome)}
          exportFilename={`areas-${selectedDiretoria}.csv`}
        />
      )}

      {/* Level 3: Drill-down */}
      {selectedArea && (
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

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4">Top 5 Maiores Custos (por Recurso)</h3>
            <SortableTable
              columns={[
                { key: '_rank', label: '#', align: 'center', sortable: false, render: (_, __, i) => <span className="text-primary font-bold">#{i+1}</span> },
                { key: 'nome', label: 'Recurso', align: 'left' },
                { key: '_valor', label: 'Valor', align: 'right', format: 'currency', render: (_, row) => formatCurrency(row.realizado || row.orcado) },
                { key: '_pct', label: '% Total', align: 'right', render: (_, row) => `${totalArea > 0 ? ((row.realizado || row.orcado) / totalArea * 100).toFixed(1) : 0}%` },
                { key: 'orcado', label: orcLabel, align: 'right', format: 'currency' },
                { key: 'realizado', label: realLabel, align: 'right', format: 'currency' },
                { key: 'variacao', label: 'Variação', align: 'right', format: 'currency' },
              ]}
              data={top5}
              highlightTop={5}
              onRowClick={(row) => openDetail(row.nome)}
            />
          </div>

          <div>
            <div className="px-1 py-2"><h3 className="text-sm font-semibold">Detalhamento por Recurso</h3></div>
            <SortableTable
              columns={recursoColumns}
              data={recursoData}
              onRowClick={(row) => openDetail(row.nome)}
              exportFilename={`recursos-${selectedArea}.csv`}
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
