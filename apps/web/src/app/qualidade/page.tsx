'use client';

import { AlertTriangle, CheckCircle2, ClipboardCheck, Star, ThumbsDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { DrilldownDrawer } from '@/components/drilldown-drawer';
import { MetricCard } from '@/components/metric-card';
import { PeriodSelect } from '@/components/period-select';
import { RiskBadge } from '@/components/risk-badge';
import { TicketDetailDrawer } from '@/components/ticket-detail-drawer';
import { ticketColumns, getTicketSearchValue } from '@/components/ticket-columns';
import { getQualityOverview, getTickets } from '@/lib/api-client';
import type { DemoTicket } from '@/lib/demo-data';

type QualityDrawer = {
  title: string;
  description: string;
  rows: DemoTicket[];
  filters: Array<{ label: string; value: string }>;
};

export default function QualidadePage() {
  const [drawer, setDrawer] = useState<QualityDrawer | null>(null);
  const [detail, setDetail] = useState<{ ticket: DemoTicket; contextLabel: string } | null>(null);
  const [period, setPeriod] = useState('30d');
  const qualityQuery = useQuery({
    queryKey: ['quality-overview', period],
    queryFn: () => getQualityOverview(period),
  });
  const ticketsQuery = useQuery({
    queryKey: ['quality-tickets', period],
    queryFn: () => getTickets({ pageSize: 200, period }),
  });

  const apiTickets = ticketsQuery.data?.data ?? [];
  const tickets = apiTickets as unknown as DemoTicket[];
  const ratedTickets = tickets.filter((ticket) => ticket.rating > 0);
  const lowRated = tickets.filter((ticket) => ticket.rating > 0 && ticket.rating <= 2);
  const negativeSentiment = tickets.filter((ticket) => ticket.sentiment === 'negativo');
  const highRisk = tickets.filter((ticket) => ticket.risk === 'alto');
  const unresolved = tickets.filter((ticket) => ticket.unresolved);
  const quality = qualityQuery.data;
  const averageRating = quality?.averageRating ?? average(ratedTickets.map((ticket) => ticket.rating));
  const reasons = (quality?.recurrentReasons ?? []).map((reason) => ({ ...reason, risk: inferReasonRisk(reason.label) }));
  const recommendedActions = quality?.recommendedActions ?? [];

  function openQuality(title: string, rows: DemoTicket[], label: string) {
    setDrawer({
      title,
      description: `${rows.length} atendimentos encontrados para auditoria de qualidade.`,
      rows,
      filters: [{ label: 'Recorte', value: label }],
    });
  }

  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 shadow-panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Auditoria e experiencia</p>
              <h2 className="mt-3 text-2xl font-semibold text-card-foreground">Qualidade</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Aqui o gestor deve sair da media e chegar no atendimento exato que gerou nota baixa, risco, insatisfacao ou nao solucao.
              </p>
            </div>
            <PeriodSelect value={period} onChange={setPeriod} />
          </div>
          <p className="mt-4 text-xs font-semibold text-primary">
            Fonte: {qualityQuery.isLoading || ticketsQuery.isLoading ? 'Carregando API' : qualityQuery.isError || ticketsQuery.isError ? 'API indisponivel' : 'Conectado a API real'}
            {quality?.periodLabel ? ` · ${quality.periodLabel}` : ''}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Nota media"
            value={ratedTickets.length > 0 || (quality?.totalRated ?? 0) > 0 ? averageRating.toFixed(1).replace('.', ',') : 'Sem nota'}
            detail={`${quality?.totalRated ?? ratedTickets.length} avaliacoes no periodo`}
            tone="warning"
            icon={Star}
            onClick={() => openQuality('Todas as avaliacoes', ratedTickets, 'Tickets avaliados')}
          />
          <MetricCard
            label="Notas baixas"
            value={String(quality?.lowRated ?? lowRated.length)}
            detail="Notas 1 ou 2 estrelas"
            tone="danger"
            icon={ThumbsDown}
            onClick={() => openQuality('Notas baixas', lowRated, '1 ou 2 estrelas')}
          />
          <MetricCard
            label="Insatisfeitos"
            value={String(quality?.negativeSentiment ?? negativeSentiment.length)}
            detail="Sentimento negativo"
            tone="danger"
            icon={AlertTriangle}
            onClick={() => openQuality('Clientes insatisfeitos', negativeSentiment, 'Sentimento negativo')}
          />
          <MetricCard
            label="Nao solucionados"
            value={String(quality?.unresolved ?? unresolved.length)}
            detail="Fechados ou pendentes sem solucao"
            tone="warning"
            icon={ClipboardCheck}
            onClick={() => openQuality('Nao solucionados', unresolved, 'Nao solucionado')}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-card-foreground">Motivos recorrentes</h3>
              <p className="text-sm text-muted-foreground">Clique no motivo para abrir os tickets relacionados.</p>
            </div>
            <div className="space-y-3">
              {reasons.map((reason) => {
                const rows = tickets.filter((ticket) => {
                  const source = `${ticket.subject} ${ticket.tags.join(' ')} ${ticket.summary}`.toLowerCase();

                  return source.includes(reason.label.split(' ')[0].toLowerCase()) || ticket.risk === reason.risk;
                });

                return (
                  <button
                    key={reason.label}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-secondary px-3 py-3 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => openQuality(reason.label, rows, reason.label)}
                  >
                    <div>
                      <p className="font-medium text-card-foreground">{reason.label}</p>
                      <p className="text-xs text-muted-foreground">{reason.count} ocorrencias encontradas</p>
                    </div>
                    <RiskBadge risk={reason.risk} />
                  </button>
                );
              })}
              {reasons.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-secondary p-4 text-sm leading-6 text-muted-foreground">
                  Nenhum motivo recorrente encontrado ainda. Eles aparecem conforme houver tickets reais com tags, risco ou analise.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-card-foreground">Acoes recomendadas</h3>
              <p className="text-sm text-muted-foreground">Cada acao abre a base de casos que justificam a recomendacao.</p>
            </div>
            <div className="space-y-3">
              {recommendedActions.map((action) => (
                <Recommendation
                  key={action.title}
                  title={action.title}
                  description={action.description}
                  rows={getRowsForRecommendation(action.title, tickets, lowRated, highRisk, unresolved)}
                  ticketCount={action.tickets}
                  onOpen={openQuality}
                />
              ))}
              {recommendedActions.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-secondary p-4 text-sm leading-6 text-muted-foreground">
                  Nenhuma acao recomendada ainda. A API vai preencher esta area a partir dos dados sincronizados.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </section>

      <DrilldownDrawer
        open={Boolean(drawer)}
        title={drawer?.title ?? ''}
        description={drawer?.description ?? ''}
        filters={drawer?.filters}
        rows={drawer?.rows ?? []}
        columns={ticketColumns}
        getSearchValue={getTicketSearchValue}
        onClose={() => setDrawer(null)}
        onRowClick={(ticket) => setDetail({ ticket, contextLabel: drawer?.title ?? 'Qualidade' })}
      />
      <TicketDetailDrawer
        ticket={detail?.ticket ?? null}
        contextLabel={detail?.contextLabel}
        onClose={() => setDetail(null)}
      />
    </DashboardShell>
  );
}

function Recommendation({
  title,
  description,
  rows,
  ticketCount,
  onOpen,
}: {
  title: string;
  description: string;
  rows: DemoTicket[];
  ticketCount: number;
  onOpen: (title: string, rows: DemoTicket[], label: string) => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full gap-3 rounded-md border border-border bg-secondary p-3 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onOpen(title, rows, title)}
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span>
        <span className="block font-medium text-card-foreground">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-muted-foreground">{description}</span>
        <span className="mt-2 block text-xs font-semibold text-primary">{ticketCount} tickets relacionados</span>
      </span>
    </button>
  );
}

function inferReasonRisk(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes('reclam') || normalized.includes('risco') || normalized.includes('cancel')) {
    return 'alto' as const;
  }

  if (normalized.includes('boleto') || normalized.includes('entrega')) {
    return 'medio' as const;
  }

  return 'baixo' as const;
}

function getRowsForRecommendation(
  title: string,
  tickets: DemoTicket[],
  lowRated: DemoTicket[],
  highRisk: DemoTicket[],
  unresolved: DemoTicket[],
) {
  const normalized = title.toLowerCase();

  if (normalized.includes('nota') || normalized.includes('1 e 2')) {
    return lowRated;
  }

  if (normalized.includes('risco') || normalized.includes('cancel') || normalized.includes('reclam')) {
    return highRisk;
  }

  if (normalized.includes('solucion')) {
    return unresolved;
  }

  if (normalized.includes('financeiro')) {
    return tickets.filter((ticket) => ticket.queue === 'Financeiro');
  }

  if (normalized.includes('8 minutos') || normalized.includes('demora')) {
    return tickets.filter((ticket) => ticket.firstResponseMinutes >= 8);
  }

  return tickets.slice(0, 25);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}
