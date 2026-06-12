import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { MessageDirection, Prisma, TicketStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { authorTypeLabel, classifyBlipAuthor } from '../common/data/message-author';
import { PrismaService } from '../common/prisma/prisma.service';
import { EVENT_PROCESSING_QUEUE, RawEventProcessingJob } from './queue.constants';

type RawPayload = Record<string, unknown>;

type NormalizedBlipEvent = {
  providerEventId?: string;
  eventType?: string;
  messageExternalId?: string;
  ticketExternalId: string;
  contactExternalId?: string;
  contactName?: string;
  contactPhone?: string;
  direction: MessageDirection;
  content?: string;
  contentType: string;
  sentAt: Date;
  channel: string;
  queueName?: string;
  agentName?: string;
  status: TicketStatus;
  subject: string;
  group: string;
};

@Processor(EVENT_PROCESSING_QUEUE)
export class EventProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(EventProcessingProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<RawEventProcessingJob>) {
    const { rawEventId, tenantId } = job.data;

    this.logger.log({
      message: 'Starting raw event processing',
      jobId: job.id,
      rawEventId,
      tenantId,
    });

    await this.prisma.rawEvent.update({
      where: { id: rawEventId },
      data: { processingStatus: 'PROCESSING' },
    });

    try {
      const rawEvent = await this.prisma.rawEvent.findFirst({
        where: {
          id: rawEventId,
          tenantId,
        },
      });

      if (!rawEvent) {
        throw new Error(`Raw event ${rawEventId} was not found for tenant ${tenantId}`);
      }

      const payload = asPayload(rawEvent.payload);
      const normalized = normalizeBlipPayload(payload, {
        rawEventId: rawEvent.id,
        payloadHash: rawEvent.payloadHash,
        providerEventId: rawEvent.providerEventId ?? undefined,
        eventType: rawEvent.eventType ?? undefined,
        receivedAt: rawEvent.receivedAt,
      });

      if (!normalized.contactExternalId && !normalized.content) {
        await this.prisma.rawEvent.update({
          where: { id: rawEventId },
          data: {
            processingStatus: 'IGNORED',
            processedAt: new Date(),
            errorMessage: 'Event without contact or message content for initial normalization',
          },
        });
        return;
      }

      const contact = normalized.contactExternalId
        ? await this.prisma.contact.upsert({
            where: {
              tenantId_externalId: {
                tenantId,
                externalId: normalized.contactExternalId,
              },
            },
            create: {
              tenantId,
              externalId: normalized.contactExternalId,
              name: normalized.contactName,
              phone: normalized.contactPhone,
              metadata: {
                source: 'BLIP',
                channel: normalized.channel,
              },
            },
            update: {
              name: normalized.contactName,
              phone: normalized.contactPhone,
            },
          })
        : null;

      const queue = normalized.queueName
        ? await this.prisma.supportQueue.upsert({
            where: {
              tenantId_externalId: {
                tenantId,
                externalId: buildExternalId('queue', normalized.queueName),
              },
            },
            create: {
              tenantId,
              externalId: buildExternalId('queue', normalized.queueName),
              name: normalized.queueName,
            },
            update: {
              name: normalized.queueName,
              isActive: true,
            },
          })
        : null;

      const agent = normalized.agentName
        ? await this.prisma.agent.upsert({
            where: {
              tenantId_externalId: {
                tenantId,
                externalId: buildExternalId('agent', normalized.agentName),
              },
            },
            create: {
              tenantId,
              externalId: buildExternalId('agent', normalized.agentName),
              name: normalized.agentName,
            },
            update: {
              name: normalized.agentName,
              isActive: true,
            },
          })
        : null;

      const ticket = await this.prisma.ticket.upsert({
        where: {
          tenantId_externalId: {
            tenantId,
            externalId: normalized.ticketExternalId,
          },
        },
        create: {
          tenantId,
          externalId: normalized.ticketExternalId,
          contactId: contact?.id,
          queueId: queue?.id,
          agentId: agent?.id,
          status: normalized.status,
          channel: normalized.channel,
          subject: normalized.subject,
          openedAt: normalized.sentAt,
          firstResponseAt: normalized.direction === 'OUTBOUND' ? normalized.sentAt : undefined,
          metadata: {
            group: normalized.group,
            signal: inferSignal(normalized),
            source: 'BLIP',
            eventType: normalized.eventType,
            providerEventId: normalized.providerEventId,
            resolutionStatus: normalized.status === 'CLOSED' ? 'Resolvido' : 'Em andamento',
            risk: inferRisk(normalized),
          },
        },
        update: {
          contactId: contact?.id,
          queueId: queue?.id,
          agentId: agent?.id,
          status: normalized.status,
          channel: normalized.channel,
          subject: normalized.subject,
          firstResponseAt: normalized.direction === 'OUTBOUND' ? normalized.sentAt : undefined,
        },
      });

      if (normalized.content) {
        const messageAuthorType = classifyBlipAuthor(normalized.direction, normalized.agentName);

        await this.prisma.message.upsert({
          where: {
            tenantId_externalId: {
              tenantId,
              externalId: normalized.messageExternalId ?? buildExternalId('message', rawEvent.id),
            },
          },
          create: {
            tenantId,
            ticketId: ticket.id,
            contactId: contact?.id,
            agentId: agent?.id,
            rawEventId: rawEvent.id,
            externalId: normalized.messageExternalId ?? buildExternalId('message', rawEvent.id),
            direction: normalized.direction,
            authorType: messageAuthorType,
            senderName: inferSenderName(normalized, contact?.name),
            content: normalized.content,
            contentType: normalized.contentType,
            sentAt: normalized.sentAt,
            metadata: {
              source: 'BLIP',
              provider: 'BLIP',
              eventType: normalized.eventType,
              senderRole: authorTypeLabel(messageAuthorType),
              agentName: normalized.agentName,
            },
          },
          update: {
            ticketId: ticket.id,
            contactId: contact?.id,
            agentId: agent?.id,
            rawEventId: rawEvent.id,
            direction: normalized.direction,
            authorType: messageAuthorType,
            senderName: inferSenderName(normalized, contact?.name),
            content: normalized.content,
            contentType: normalized.contentType,
            sentAt: normalized.sentAt,
          },
        });
      }

      await this.prisma.rawEvent.update({
        where: { id: rawEventId },
        data: {
          processingStatus: 'PROCESSED',
          processedAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (error) {
      await this.prisma.rawEvent.update({
        where: { id: rawEventId },
        data: {
          processingStatus: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown processing error',
        },
      });

      throw error;
    }
  }
}

function normalizeBlipPayload(
  payload: RawPayload,
  fallback: {
    rawEventId: string;
    payloadHash: string;
    providerEventId?: string;
    eventType?: string;
    receivedAt: Date;
  },
): NormalizedBlipEvent {
  const from = extractString(payload, ['from', 'message.from', 'resource.from', 'sender']);
  const to = extractString(payload, ['to', 'message.to', 'resource.to', 'recipient']);
  const contactExternalId = truncate(
    pickContactIdentity(payload, from, to) ?? extractString(payload, ['contactId', 'customerId']),
    180,
  );
  const eventType = truncate(
    extractString(payload, ['eventType', 'type', 'message.type', 'resource.type']) ?? fallback.eventType ?? 'message',
    120,
  );
  const messageExternalId = truncate(
    extractString(payload, ['id', 'message.id', 'resource.id', 'messageId']) ?? fallback.providerEventId,
    180,
  );
  const ticketExternalId =
    truncate(
      extractString(payload, [
        'ticket.id',
        'conversation.id',
        'thread.id',
        'resource.ticketId',
        'resource.threadId',
        'message.threadId',
        'metadata.threadId',
      ]) ??
        (contactExternalId ? `ticket-${contactExternalId}` : undefined) ??
        `ticket-${fallback.payloadHash}`,
      180,
    ) ?? `ticket-${fallback.payloadHash}`;
  const content = extractContent(payload);
  const contentType =
    truncate(extractString(payload, ['contentType', 'type', 'message.type', 'resource.type']) ?? 'text/plain', 80) ??
    'text/plain';
  const sentAt = extractDate(payload, fallback.receivedAt);
  const channel = inferChannel(payload, contactExternalId);
  const queueName = truncate(
    extractString(payload, [
      'queue.name',
      'resource.queue.name',
      'resource.queue',
      'extras.queue',
      'extras.team',
      'metadata.queue',
      'metadata.queueName',
      'metadata.team',
      'metadata.teamName',
      'metadata.#desk.queue',
      'metadata.#desk.queueName',
      'metadata.#desk.team',
      'metadata.#desk.teamName',
    ]),
    160,
  );
  const agentName = truncate(
    extractString(payload, [
      'agent.name',
      'attendant.name',
      'operator.name',
      'resource.agent.name',
      'resource.attendant.name',
      'metadata.agent',
      'metadata.agentName',
      'metadata.attendant',
      'metadata.attendantName',
      'metadata.operator',
      'metadata.operatorName',
      'metadata.#desk.agentName',
      'metadata.#desk.attendantName',
      'metadata.#desk.operatorName',
      'metadata.desk.agentName',
      'metadata.desk.attendantName',
      'resource.metadata.#desk.agentName',
      'resource.metadata.#desk.attendantName',
      'message.metadata.#desk.agentName',
      'message.metadata.#desk.attendantName',
      'extras.agentName',
      'extras.attendantName',
    ]),
    160,
  );

  return {
    providerEventId: fallback.providerEventId,
    eventType,
    messageExternalId,
    ticketExternalId,
    contactExternalId,
    contactName: truncate(extractString(payload, ['contact.name', 'customer.name', 'resource.customer.name', 'resource.customerName']), 180),
    contactPhone: truncate(extractString(payload, ['contact.phone', 'customer.phone', 'resource.customer.phone']) ?? extractPhone(contactExternalId), 40),
    direction: inferDirection(payload, from, to, content),
    content,
    contentType,
    sentAt,
    channel,
    queueName,
    agentName,
    status: inferStatus(payload),
    subject: truncate(extractString(payload, ['subject', 'category', 'resource.category']) ?? eventType, 240) ?? 'Mensagem BLiP',
    group: truncate(extractString(payload, ['group', 'resource.group', 'metadata.group']) ?? queueName ?? channel, 160) ?? 'Sem grupo',
  };
}

function asPayload(value: Prisma.JsonValue): RawPayload {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RawPayload) : {};
}

function extractString(payload: RawPayload, paths: string[]) {
  for (const path of paths) {
    const value = readPath(payload, path);

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function extractContent(payload: RawPayload) {
  const value = readFirst(payload, ['content', 'text', 'body', 'message.content', 'resource.content']);

  if (typeof value === 'string') {
    return value.trim().length > 0 ? value.trim() : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value && typeof value === 'object') {
    const text = readFirst(value as RawPayload, ['text', 'title', 'description', 'value']);

    if (typeof text === 'string' && text.trim().length > 0) {
      return text.trim();
    }

    return JSON.stringify(value);
  }

  return undefined;
}

function readFirst(payload: RawPayload, paths: string[]) {
  for (const path of paths) {
    const value = readPath(payload, path);

    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
}

function readPath(payload: RawPayload, path: string): unknown {
  return readFlexiblePath(payload, path.split('.'));
}

function readFlexiblePath(current: unknown, segments: string[]): unknown {
  if (!current || typeof current !== 'object' || segments.length === 0) {
    return undefined;
  }

  const record = current as RawPayload;
  const literalKey = segments.join('.');

  if (Object.prototype.hasOwnProperty.call(record, literalKey)) {
    return record[literalKey];
  }

  const [head, ...tail] = segments;

  if (!head) {
    return undefined;
  }

  if (tail.length === 0) {
    return record[head];
  }

  return readFlexiblePath(record[head], tail);
}

function pickContactIdentity(payload: RawPayload, from?: string, to?: string) {
  const explicit = extractString(payload, [
    'contact.identity',
    'customer.identity',
    'resource.customer.identity',
    'message.contact.identity',
    'resource.contact.identity',
  ]);

  if (explicit) {
    return explicit;
  }

  return [from, to].find((value) => value && isLikelyCustomerAddress(value));
}

function isLikelyCustomerAddress(value: string) {
  const normalized = value.toLowerCase();

  return (
    normalized.includes('@wa.gw.msging.net') ||
    normalized.includes('@instagram.gw') ||
    normalized.includes('@facebook.gw') ||
    normalized.includes('@0mn.io') ||
    !normalized.includes('@msging.net')
  );
}

function inferDirection(payload: RawPayload, from?: string, to?: string, content?: string): MessageDirection {
  const direction = extractString(payload, ['direction', 'message.direction', 'resource.direction'])?.toLowerCase();

  if (direction && ['outbound', 'outgoing', 'sent', 'enviada'].includes(direction)) {
    return 'OUTBOUND';
  }

  if (direction && ['inbound', 'incoming', 'received', 'recebida'].includes(direction)) {
    return 'INBOUND';
  }

  if (from && isLikelyCustomerAddress(from)) {
    return 'INBOUND';
  }

  if (to && isLikelyCustomerAddress(to)) {
    return 'OUTBOUND';
  }

  return content ? 'INBOUND' : 'SYSTEM';
}

function inferStatus(payload: RawPayload): TicketStatus {
  const status = extractString(payload, ['status', 'ticket.status', 'resource.status'])?.toLowerCase();

  if (!status) {
    return 'OPEN';
  }

  if (['closed', 'finished', 'completed', 'resolved', 'fechado', 'resolvido'].includes(status)) {
    return 'CLOSED';
  }

  if (['canceled', 'cancelled', 'cancelado'].includes(status)) {
    return 'CANCELED';
  }

  if (['pending', 'waiting', 'pendente', 'aguardando'].includes(status)) {
    return 'PENDING';
  }

  return 'OPEN';
}

function extractDate(payload: RawPayload, fallback: Date) {
  const value = readFirst(payload, ['date', 'timestamp', 'sentAt', 'message.date', 'resource.date', 'metadata.#wa.timestamp']);

  if (typeof value === 'string') {
    const parsed = /^\d+$/.test(value) ? new Date(Number(value) * (value.length <= 10 ? 1000 : 1)) : new Date(value);

    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }

  if (typeof value === 'number') {
    const parsed = new Date(value * (value <= 9999999999 ? 1000 : 1));

    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }

  return fallback;
}

function inferChannel(payload: RawPayload, contactExternalId?: string) {
  const explicit = extractString(payload, ['channel', 'source', 'resource.channel', 'metadata.channel']);

  if (explicit) {
    return truncate(explicit, 80) ?? 'BLiP';
  }

  const source = contactExternalId?.toLowerCase() ?? '';

  if (source.includes('@wa.gw')) {
    return 'WhatsApp';
  }

  if (source.includes('instagram')) {
    return 'Instagram';
  }

  if (source.includes('facebook')) {
    return 'Facebook';
  }

  return 'BLiP';
}

function extractPhone(identity?: string) {
  if (!identity) {
    return undefined;
  }

  const [prefix] = identity.split('@');
  const digits = prefix.replace(/\D/g, '');

  return digits.length >= 8 ? `+${digits}` : undefined;
}

function buildExternalId(prefix: string, value: string) {
  return truncate(`${prefix}-${slug(value)}`, 180) ?? `${prefix}-unknown`;
}

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function truncate(value: string | undefined, size: number) {
  if (!value) {
    return undefined;
  }

  return value.length > size ? value.slice(0, size) : value;
}

function inferSenderName(event: NormalizedBlipEvent, contactName?: string | null) {
  if (event.direction === 'SYSTEM') {
    return 'BLiP';
  }

  if (event.direction === 'INBOUND') {
    return contactName ?? event.contactName ?? 'Cliente';
  }

  return event.agentName ?? 'Atendente';
}

function inferSignal(event: NormalizedBlipEvent) {
  const source = `${event.subject} ${event.content ?? ''}`.toLowerCase();

  if (source.includes('proposta') || source.includes('compr') || source.includes('venda')) {
    return 'Venda';
  }

  if (source.includes('reclam') || source.includes('cancel')) {
    return 'Reclamacao';
  }

  if (event.direction === 'SYSTEM') {
    return 'Bot';
  }

  return 'Operacao';
}

function inferRisk(event: NormalizedBlipEvent) {
  const source = `${event.subject} ${event.content ?? ''}`.toLowerCase();

  if (source.includes('reclam') || source.includes('cancel') || source.includes('nao resolve')) {
    return 'alto';
  }

  if (event.direction === 'SYSTEM') {
    return 'medio';
  }

  return 'baixo';
}
