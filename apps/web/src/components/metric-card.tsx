import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  tone: 'neutral' | 'good' | 'warning' | 'danger';
  icon: LucideIcon;
};

const toneStyles = {
  neutral: 'border-zinc-200 bg-white text-zinc-900',
  good: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  danger: 'border-rose-200 bg-rose-50 text-rose-950',
};

export function MetricCard({ label, value, detail, tone, icon: Icon }: MetricCardProps) {
  return (
    <section className={cn('rounded-lg border p-4 shadow-panel', toneStyles[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-600">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950">{value}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/70 bg-white/75">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-sm text-zinc-600">{detail}</p>
    </section>
  );
}
