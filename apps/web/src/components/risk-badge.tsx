import type { DemoRisk } from '@/lib/demo-data';
import { cn } from '@/lib/utils';

const riskStyles: Record<DemoRisk, string> = {
  baixo: 'border-success/30 bg-success/10 text-success',
  medio: 'border-warning/30 bg-warning/10 text-warning',
  alto: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export function RiskBadge({ risk, className }: { risk: DemoRisk; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium capitalize', riskStyles[risk], className)}>
      Risco {risk}
    </span>
  );
}
