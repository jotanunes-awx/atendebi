'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MessageSquareText,
  Sparkles,
  Star,
  Timer,
  UserCheck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConversationTimeline } from '@/components/conversation-timeline';
import { RiskBadge } from '@/components/risk-badge';
import { SentimentBadge } from '@/components/sentiment-badge';
import { StatusBadge } from '@/components/status-badge';
import { formatDateTime } from '@/components/ticket-columns';
import { getDemoMessages, type DemoTicket } from '@/lib/demo-data';
import { cn } from '@/lib/utils';

type TicketDetailDrawerProps = {
  ticket: DemoTicket | null;
  contextLabel?: string;
  onClose: () => void;
};

type InvestigationPoint = {
  title: string;
  description: string;
  tone: 'danger' | 'warning' | 'info' | 'success';
};

const pointToneStyles = {
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  info: 'border-info/30 bg-info/10 text-info',
  success: 'border-success/30 bg-success/10 text-success',
};

export function TicketDetailDrawer({ ticket, contextLabel, onClose }: TicketDetailDrawerProps) {
  const open = Boolean(ticket);
  const messages = ticket ? getDemoMessages(ticket) : [];
  const investigation = ticket ? buildInvestigation(ticket) : [];

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[60] bg-background/70 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed right-0 top-0 z-[70] flex h-dvh w-full max-w-3xl flex-col border-l border-border bg-card text-card-foreground shadow-2xl transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-hidden={!open}
      >
        {ticket ? (
          <>
            <header className="border-b border-border px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Detalhe do atendimento
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-normal">{ticket.customerName}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {ticket.id} · {ticket.customerContact}
                  </p>
                </div>
                <Button variant="ghost" size="icon" type="button" onClick={onClose} aria-label="Fechar atendimento">
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {contextLabel ? (
                  <span className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    Origem: {contextLabel}
                  </span>
                ) : null}
                <StatusBadge status={ticket.status} />
                <SentimentBadge sentiment={ticket.sentiment} />
                <RiskBadge risk={ticket.risk} />
                <span className="rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
                  {ticket.rating}/5 estrelas
                </span>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-5">
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailMetric icon={Clock3} label="Fila" value={ticket.queue} detail={ticket.group} />
                <DetailMetric icon={UserCheck} label="Atendente" value={ticket.agent} detail={ticket.channel} />
                <DetailMetric
                  icon={Timer}
                  label="1a resposta"
                  value={`${ticket.firstResponseMinutes.toFixed(1).replace('.', ',')} min`}
                  detail={`${ticket.waitMinutes} min de espera`}
                />
                <DetailMetric icon={Star} label="Qualidade" value={`${ticket.rating}/5`} detail={ticket.resolutionStatus} />
              </section>

              <section className="mt-5 rounded-lg border border-border bg-secondary p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <h3 className="text-base font-semibold text-card-foreground">Leitura executiva</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{ticket.summary}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Este atendimento aparece neste recorte por causa de sinais como nota, risco, tempo de resposta,
                      transferencia do bot, reclamacao ou falta de solucao.
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-card-foreground">Por que merece atencao?</h3>
                    <p className="text-sm text-muted-foreground">Pontos que a diretoria ou qualidade devem investigar.</p>
                  </div>
                  <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />
                </div>

                <div className="grid gap-3">
                  {investigation.map((point) => (
                    <article key={point.title} className={cn('rounded-lg border p-3', pointToneStyles[point.tone])}>
                      <p className="font-semibold">{point.title}</p>
                      <p className="mt-1 text-sm leading-6 text-card-foreground">{point.description}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="text-base font-semibold text-card-foreground">Evidencias</h3>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <Evidence label="Assunto" value={ticket.subject} />
                    <Evidence label="Tags" value={ticket.tags.join(', ')} />
                    <Evidence label="Abertura" value={formatDateTime(ticket.openedAt)} />
                    <Evidence label="Ultima msg" value={formatDateTime(ticket.lastMessageAt)} />
                    <Evidence label="Sinal" value={ticket.signal} />
                  </div>
                </div>

                <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
                  <div className="flex items-start gap-3">
                    <Bot className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <h3 className="text-base font-semibold text-card-foreground">Acao recomendada</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{buildRecommendedAction(ticket)}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mt-5 rounded-lg border border-border bg-card p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-card-foreground">Historico completo</h3>
                    <p className="text-sm text-muted-foreground">Linha do tempo resumida da conversa demo.</p>
                  </div>
                  <MessageSquareText className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <ConversationTimeline messages={messages} />
              </section>
            </div>

            <footer className="flex flex-col gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Detalhe demo preparado para receber mensagens reais, auditoria e analise de IA no backend.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={`/conversas?ticket=${ticket.id}`}>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Abrir em Conversas
                  </Link>
                </Button>
                <Button type="button" onClick={onClose}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Entendi
                </Button>
              </div>
            </footer>
          </>
        ) : null}
      </aside>
    </>
  );
}

function DetailMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 text-base font-semibold text-card-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-3 rounded-md bg-secondary px-3 py-2">
      <span>{label}</span>
      <span className="text-right font-medium text-card-foreground">{value}</span>
    </p>
  );
}

function buildInvestigation(ticket: DemoTicket): InvestigationPoint[] {
  const points: InvestigationPoint[] = [];

  if (ticket.rating <= 2) {
    points.push({
      title: 'Nota baixa',
      description: `Cliente avaliou com ${ticket.rating} estrela(s). A qualidade deve ler a conversa antes de consolidar o indicador.`,
      tone: 'danger',
    });
  }

  if (ticket.unresolved) {
    points.push({
      title: 'Nao solucionado',
      description: 'O atendimento esta marcado como sem solucao, pendente ou cancelado. Deve existir um proximo passo claro.',
      tone: 'warning',
    });
  }

  if (ticket.risk === 'alto') {
    points.push({
      title: 'Risco alto',
      description: 'Ha combinacao de reclamacao, demora ou reincidencia. Esse caso pode virar escalacao se nao houver retorno.',
      tone: 'danger',
    });
  }

  if (ticket.firstResponseMinutes >= 8 || ticket.waitMinutes >= 8) {
    points.push({
      title: 'Tempo acima do ideal',
      description: `Primeira resposta em ${ticket.firstResponseMinutes.toFixed(1).replace('.', ',')} min e espera de ${ticket.waitMinutes} min.`,
      tone: 'warning',
    });
  }

  if (ticket.botFallback) {
    points.push({
      title: 'Bot precisou transferir',
      description: 'O bot nao resolveu sozinho. Vale revisar fluxo, intencao e frases que geraram transferencia.',
      tone: 'info',
    });
  }

  if (ticket.isComplaint) {
    points.push({
      title: 'Reclamacao identificada',
      description: 'O atendimento tem tags de reclamacao. Esse tipo de caso deve entrar em auditoria e plano de causa raiz.',
      tone: 'danger',
    });
  }

  if (ticket.isOpportunity) {
    points.push({
      title: 'Oportunidade comercial',
      description: 'A conversa tem sinal de compra ou proposta. Comercial deve acompanhar para nao perder venda por demora.',
      tone: 'success',
    });
  }

  if (points.length === 0) {
    points.push({
      title: 'Sem alerta critico',
      description: 'Atendimento dentro do comportamento esperado, mas ainda pode ser auditado pelo historico e pelas tags.',
      tone: 'success',
    });
  }

  return points;
}

function buildRecommendedAction(ticket: DemoTicket) {
  if (ticket.rating <= 2 || ticket.sentiment === 'negativo') {
    return 'Abrir revisao de qualidade, registrar causa provavel, acionar responsavel da fila e acompanhar retorno ao cliente.';
  }

  if (ticket.botFallback) {
    return 'Adicionar exemplo real ao backlog do bot e revisar a intencao que levou o cliente para atendimento humano.';
  }

  if (ticket.isOpportunity) {
    return 'Priorizar retorno comercial, registrar proxima acao e acompanhar se houve proposta, conversao ou perda por demora.';
  }

  if (ticket.firstResponseMinutes >= 8) {
    return 'Criar alerta operacional para resposta acima de 8 minutos e redistribuir carteira quando a fila ficar represada.';
  }

  return 'Manter acompanhamento padrao e usar este caso como amostra de historico auditavel.';
}
