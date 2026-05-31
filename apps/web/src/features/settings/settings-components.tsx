import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MockUserRow } from './settings-data';

export function SectionTitle({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function ConfigField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('rounded-md border border-border bg-secondary px-3 py-2', className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-card-foreground">{value}</p>
    </div>
  );
}

export function HealthCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: 'success' | 'warning' | 'info' | 'neutral';
}) {
  const toneClass = {
    success: 'border-success/25 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    info: 'border-info/25 bg-info/10 text-info',
    neutral: 'border-border bg-secondary text-muted-foreground',
  }[tone];

  return (
    <article className="rounded-lg border border-border bg-secondary p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-semibold text-card-foreground">{value}</p>
        </div>
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md border', toneClass)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

export function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  locked = false,
  onToggle,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  checked: boolean;
  locked?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold text-card-foreground">{label}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
        <button
          type="button"
          aria-pressed={checked}
          disabled={locked}
          onClick={onToggle}
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70',
            checked ? 'border-primary bg-primary' : 'border-border bg-muted',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform',
              checked ? 'translate-x-5' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>
    </div>
  );
}

export function PipelineStep({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <article className="flex gap-3 rounded-lg border border-border bg-secondary p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-sm font-semibold text-primary">
        {number}
      </span>
      <div>
        <p className="font-semibold text-card-foreground">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </article>
  );
}

export function StatusPill({ status }: { status: MockUserRow['status'] }) {
  const styles = {
    Ativo: 'border-success/30 bg-success/10 text-success',
    Convidado: 'border-warning/30 bg-warning/10 text-warning',
    Bloqueado: 'border-destructive/30 bg-destructive/10 text-destructive',
  }[status];

  return <span className={cn('rounded-md border px-2 py-1 text-xs font-semibold', styles)}>{status}</span>;
}

export function ComplianceRow({ title, description, status }: { title: string; description: string; status: string }) {
  return (
    <article className="rounded-lg border border-border bg-secondary p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-card-foreground">{title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <span className="shrink-0 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
          {status}
        </span>
      </div>
    </article>
  );
}
