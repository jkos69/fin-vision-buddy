import { formatCurrency, formatPercent } from '@/lib/opex-utils';

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

export function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload) return null;
  const orcItem = payload.find((p: any) => p.name?.toLowerCase().includes('orçado') || p.name?.toLowerCase().includes('orcado'));
  const realItem = payload.find((p: any) => p.name?.toLowerCase().includes('realizado'));
  const variacao = orcItem && realItem && (realItem.value > 0 || orcItem.value > 0) ? realItem.value - orcItem.value : null;

  return (
    <div className="glass-card p-3 text-xs space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value)}</p>
      ))}
      {variacao !== null && (
        <p className={`font-medium ${variacao > 0 ? 'text-destructive' : 'text-success'}`}>
          Variação: {formatCurrency(variacao)} ({orcItem.value ? formatPercent((variacao / orcItem.value) * 100) : '—'})
        </p>
      )}
    </div>
  );
}
