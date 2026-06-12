'use client';

import { AlertTriangle, Bot, HelpCircle, Route, UserRoundCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { DrilldownDrawer } from '@/components/drilldown-drawer';
import { MetricCard } from '@/components/metric-card';
import { TicketDetailDrawer } from '@/components/ticket-detail-drawer';
import { ticketColumns, getTicketSearchValue } from '@/components/ticket-columns';
import { getBotOverview, getTickets, type BotOverview } from '@/lib/api-client';
import type { DemoTicket } from '@/lib/demo-data';
import { cn } from '@/lib/utils';

type FlowRow = BotOverview['flows'][number];

type BotDrawer = {
  title: string;
  description: string;
  rows: DemoTicket[];
  filters: Array<{ label: string; value: string }>;
};

const flowColumns: DataTableColumn<FlowRow>[] = [
  {
    key: 'name',
    header: 'Fluxo',
    accessor: (flow) => <span className="font-semibold text-card-foreground">{flow.name}</span>,
  },
  {
    key: 'total',
    header: 'Conversas',
    accessor: (flow) => flow.total,
  },
  {
    key: 'fallback',
    header: 'Fallback',
    accessor: (flow) => <span className="font-semibold text-card-foreground">{flow.fallback}</span>,
  },
  {
    key: 'rate',
    header: 'Taxa',
    accessor: (flow) => `${flow.fallbackRate}%`,
  },
];

const emptyBotOverview: BotOverview = {
  fallbackRate: 0,
  humanRequests: 0,
  abandonedFlows: 0,
  misunderstoodQuestions: 0,
  botContainmentRate: 0,
  botHandledTickets: 0,
  humanHandledTickets: 0,
  messageMix: [],
  flows: [],
  failures: [],
};

const authorBarStyles: Record<BotOverview['messageMix'][number]['authorType'], string> = {
  BOT: 'bg-primary',
  AGENT: 'bg-info',
  CUSTOMER: 'bg-success',
  SYSTEM: 'bg-muted-foreground',
};

export default function BotPage() {
  const [drawer, setDrawer] = useState<BotDrawer | null>(null);
  const [detail, setDetail] = useState<{ ticket: DemoTicket; contextLabel: string } | null>(null);
  const botQuery = useQuery({
    queryKey: ['bot-overview'],
    queryFn: getBotOverview,
  });
  const ticketsQuery = useQuery({
    queryKey: ['bot-tickets'],
    queryFn: () => getTickets({ pageSize: 200 }),
  });

  const apiTickets = ticketsQuery.data?.data ?? [];
  const usingApi = !botQuery.isError && !ticketsQuery.isError;
  const tickets = apiTickets as unknown as DemoTicket[];
  const overview = botQuery.data ?? emptyBotOverview;
  const failureRows = overview.failures.length > 0 ? (overview.failures as unknown as DemoTicket[]) : tickets.filter((ticket) => ticket.botFallback);
  const totalMixMessages = overview.messageMix.reduce((sum, entry) => sum + entry.value, 0);

  function openBotSlice(title: string, rows: DemoTicket[], label: string) {
    setDrawer({
      title,
      description: `${rows.length} conversas encontradas para investigar falha, abandono ou transferencia do bot.`,
      rows,
      filters: [{ label: 'Recorte', value: label }, { label: 'Fonte', value: usingApi ? 'API real' : 'API indisponivel' }],
    });
  }

  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 shadow-panel">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Inteligencia do bot</p>
          <h2 className="mt-3 text-2xl font-semibold text-card-foreground">Bot</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Acompanhe onde o bot transferiu para humano, quais fluxos geraram abandono e quais perguntas precisam virar melhoria de automacao.
          </p>
          <p className="mt-4 text-xs font-semibold text-primary">
            Fonte: {botQuery.isLoading || ticketsQuery.isLoading ? 'Carregando API' : botQuery.isError || ticketsQuery.isError ? 'API indisponivel' : 'Conectado a API real'}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Taxa de fallback"
            value={`${overview.fallbackRate}%`}
            detail="Conversas transferidas para humano"
            tone="warning"
            icon={Bot}
            onClick={() => openBotSlice('Fallback do bot', failureRows, 'Transferencia para humano')}
          />
          <MetricCard
            label="Pedidos de humano"
            value={String(overview.humanRequests)}
            detail="Atendimentos que sairam do fluxo"
            tone="info"
            icon={UserRoundCheck}
            onClick={() => openBotSlice('Pedidos de humano', failureRows, 'Cliente pediu humano')}
          />
          <MetricCard
            label="Fluxos abandonados"
            value={String(overview.abandonedFlows)}
            detail="Conversas com abandono ou sem solucao"
            tone="danger"
            icon={Route}
            onClick={() => openBotSlice('Fluxos abandonados', tickets.filter((ticket) => ticket.botFallback && ticket.unresolved), 'Abandono')}
          />
          <MetricCard
            label="Nao entendidas"
            value={String(overview.misunderstoodQuestions)}
            detail="Perguntas que precisam de treino"
            tone="warning"
            icon={HelpCircle}
            onClick={() => openBotSlice('Perguntas nao entendidas', failureRows.filter((ticket) => hasAnyTag(ticket, ['boleto', 'entrega'])), 'Nao entendido')}
          />
        </div>

        <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-card-foreground">Bot vs humano</h3>
              <p className="text-sm text-muted-foreground">
                Baseado no autor real de cada mensagem coletada, nao em estimativa.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-2xl font-semibold text-card-foreground">{overview.botContainmentRate}%</p>
                <p className="text-xs text-muted-foreground">Contidos so pelo bot</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-card-foreground">{overview.humanHandledTickets}</p>
                <p className="text-xs text-muted-foreground">Atendidos por humano</p>
              </div>
            </div>
          </div>
          {totalMixMessages > 0 ? (
            <div className="space-y-3">
              {overview.messageMix.map((entry) => {
                const share = Math.round((entry.value / totalMixMessages) * 100);

                return (
                  <div key={entry.authorType}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-card-foreground">{entry.label}</span>
                      <span className="text-muted-foreground">
                        {entry.value.toLocaleString('pt-BR')} · {share}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className={cn('h-2 rounded-full', authorBarStyles[entry.authorType])}
                        style={{ width: `${Math.max(share, entry.value > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border bg-secondary p-4 text-sm leading-6 text-muted-foreground">
              Sincronize o BLiP para medir a divisao real entre mensagens de bot e de atendentes humanos.
            </p>
          )}
        </section>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-card-foreground">Fluxos com atencao</h3>
              <p className="text-sm text-muted-foreground">Clique no fluxo para ver as conversas que explicam a taxa.</p>
            </div>
            <DataTable
              data={overview.flows}
              columns={flowColumns}
              getSearchValue={(flow) => `${flow.name} ${flow.total} ${flow.fallback}`}
              searchPlaceholder="Buscar fluxo"
              onRowClick={(flow) => openBotSlice(`Fluxo ${flow.name}`, getRowsForFlow(flow.name, tickets), flow.name)}
            />
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
              <div>
                <h3 className="text-base font-semibold text-card-foreground">Conversas que o bot nao resolveu</h3>
                <p className="text-sm text-muted-foreground">Lista auditavel para backlog de melhoria do bot.</p>
              </div>
            </div>
            <DataTable
              data={failureRows}
              columns={ticketColumns}
              getSearchValue={getTicketSearchValue}
              searchPlaceholder="Buscar conversa, tag ou cliente"
              onRowClick={(ticket) => setDetail({ ticket, contextLabel: 'Bot' })}
            />
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
        onRowClick={(ticket) => setDetail({ ticket, contextLabel: drawer?.title ?? 'Bot' })}
      />
      <TicketDetailDrawer
        ticket={detail?.ticket ?? null}
        contextLabel={detail?.contextLabel}
        onClose={() => setDetail(null)}
      />
    </DashboardShell>
  );
}

function getRowsForFlow(flow: string, tickets: DemoTicket[]) {
  const normalized = flow.toLowerCase();

  if (normalized.includes('boleto')) {
    return tickets.filter((ticket) => ticket.subject.toLowerCase().includes('boleto') || hasAnyTag(ticket, ['boleto']));
  }

  if (normalized.includes('entrega')) {
    return tickets.filter((ticket) => hasAnyTag(ticket, ['entrega']) || ticket.subject.toLowerCase().includes('entrega'));
  }

  if (normalized.includes('comercial')) {
    return tickets.filter((ticket) => ticket.isOpportunity || ticket.queue === 'Comercial');
  }

  return tickets.filter((ticket) => ticket.queue.toLowerCase() === normalized);
}

function hasAnyTag(ticket: DemoTicket, tags: string[]) {
  const normalizedTags = ticket.tags.map((tag) => tag.toLowerCase());

  return tags.some((tag) => normalizedTags.includes(tag));
}
