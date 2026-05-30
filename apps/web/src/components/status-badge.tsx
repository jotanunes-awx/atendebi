import type { DemoTicketStatus } from '@/lib/demo-data';
import { cn } from '@/lib/utils';

const statusLabel: Record<DemoTicketStatus, string> = {
  OPEN: 'Aberto',
  PENDING: 'Pendente',
  CLOSED: 'Fechado',
  CANCELED: 'Cancelado',
};

const statusStyles: Record<DemoTicketStatus, string> = {
  OPEN: 'border-primary/30 bg-primary/10 text-primary',
  PENDING: 'border-warning/30 bg-warning/10 text-warning',
  CLOSED: 'border-success/30 bg-success/10 text-success',
  CANCELED: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export function StatusBadge({ status, className }: { status: DemoTicketStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium', statusStyles[status], className)}>
      {statusLabel[status]}
    </span>
  );
}
