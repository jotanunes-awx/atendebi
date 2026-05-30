'use client';

import { AlertTriangle, CheckCircle2, ClipboardCheck, Star, ThumbsDown } from 'lucide-react';
import { useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { DrilldownDrawer } from '@/components/drilldown-drawer';
import { MetricCard } from '@/components/metric-card';
import { RiskBadge } from '@/components/risk-badge';
import { TicketDetailDrawer } from '@/components/ticket-detail-drawer';
import { ticketColumns, getTicketSearchValue } from '@/components/ticket-columns';
import { average, demoQualityReasons, demoTickets, type DemoTicket } from '@/lib/demo-data';

type QualityDrawer = {
  title: string;
  description: string;
  rows: DemoTicket[];
  filters: Array<{ label: string; value: string }>;
};

export default function QualidadePage() {
  const [drawer, setDrawer] = useState<QualityDrawer | null>(null);
  const [detail, setDetail] = useState<{ ticket: DemoTicket; contextLabel: string } | null>(null);
  const ratedTickets = demoTickets.filter((ticket) => ticket.rating > 0);
  const lowRated = demoTickets.filter((ticket) => ticket.rating <= 2);
  const negativeSentiment = demoTickets.filter((ticket) => ticket.sentiment === 'negativo');
  const highRisk = demoTickets.filter((ticket) => ticket.risk === 'alto');
  const unresolved = demoTickets.filter((ticket) => ticket.unresolved);
  const averageRating = average(ratedTickets.map((ticket) => ticket.rating));

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
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Auditoria e experiencia</p>
          <h2 className="mt-3 text-2xl font-semibold text-card-foreground">Qualidade</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Aqui o gestor deve sair da media e chegar no atendimento exato que gerou nota baixa, risco, insatisfacao ou nao solucao.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Nota media"
            value={averageRating.toFixed(1).replace('.', ',')}
            detail={`${ratedTickets.length} avaliacoes no periodo`}
            tone="warning"
            icon={Star}
            onClick={() => openQuality('Todas as avaliacoes', ratedTickets, 'Tickets avaliados')}
          />
          <MetricCard
            label="Notas baixas"
            value={String(lowRated.length)}
            detail="Notas 1 ou 2 estrelas"
            tone="danger"
            icon={ThumbsDown}
            onClick={() => openQuality('Notas baixas', lowRated, '1 ou 2 estrelas')}
          />
          <MetricCard
            label="Insatisfeitos"
            value={String(negativeSentiment.length)}
            detail="Sentimento negativo"
            tone="danger"
            icon={AlertTriangle}
            onClick={() => openQuality('Clientes insatisfeitos', negativeSentiment, 'Sentimento negativo')}
          />
          <MetricCard
            label="Nao solucionados"
            value={String(unresolved.length)}
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
              {demoQualityReasons.map((reason) => {
                const rows = demoTickets.filter((ticket) => {
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
                      <p className="text-xs text-muted-foreground">{reason.count} ocorrencias estimadas</p>
                    </div>
                    <RiskBadge risk={reason.risk} />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-card-foreground">Acoes recomendadas</h3>
              <p className="text-sm text-muted-foreground">Cada acao abre a base de casos que justificam a recomendacao.</p>
            </div>
            <div className="space-y-3">
              <Recommendation
                title="Revisar fila Financeiro"
                description="Concentra demora, boleto e maior proporcao de sentimento negativo."
                rows={demoTickets.filter((ticket) => ticket.queue === 'Financeiro')}
                onOpen={openQuality}
              />
              <Recommendation
                title="Criar alerta de resposta acima de 8 minutos"
                description="Tickets com demora tendem a nota baixa e risco alto."
                rows={demoTickets.filter((ticket) => ticket.firstResponseMinutes >= 8)}
                onOpen={openQuality}
              />
              <Recommendation
                title="Auditar cancelamentos e reclamacoes"
                description="Casos com risco alto precisam registro e acompanhamento."
                rows={highRisk}
                onOpen={openQuality}
              />
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
  onOpen,
}: {
  title: string;
  description: string;
  rows: DemoTicket[];
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
        <span className="mt-2 block text-xs font-semibold text-primary">{rows.length} tickets relacionados</span>
      </span>
    </button>
  );
}
