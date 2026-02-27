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

export function getSummary(records: OPEXRecord[]): SummaryData {
  const mesesComReal = getMesesComReal(records);
  const orcadoAnual = records.filter(r => r.base === 'ORÇ26').reduce((s, r) => s + r.executado, 0);
  const orcadoYTD = records.filter(r => r.base === 'ORÇ26' && mesesComReal.includes(r.mes)).reduce((s, r) => s + r.executado, 0);
  const realizadoYTD = records.filter(r => r.base === 'REAL26').reduce((s, r) => s + r.executado, 0);
  const variacao = realizadoYTD - orcadoYTD;
  const variacaoPercent = orcadoYTD !== 0 ? (variacao / orcadoYTD) * 100 : 0;
  const projecaoAnual = mesesComReal.length > 0 ? (realizadoYTD / mesesComReal.length) * 12 : 0;

  return { orcadoYTD, realizadoYTD, variacao, variacaoPercent, orcadoAnual, mesesComReal, projecaoAnual };
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

export function groupBy(records: OPEXRecord[], field: keyof OPEXRecord, mesesComReal: number[]): GroupedData[] {
  const groups = new Map<string, { orcado: number; realizado: number }>();
  records.forEach(r => {
    const key = String(r[field]);
    if (!groups.has(key)) groups.set(key, { orcado: 0, realizado: 0 });
    const g = groups.get(key)!;
    if (r.base === 'ORÇ26' && mesesComReal.includes(r.mes)) g.orcado += r.executado;
    if (r.base === 'REAL26') g.realizado += r.executado;
  });

  return Array.from(groups.entries()).map(([nome, { orcado, realizado }]) => ({
    nome,
    orcado,
    realizado,
    variacao: realizado - orcado,
    variacaoPercent: orcado !== 0 ? ((realizado - orcado) / orcado) * 100 : 0,
    semaforo: getSemaforo(realizado, orcado),
  })).sort((a, b) => b.orcado - a.orcado);
}
