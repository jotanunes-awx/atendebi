import type { DemoSentiment } from '@/lib/demo-data';
import { cn } from '@/lib/utils';

const sentimentStyles: Record<DemoSentiment, string> = {
  positivo: 'border-success/30 bg-success/10 text-success',
  neutro: 'border-border bg-secondary text-muted-foreground',
  negativo: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export function SentimentBadge({ sentiment, className }: { sentiment: DemoSentiment; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium capitalize', sentimentStyles[sentiment], className)}>
      {sentiment}
    </span>
  );
}
