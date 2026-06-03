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
    ticket.displayId,
    ticket.provider,
    ticket.providerLabel,
    ticket.customerName,
    ticket.customerContact,
    ticket.queue,
    ticket.agent,
    ticket.channel,
    ticket.group,
    ticket.status,
    ticket.resolutionStatus,
    ticket.subject,
    ticket.sentiment,
    ticket.risk,
    ticket.tags.join(' '),
  ].join(' ');
}

export function getTicketDisplayId(ticket: Pick<DemoTicket, 'id'> & Partial<Pick<DemoTicket, 'displayId' | 'provider' | 'customerContact'>>) {
  if (ticket.displayId) {
    return ticket.displayId;
  }

  if (ticket.provider === 'GLPI') {
    const match = ticket.id.match(/glpi-ticket-(\d+)/i);

    return match ? `GLPI ${match[1]}` : ticket.id;
  }

  if (ticket.provider === 'BLIP' || ticket.provider === 'BLiP') {
    return ticket.customerContact && !ticket.customerContact.includes('@') ? `BLiP ${ticket.customerContact}` : `BLiP ${shortId(ticket.id)}`;
  }

  if (ticket.provider === 'TEAMS_PHONE') {
    return `Teams ${shortId(ticket.id)}`;
  }

  return ticket.id.length > 28 ? shortId(ticket.id) : ticket.id;
}

export function getTicketProvider(ticket: Pick<DemoTicket, 'channel' | 'tags'> & Partial<Pick<DemoTicket, 'provider'>>) {
  const provider = ticket.provider?.toUpperCase();

  if (provider) {
    return provider;
  }

  if (ticket.tags.includes('GLPI') || ticket.channel === 'GLPI') {
    return 'GLPI';
  }

  if (ticket.tags.includes('BLiP') || ticket.channel === 'BLiP' || ticket.channel === 'WhatsApp') {
    return 'BLIP';
  }

  if (ticket.tags.includes('Teams Phone') || ticket.channel === 'Teams Phone') {
    return 'TEAMS_PHONE';
  }

  return 'UNKNOWN';
}

export function getTicketProviderLabel(ticket: Pick<DemoTicket, 'channel' | 'tags'> & Partial<Pick<DemoTicket, 'provider' | 'providerLabel'>>) {
  if (ticket.providerLabel) {
    return ticket.providerLabel;
  }

  const labels: Record<string, string> = {
    BLIP: 'BLiP',
    GLPI: 'GLPI',
    TEAMS_PHONE: 'Teams Phone',
    UNKNOWN: 'Nao informado',
  };

  return labels[getTicketProvider(ticket)] ?? getTicketProvider(ticket);
}

export function hasTicketRating(ticket: Pick<DemoTicket, 'rating'>) {
  return ticket.rating > 0;
}

export function formatRatingLabel(rating: number) {
  return rating > 0 ? `${rating}/5` : 'Sem avaliacao';
}

export const ticketColumns: DataTableColumn<DemoTicket>[] = [
  {
    key: 'ticket',
    header: 'Ticket',
    accessor: (ticket) => (
      <div>
        <p className="font-semibold text-card-foreground">{getTicketDisplayId(ticket)}</p>
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
    key: 'channel',
    header: 'Canal / Grupo',
    accessor: (ticket) => (
      <div>
        <p className="font-medium text-card-foreground">{ticket.channel}</p>
        <p className="text-xs text-muted-foreground">{ticket.group}</p>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    accessor: (ticket) => (
      <div>
        <StatusBadge status={ticket.status} />
        <p className="mt-1 text-xs text-muted-foreground">{ticket.resolutionStatus}</p>
      </div>
    ),
  },
  {
    key: 'rating',
    header: 'Nota',
    accessor: (ticket) => <span className="font-semibold text-card-foreground">{formatRatingLabel(ticket.rating)}</span>,
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

function shortId(value: string) {
  const cleaned = value.replace(/^ticket-/i, '').replace(/@.*$/i, '');

  return cleaned.length > 12 ? cleaned.slice(0, 8) : cleaned;
}
