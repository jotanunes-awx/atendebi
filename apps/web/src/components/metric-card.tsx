import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MetricCardTone = 'neutral' | 'good' | 'success' | 'warning' | 'danger' | 'info';

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  tone: MetricCardTone;
  icon: LucideIcon;
  onClick?: () => void;
};

const toneStyles = {
  neutral: 'border-border bg-card text-card-foreground',
  good: 'border-success/25 bg-success/10 text-card-foreground',
  success: 'border-success/25 bg-success/10 text-card-foreground',
  warning: 'border-warning/30 bg-warning/10 text-card-foreground',
  danger: 'border-destructive/25 bg-destructive/10 text-card-foreground',
  info: 'border-info/25 bg-info/10 text-card-foreground',
};

const iconStyles = {
  neutral: 'border-border bg-secondary text-muted-foreground',
  good: 'border-success/25 bg-success/15 text-success',
  success: 'border-success/25 bg-success/15 text-success',
  warning: 'border-warning/30 bg-warning/15 text-warning',
  danger: 'border-destructive/25 bg-destructive/15 text-destructive',
  info: 'border-info/25 bg-info/15 text-info',
};

export function MetricCard({ label, value, detail, tone, icon: Icon, onClick }: MetricCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-card-foreground">{value}</p>
        </div>
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md border', iconStyles[tone])}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{detail}</p>
      {onClick ? <p className="mt-4 text-xs font-semibold text-primary">Ver detalhes</p> : null}
    </>
  );

  const className = cn(
    'rounded-lg border p-4 shadow-panel transition-colors',
    toneStyles[tone],
    onClick && 'w-full cursor-pointer text-left hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <section className={className}>{content}</section>;
}
