/**
 * Compute a totals row from an array of data objects.
 * variacaoPercent is recalculated from total orcado/realizado (not averaged).
 */
export function computeTotals(
  data: Record<string, any>[],
  sumKeys: string[],
  opts?: { orcadoKey?: string; realizadoKey?: string; varPercentKey?: string }
): Record<string, any> {
  const orcKey = opts?.orcadoKey || 'orcado';
  const realKey = opts?.realizadoKey || 'realizado';
  const varPctKey = opts?.varPercentKey || 'variacaoPercent';

  const totals: Record<string, any> = {};
  for (const key of sumKeys) {
    totals[key] = data.reduce((s, r) => s + (Number(r[key]) || 0), 0);
  }
  // Recalculate variation percent from totals
  if (sumKeys.includes(varPctKey) && totals[orcKey] !== undefined) {
    const totalOrc = totals[orcKey];
    const totalReal = totals[realKey];
    totals[varPctKey] = totalOrc !== 0 ? ((totalReal - totalOrc) / totalOrc) * 100 : 0;
  }
  return totals;
}
