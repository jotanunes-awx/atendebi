import type { ConversationMessage } from '@/lib/mock-conversation-history';
import { cn } from '@/lib/utils';

const directionStyles = {
  INBOUND: 'mr-auto border-border bg-secondary',
  OUTBOUND: 'ml-auto border-primary/30 bg-primary/10',
  SYSTEM: 'mx-auto border-info/30 bg-info/10',
};

const roleStyles = {
  INBOUND: 'border-success/30 bg-success/10 text-success',
  OUTBOUND: 'border-primary/30 bg-primary/10 text-primary',
  SYSTEM: 'border-info/30 bg-info/10 text-info',
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function ConversationTimeline({ messages }: { messages: ConversationMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
        Nenhuma mensagem encontrada para esta conversa.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const formatted = formatTimelineContent(message);
        const direction = message.direction as keyof typeof directionStyles;

        return (
          <article
            key={message.id}
            className={cn(
              'w-fit max-w-[min(720px,92%)] rounded-lg border p-3 text-sm text-foreground shadow-sm',
              directionStyles[direction] ?? directionStyles.SYSTEM,
            )}
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-words font-semibold text-card-foreground">{message.senderName}</p>
                  <span
                    className={cn(
                      'inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                      roleStyles[direction] ?? roleStyles.SYSTEM,
                    )}
                  >
                    {message.senderRole}
                  </span>
                </div>
                {formatted.label ? <p className="mt-1 text-xs font-medium text-muted-foreground">{formatted.label}</p> : null}
              </div>
              <time className="shrink-0 text-xs text-muted-foreground">{formatDateTime(message.sentAt)}</time>
            </div>
            <p className="whitespace-pre-wrap break-words leading-6">{formatted.content}</p>
          </article>
        );
      })}
    </div>
  );
}

function formatTimelineContent(message: ConversationMessage) {
  if (message.isStructured || message.contentLabel) {
    return {
      label: message.contentLabel,
      content: message.content,
    };
  }

  const parsed = tryParseJson(message.content.trim());

  if (!parsed) {
    return {
      label: '',
      content: message.content,
    };
  }

  return formatStructuredContent(parsed);
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
    return {
      label: 'Conteudo estruturado',
      content: value.map((item) => formatStructuredContent(item).content).filter(Boolean).join('\n') || 'Lista sem texto principal.',
    };
  }

  if (!value || typeof value !== 'object') {
    return {
      label: 'Conteudo estruturado',
      content: String(value),
    };
  }

  const record = value as Record<string, unknown>;
  const unwrapped = unwrapStructuredRecord(record);

  if (unwrapped !== record) {
    return formatStructuredContent(unwrapped);
  }

  const replied = toRecord(record.replied);

  if (Object.keys(replied).length > 0) {
    const replyText = readText(replied, ['value', 'text']) ?? 'Resposta sem texto principal.';
    const reference = readNestedText(replied, ['inReplyTo.template.name', 'inReplyTo.name', 'inReplyTo.id']);

    return {
      label: 'Resposta do cliente',
      content: reference ? `Cliente escolheu: ${replyText}\nMensagem anterior: template ${reference}` : `Cliente escolheu: ${replyText}`,
    };
  }

  const template = toRecord(record.template);

  if (record.type === 'template' || Object.keys(template).length > 0) {
    return {
      label: 'Template BLiP',
      content: formatTemplate(template),
    };
  }

  const options = collectInteractiveOptions(record);
  const text =
    readNestedText(record, [
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
    ]) ?? undefined;

  if (options.length > 0) {
    return {
      label: 'Opcoes do bot',
      content: [text || 'O bot apresentou opcoes para o cliente.', 'Opcoes apresentadas:', ...options.map((option, index) => `${index + 1}. ${option}`)].join('\n'),
    };
  }

  return {
    label: 'Mensagem estruturada',
    content: text ?? 'Payload estruturado sem texto exibivel.',
  };
}

function formatTemplate(template: Record<string, unknown>) {
  const name = readText(template, ['name']) ?? 'template sem nome';
  const language = toRecord(template.language);
  const languageCode = readText(language, ['code']);
  const variables = collectTemplateParameters(template);
  const lines = [`Mensagem automatica: ${humanizeTemplateName(name)}`];

  if (languageCode) {
    lines.push(`Idioma: ${languageCode}`);
  }

  if (variables.length > 0) {
    lines.push(`Dados usados: ${variables.join(', ')}`);
  }

  return lines.join('\n');
}

function collectTemplateParameters(template: Record<string, unknown>) {
  const components = Array.isArray(template.components) ? template.components : [];

  return components.flatMap((component) => {
    const componentRecord = toRecord(component);
    const parameters = Array.isArray(componentRecord.parameters) ? componentRecord.parameters : [];

    return parameters
      .map((parameter) => readText(toRecord(parameter), ['text', 'value']))
      .filter((value): value is string => Boolean(value));
  });
}

function readText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function readNestedText(record: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = readPathValue(record, path);

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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
    collectOptionLabels(readPathValue(record, path), options);
  }

  const sections = readPathValue(record, 'interactive.action.sections');

  if (Array.isArray(sections)) {
    for (const section of sections) {
      collectOptionLabels(toRecord(section).rows, options);
    }
  }

  return Array.from(new Set(options)).slice(0, 12);
}

function collectOptionLabels(value: unknown, options: string[]) {
  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    const record = toRecord(item);
    const reply = toRecord(record.reply);
    const label =
      readText(record, ['text', 'title', 'label', 'name']) ??
      readText(reply, ['title', 'text']);

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

function readPathValue(record: Record<string, unknown>, path: string) {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, record);
}
