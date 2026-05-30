import type { DataTableColumn } from '@/components/data-table';
import { RiskBadge } from '@/components/risk-badge';
import { SentimentBadge } from '@/components/sentiment-badge';
import { StatusBadge } from '@/components/status-badge';
import type { DemoTicket } from '@/lib/demo-data';

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function getTicketSearchValue(ticket: DemoTicket) {
  return [
    ticket.id,
    ticket.customerName,
    ticket.customerContact,
    ticket.queue,
    ticket.agent,
    ticket.status,
    ticket.subject,
    ticket.sentiment,
    ticket.risk,
    ticket.tags.join(' '),
  ].join(' ');
}

export const ticketColumns: DataTableColumn<DemoTicket>[] = [
  {
    key: 'ticket',
    header: 'Ticket',
    accessor: (ticket) => (
      <div>
        <p className="font-semibold text-card-foreground">{ticket.id}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(ticket.openedAt)}</p>
      </div>
    ),
  },
  {
    key: 'customer',
    header: 'Cliente',
    accessor: (ticket) => (
      <div>
        <p className="font-medium text-card-foreground">{ticket.customerName}</p>
        <p className="text-xs text-muted-foreground">{ticket.customerContact}</p>
      </div>
    ),
  },
  {
    key: 'queue',
    header: 'Fila',
    accessor: (ticket) => ticket.queue,
  },
  {
    key: 'agent',
    header: 'Atendente',
    accessor: (ticket) => ticket.agent,
  },
  {
    key: 'status',
    header: 'Status',
    accessor: (ticket) => <StatusBadge status={ticket.status} />,
  },
  {
    key: 'rating',
    header: 'Nota',
    accessor: (ticket) => <span className="font-semibold text-card-foreground">{ticket.rating}/5</span>,
  },
  {
    key: 'sentiment',
    header: 'Sentimento',
    accessor: (ticket) => <SentimentBadge sentiment={ticket.sentiment} />,
  },
  {
    key: 'risk',
    header: 'Risco',
    accessor: (ticket) => <RiskBadge risk={ticket.risk} />,
  },
];
