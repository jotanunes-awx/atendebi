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
import { demoTickets, type DemoTicket } from '@/lib/demo-data';

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
  const usingApi = !botQuery.isError && !ticketsQuery.isError && Boolean(botQuery.data);
  const tickets = apiTickets.length > 0 ? (apiTickets as unknown as DemoTicket[]) : demoTickets;
  const overview = botQuery.data ?? buildFallbackBotOverview(demoTickets);
  const failureRows = overview.failures.length > 0 ? (overview.failures as unknown as DemoTicket[]) : tickets.filter((ticket) => ticket.botFallback);

  function openBotSlice(title: string, rows: DemoTicket[], label: string) {
    setDrawer({
      title,
      description: `${rows.length} conversas encontradas para investigar falha, abandono ou transferencia do bot.`,
      rows,
      filters: [{ label: 'Recorte', value: label }, { label: 'Fonte', value: usingApi ? 'API real' : 'Fallback local' }],
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
            Fonte: {usingApi ? 'Conectado a API real' : botQuery.isLoading || ticketsQuery.isLoading ? 'Carregando API' : 'Usando fallback local'}
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

function buildFallbackBotOverview(tickets: DemoTicket[]): BotOverview {
  const failures = tickets.filter((ticket) => ticket.botFallback);
  const misunderstood = failures.filter((ticket) => hasAnyTag(ticket, ['boleto', 'entrega']));
  const abandoned = failures.filter((ticket) => ticket.unresolved);

  return {
    fallbackRate: tickets.length > 0 ? Math.round((failures.length / tickets.length) * 1000) / 10 : 0,
    humanRequests: failures.length,
    abandonedFlows: abandoned.length,
    misunderstoodQuestions: misunderstood.length,
    flows: buildFlows(tickets),
    failures,
  };
}

function buildFlows(tickets: DemoTicket[]): FlowRow[] {
  const counts = new Map<string, { total: number; fallback: number }>();

  for (const ticket of tickets) {
    const flow = ticket.subject.toLowerCase().includes('boleto')
      ? 'Financeiro/Boleto'
      : hasAnyTag(ticket, ['entrega'])
        ? 'Entrega'
        : ticket.isOpportunity
          ? 'Comercial'
          : ticket.queue;
    const current = counts.get(flow) ?? { total: 0, fallback: 0 };
    counts.set(flow, {
      total: current.total + 1,
      fallback: current.fallback + (ticket.botFallback ? 1 : 0),
    });
  }

  return Array.from(counts.entries()).map(([name, value]) => ({
    name,
    total: value.total,
    fallback: value.fallback,
    fallbackRate: value.total > 0 ? Math.round((value.fallback / value.total) * 100) : 0,
  }));
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
