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
  const contactMetadata = asRecord(ticket.contact?.metadata);
  const riskFlags = asRecord(analysis?.riskFlags);
  const lastMessage = ticket.messages.at(-1);
  const provider = normalizeProvider(readString(metadata, 'provider', readString(contactMetadata, 'provider', ticket.channel ?? 'UNKNOWN')));

  return {
    id: ticket.externalId ?? ticket.id,
    internalId: ticket.id,
    displayId: buildDisplayId(ticket, provider),
    provider,
    providerLabel: providerLabel(provider),
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
  const formattedContent = formatMessageContent(message.content ?? '', message.contentType ?? 'text/plain');
  const senderRole = inferPresentedSenderRole(message.direction, formattedContent.contentLabel, readString(metadata, 'senderRole', ''));

  return {
    id: message.externalId ?? message.id,
    direction: message.direction,
    senderName: inferPresentedSenderName(message.senderName, message.direction, senderRole),
    senderRole,
    content: formattedContent.content,
    rawContent: formattedContent.rawContent,
    contentLabel: formattedContent.contentLabel,
    isStructured: formattedContent.isStructured,
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

type FormattedMessageContent = {
  content: string;
  rawContent?: string;
  contentLabel?: string;
  isStructured: boolean;
};

function normalizeProvider(value: string) {
  const normalized = value.toUpperCase().replace(/\s+/g, '_');

  if (normalized.includes('GLPI')) {
    return 'GLPI';
  }

  if (normalized.includes('TEAMS')) {
    return 'TEAMS_PHONE';
  }

  if (normalized.includes('BLIP') || normalized.includes('WHATSAPP') || normalized.includes('WEBCHAT')) {
    return 'BLIP';
  }

  return normalized || 'UNKNOWN';
}

function providerLabel(provider: string) {
  const labels: Record<string, string> = {
    BLIP: 'BLiP',
    GLPI: 'GLPI',
    TEAMS_PHONE: 'Teams Phone',
    UNKNOWN: 'Nao informado',
  };

  return labels[provider] ?? provider;
}

function buildDisplayId(ticket: TicketWithRelations, provider: string) {
  const externalId = ticket.externalId ?? ticket.id;

  if (provider === 'GLPI') {
    const match = externalId.match(/glpi-ticket-(\d+)/i);

    return match ? `GLPI ${match[1]}` : `GLPI ${shortIdentifier(externalId)}`;
  }

  if (provider === 'TEAMS_PHONE') {
    return `Teams ${shortIdentifier(externalId)}`;
  }

  if (provider === 'BLIP') {
    const contactLabel = ticket.contact?.phone ?? ticket.contact?.name;

    if (contactLabel && !contactLabel.includes('@') && contactLabel.length <= 40) {
      return `BLiP ${contactLabel}`;
    }

    return `BLiP ${shortIdentifier(externalId)}`;
  }

  return shortIdentifier(externalId);
}

function shortIdentifier(value: string) {
  const cleaned = value.replace(/^ticket-/i, '').replace(/@.*$/i, '');

  return cleaned.length > 12 ? cleaned.slice(0, 8) : cleaned;
}

function inferPresentedSenderName(senderName: string | null, direction: MessageDirection, senderRole: string) {
  if (senderRole === 'Bot' && direction !== 'INBOUND') {
    return 'Bot BLiP';
  }

  return senderName ?? inferSenderName(direction);
}

function inferPresentedSenderRole(direction: MessageDirection, contentLabel?: string, metadataRole?: string) {
  if (direction === 'SYSTEM') {
    return 'Sistema';
  }

  if (direction === 'INBOUND') {
    return 'Cliente';
  }

  if (contentLabel?.toLowerCase().includes('template')) {
    return 'Bot';
  }

  if (metadataRole && !['Atendente/Bot', 'Sistema'].includes(metadataRole)) {
    return metadataRole;
  }

  return 'Atendente/Bot';
}

function formatMessageContent(content: string, contentType: string): FormattedMessageContent {
  const trimmed = content.trim();

  if (!trimmed) {
    return { content: 'Mensagem sem conteudo textual.', contentLabel: contentType, isStructured: false };
  }

  const parsed = tryParseJson(trimmed);

  if (!parsed) {
    return { content: trimmed, contentLabel: contentType, isStructured: false };
  }

  const formatted = formatStructuredContent(parsed);

  return {
    content: formatted.content,
    rawContent: trimmed,
    contentLabel: formatted.label,
    isStructured: true,
  };
}

function tryParseJson(value: string): unknown | null {
  if (!value.startsWith('{') && !value.startsWith('[')) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function formatStructuredContent(value: unknown): { label: string; content: string } {
  if (Array.isArray(value)) {
    const textItems = value.map((item) => formatStructuredContent(item).content).filter(Boolean);

    return {
      label: 'Conteudo estruturado',
      content: textItems.join('\n') || 'Lista estruturada sem texto principal.',
    };
  }

  const record = asRecord(value);

  if (Object.keys(record).length === 0) {
    return { label: 'Conteudo estruturado', content: String(value) };
  }

  const unwrapped = unwrapStructuredRecord(record);

  if (unwrapped !== record) {
    return formatStructuredContent(unwrapped);
  }

  const replied = asRecord(record.replied);

  if (Object.keys(replied).length > 0) {
    const replyText = readString(replied, 'value', readString(replied, 'text', 'Resposta sem texto principal.'));
    const inReplyTo = formatTemplateReference(asRecord(replied.inReplyTo));

    return {
      label: 'Resposta do cliente',
      content: inReplyTo ? `Cliente escolheu: ${replyText}\nMensagem anterior: ${inReplyTo}` : `Cliente escolheu: ${replyText}`,
    };
  }

  const type = readString(record, 'type', '');
  const template = asRecord(record.template);

  if (type === 'template' || Object.keys(template).length > 0) {
    return {
      label: 'Template BLiP',
      content: formatTemplate(template),
    };
  }

  const options = collectInteractiveOptions(record);
  const text = readFirstNestedString(record, [
    'text',
    'title',
    'description',
    'value',
    'body',
    'content.text',
    'content.body',
    'interactive.body.text',
    'interactive.header.text',
    'resource.text',
    'resource.title',
  ]);

  if (options.length > 0) {
    return {
      label: 'Opcoes do bot',
      content: [text || 'O bot apresentou opcoes para o cliente.', 'Opcoes apresentadas:', ...options.map((option, index) => `${index + 1}. ${option}`)].join('\n'),
    };
  }

  if (text) {
    return { label: 'Mensagem estruturada', content: text };
  }

  return {
    label: 'Conteudo estruturado',
    content: summarizeRecord(record),
  };
}

function formatTemplate(template: Record<string, unknown>) {
  const name = readString(template, 'name', 'template sem nome');
  const language = asRecord(template.language);
  const languageCode = readString(language, 'code', '');
  const parameters = collectTemplateParameters(template);
  const lines = [`Mensagem automatica: ${humanizeTemplateName(name)}`];

  if (languageCode) {
    lines.push(`Idioma: ${languageCode}`);
  }

  if (parameters.length > 0) {
    lines.push(`Dados usados: ${parameters.join(', ')}`);
  }

  return lines.join('\n');
}

function formatTemplateReference(record: Record<string, unknown>) {
  const value = readFirstNestedString(record, ['template.name', 'name', 'id']);

  return value ? `template ${value}` : '';
}

function collectTemplateParameters(template: Record<string, unknown>) {
  const components = Array.isArray(template.components) ? template.components : [];

  return components.flatMap((component) => {
    const componentRecord = asRecord(component);
    const parameters = Array.isArray(componentRecord.parameters) ? componentRecord.parameters : [];

    return parameters
      .map((parameter) => {
        const parameterRecord = asRecord(parameter);

        return readString(parameterRecord, 'text', readString(parameterRecord, 'value', ''));
      })
      .filter(Boolean);
  });
}

function summarizeRecord(record: Record<string, unknown>) {
  const interestingValues = ['name', 'id', 'type', 'status', 'value', 'text', 'title']
    .map((key) => {
      const value = record[key];

      return typeof value === 'string' || typeof value === 'number' ? `${key}: ${value}` : '';
    })
    .filter(Boolean);

  return interestingValues.length > 0 ? interestingValues.join('\n') : 'Payload estruturado sem texto exibivel.';
}

function unwrapStructuredRecord(record: Record<string, unknown>) {
  const candidates = ['content', 'value', 'resource', 'message'];

  for (const key of candidates) {
    const value = record[key];

    if (value && typeof value === 'object') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = tryParseJson(value);

      if (parsed) {
        return parsed;
      }
    }
  }

  return record;
}

function collectInteractiveOptions(record: Record<string, unknown>) {
  const options: string[] = [];
  const paths = ['options', 'buttons', 'actions', 'items', 'rows', 'content.options', 'content.buttons', 'interactive.action.buttons'];

  for (const path of paths) {
    const value = readPathValue(record, path);
    collectOptionLabels(value, options);
  }

  const sections = readPathValue(record, 'interactive.action.sections');

  if (Array.isArray(sections)) {
    for (const section of sections) {
      const sectionRecord = asRecord(section);
      collectOptionLabels(sectionRecord.rows, options);
    }
  }

  return Array.from(new Set(options)).slice(0, 12);
}

function collectOptionLabels(value: unknown, options: string[]) {
  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    const record = asRecord(item);
    const reply = asRecord(record.reply);
    const label =
      readString(record, 'text', '') ||
      readString(record, 'title', '') ||
      readString(record, 'label', '') ||
      readString(record, 'name', '') ||
      readString(reply, 'title', '') ||
      readString(reply, 'text', '');

    if (label) {
      options.push(label);
    }
  }
}

function humanizeTemplateName(name: string) {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readFirstNestedString(record: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = readPathValue(record, path);

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}

function readPathValue(record: Record<string, unknown>, path: string) {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, record);
}
