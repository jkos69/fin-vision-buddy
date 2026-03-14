import { MESES_PT, type GroupedData, type MonthlyData, type OPEXRecord, type SummaryData } from '@/types/opex';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
  return formatCurrency(value);
}

export function getMesesComReal(records: OPEXRecord[]): number[] {
  const meses = new Set<number>();
  records.forEach(r => { if (r.base === 'REAL26') meses.add(r.mes); });
  return Array.from(meses).sort((a, b) => a - b);
}

export function getSummary(
  records: OPEXRecord[],
  periodoView: 'ytd' | 'anual' | 'mensal' = 'ytd',
  mesSelecionado: number | null = null
): SummaryData {
  const mesesComReal = getMesesComReal(records);
  const orcadoAnual = records.filter(r => r.base === 'ORÇ26').reduce((s, r) => s + r.executado, 0);

  let orcadoRef: number;
  let realizadoRef: number;

  if (periodoView === 'mensal' && mesSelecionado) {
    orcadoRef = records.filter(r => r.base === 'ORÇ26' && r.mes === mesSelecionado).reduce((s, r) => s + r.executado, 0);
    realizadoRef = records.filter(r => r.base === 'REAL26' && r.mes === mesSelecionado).reduce((s, r) => s + r.executado, 0);
  } else if (periodoView === 'anual') {
    orcadoRef = orcadoAnual;
    realizadoRef = records.filter(r => r.base === 'REAL26').reduce((s, r) => s + r.executado, 0);
  } else {
    // YTD
    orcadoRef = records.filter(r => r.base === 'ORÇ26' && mesesComReal.includes(r.mes)).reduce((s, r) => s + r.executado, 0);
    realizadoRef = records.filter(r => r.base === 'REAL26').reduce((s, r) => s + r.executado, 0);
  }

  const variacao = realizadoRef - orcadoRef;
  const variacaoPercent = orcadoRef !== 0 ? (variacao / orcadoRef) * 100 : 0;
  const realizadoTotal = records.filter(r => r.base === 'REAL26').reduce((s, r) => s + r.executado, 0);
  const projecaoAnual = mesesComReal.length > 0 ? (realizadoTotal / mesesComReal.length) * 12 : 0;

  return { orcadoYTD: orcadoRef, realizadoYTD: realizadoRef, variacao, variacaoPercent, orcadoAnual, mesesComReal, projecaoAnual };
}

export function getMonthlyData(records: OPEXRecord[]): MonthlyData[] {
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const orcado = records.filter(r => r.base === 'ORÇ26' && r.mes === mes).reduce((s, r) => s + r.executado, 0);
    const realizado = records.filter(r => r.base === 'REAL26' && r.mes === mes).reduce((s, r) => s + r.executado, 0);
    const variacao = realizado - orcado;
    const variacaoPercent = orcado !== 0 ? (variacao / orcado) * 100 : 0;
    return { mes, mesNome: MESES_PT[i], orcado, realizado, variacao, variacaoPercent };
  });
}

export function getSemaforo(realizado: number, orcado: number): 'green' | 'yellow' | 'red' {
  if (orcado === 0) return 'green';
  const ratio = realizado / orcado;
  if (ratio < 0.95) return 'green';
  if (ratio <= 1.05) return 'yellow';
  return 'red';
}

export function getSemaforoAnual(realizado: number, orcadoAnual: number, mesesComReal: number[]): 'green' | 'yellow' | 'red' {
  if (orcadoAnual === 0 || mesesComReal.length === 0) return 'green';
  const proporcaoExecutada = realizado / orcadoAnual;
  const proporcaoEsperada = mesesComReal.length / 12;
  const diff = (proporcaoExecutada - proporcaoEsperada) * 100;
  if (diff > 5) return 'red';
  if (diff >= -5) return 'yellow';
  return 'green';
}

export function groupBy(
  records: OPEXRecord[],
  field: keyof OPEXRecord,
  mesesComReal: number[],
  periodoView: 'ytd' | 'anual' | 'mensal' = 'ytd',
  mesSelecionado: number | null = null
): GroupedData[] {
  const groups = new Map<string, { orcado: number; orcadoAnual: number; realizado: number }>();
  records.forEach(r => {
    const key = String(r[field]);
    if (!groups.has(key)) groups.set(key, { orcado: 0, orcadoAnual: 0, realizado: 0 });
    const g = groups.get(key)!;
    if (r.base === 'ORÇ26') {
      g.orcadoAnual += r.executado;
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

  return Array.from(groups.entries()).map(([nome, { orcado, orcadoAnual, realizado }]) => {
    const base = periodoView === 'anual' ? orcadoAnual : orcado;
    return {
      nome,
      orcado: base,
      realizado,
      variacao: realizado - base,
      variacaoPercent: base !== 0 ? ((realizado - base) / base) * 100 : 0,
      semaforo: periodoView === 'anual' ? getSemaforoAnual(realizado, orcadoAnual, mesesComReal) : getSemaforo(realizado, orcado),
    };
  }).sort((a, b) => b.orcado - a.orcado);
}

export function exportCSV(headers: string[], rows: string[][], filename: string) {
  const bom = '\uFEFF';
  const csv = bom + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
