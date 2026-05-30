import type { ConversationMessage } from '@/lib/mock-conversation-history';
import { cn } from '@/lib/utils';

const directionStyles = {
  INBOUND: 'mr-auto border-border bg-secondary',
  OUTBOUND: 'ml-auto border-primary/30 bg-primary/10',
  SYSTEM: 'mx-auto border-border bg-card',
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
  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <article
          key={message.id}
          className={cn(
            'max-w-[88%] rounded-lg border p-3 text-sm text-foreground',
            directionStyles[message.direction as keyof typeof directionStyles] ?? directionStyles.SYSTEM,
          )}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-card-foreground">{message.senderName}</p>
              <p className="text-xs text-muted-foreground">{message.senderRole}</p>
            </div>
            <time className="text-xs text-muted-foreground">{formatDateTime(message.sentAt)}</time>
          </div>
          <p className="leading-6">{message.content}</p>
        </article>
      ))}
    </div>
  );
}
