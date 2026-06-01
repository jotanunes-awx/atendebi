import { MessageDirection, Prisma } from '@prisma/client';

export const ticketInclude = {
  contact: true,
  queue: true,
  agent: true,
  ratings: {
    orderBy: { ratedAt: 'desc' },
  },
  tags: {
    include: { tag: true },
  },
  aiAnalysis: {
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  messages: {
    orderBy: { sentAt: 'asc' },
  },
} satisfies Prisma.TicketInclude;

export type TicketWithRelations = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;
export type MessageWithRelations = TicketWithRelations['messages'][number];

export function presentTicket(ticket: TicketWithRelations) {
  const latestRating = ticket.ratings[0];
  const analysis = ticket.aiAnalysis[0];
  const metadata = asRecord(ticket.metadata);
  const riskFlags = asRecord(analysis?.riskFlags);
  const lastMessage = ticket.messages.at(-1);

  return {
    id: ticket.externalId ?? ticket.id,
    internalId: ticket.id,
    customerName: ticket.contact?.name ?? 'Cliente sem nome',
    customerContact: ticket.contact?.phone ?? ticket.contact?.email ?? 'Contato nao informado',
    queue: ticket.queue?.name ?? readString(metadata, 'queueDisplayName', 'Sem fila'),
    agent: ticket.agent?.name ?? readString(metadata, 'agentDisplayName', 'Sem atendente'),
    status: ticket.status,
    resolutionStatus: readString(metadata, 'resolutionStatus', ticket.status === 'CLOSED' ? 'Resolvido' : 'Em andamento'),
    rating: latestRating?.score ?? 0,
    channel: ticket.channel ?? 'Nao informado',
    group: readString(metadata, 'group', 'Sem grupo'),
    subject: ticket.subject ?? 'Sem assunto',
    signal: readString(metadata, 'signal', inferSignal(ticket)),
    sentiment: analysis?.sentiment ?? readString(metadata, 'sentiment', 'neutro'),
    risk: readString(riskFlags, 'risk', readString(metadata, 'risk', 'baixo')),
    openedAt: ticket.openedAt.toISOString(),
    lastMessageAt: (lastMessage?.sentAt ?? ticket.closedAt ?? ticket.updatedAt).toISOString(),
    firstResponseMinutes: calculateMinutes(ticket.openedAt, ticket.firstResponseAt),
    waitMinutes: readNumber(metadata, 'waitMinutes', calculateMinutes(ticket.openedAt, ticket.firstResponseAt)),
    tags: ticket.tags.map((ticketTag) => ticketTag.tag.name),
    summary: analysis?.summary ?? readString(metadata, 'summary', 'Atendimento sem resumo registrado.'),
    isComplaint: readBoolean(riskFlags, 'isComplaint', ticket.tags.some((ticketTag) => ticketTag.tag.name === 'Reclamacao')),
    isOpportunity: readBoolean(
      riskFlags,
      'isOpportunity',
      ticket.tags.some((ticketTag) => ['Venda', 'Proposta'].includes(ticketTag.tag.name)),
    ),
    botFallback: readBoolean(riskFlags, 'botFallback', false),
    unresolved: readBoolean(
      riskFlags,
      'unresolved',
      readString(metadata, 'resolutionStatus', '').toLowerCase().includes('nao solucionado'),
    ),
  };
}

export function presentMessage(message: MessageWithRelations) {
  const metadata = asRecord(message.metadata);

  return {
    id: message.externalId ?? message.id,
    direction: message.direction,
    senderName: message.senderName ?? inferSenderName(message.direction),
    senderRole: readString(metadata, 'senderRole', inferSenderRole(message.direction)),
    content: message.content ?? '',
    sentAt: message.sentAt.toISOString(),
    contentType: message.contentType ?? 'text/plain',
  };
}

export function calculateMinutes(start: Date, end?: Date | null) {
  if (!end) {
    return 0;
  }

  return Number(Math.max(0, (end.getTime() - start.getTime()) / 60000).toFixed(1));
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function readString(record: Record<string, unknown>, key: string, fallback: string) {
  const value = record[key];

  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export function readNumber(record: Record<string, unknown>, key: string, fallback: number) {
  const value = record[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function readBoolean(record: Record<string, unknown>, key: string, fallback: boolean) {
  const value = record[key];

  return typeof value === 'boolean' ? value : fallback;
}

function inferSignal(ticket: TicketWithRelations) {
  const tags = ticket.tags.map((ticketTag) => ticketTag.tag.name);

  if (tags.includes('Venda') || tags.includes('Proposta')) {
    return 'Venda';
  }

  if (tags.includes('Reclamacao')) {
    return 'Reclamacao';
  }

  return 'Operacao';
}

function inferSenderName(direction: MessageDirection) {
  if (direction === 'SYSTEM') {
    return 'Sistema';
  }

  return direction === 'INBOUND' ? 'Cliente' : 'Atendente';
}

function inferSenderRole(direction: MessageDirection) {
  if (direction === 'SYSTEM') {
    return 'Bot';
  }

  return direction === 'INBOUND' ? 'Cliente' : 'Atendente';
}
