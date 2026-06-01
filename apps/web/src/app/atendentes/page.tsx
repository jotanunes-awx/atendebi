'use client';

import { MessageSquareText, Star, Timer, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { DashboardShell } from '@/components/dashboard-shell';
import { DrilldownDrawer } from '@/components/drilldown-drawer';
import { TicketDetailDrawer } from '@/components/ticket-detail-drawer';
import { ticketColumns, getTicketSearchValue } from '@/components/ticket-columns';
import { getAgent, getAgents, type AgentItem } from '@/lib/api-client';
import type { DemoTicket } from '@/lib/demo-data';

type AgentMetric = {
  id: string;
  name: string;
  queue: string;
  ticketsHandled: number;
  openTickets: number;
  averageRating: number;
  resolutionRate: number;
  firstResponseMinutes: number;
  complaints: number;
  tickets?: DemoTicket[];
};

const agentColumns: DataTableColumn<AgentMetric>[] = [
  {
    key: 'agent',
    header: 'Atendente',
    accessor: (agent) => <span className="font-semibold text-card-foreground">{agent.name}</span>,
  },
  {
    key: 'queue',
    header: 'Fila',
    accessor: (agent) => agent.queue,
  },
  {
    key: 'open',
    header: 'Em aberto',
    accessor: (agent) => <span className="font-semibold text-card-foreground">{agent.openTickets}</span>,
  },
  {
    key: 'rating',
    header: 'Nota',
    accessor: (agent) => formatAverageRating(agent.averageRating),
  },
  {
    key: 'response',
    header: '1a resposta',
    accessor: (agent) => `${agent.firstResponseMinutes.toFixed(1).replace('.', ',')} min`,
  },
  {
    key: 'resolution',
    header: 'Resolucao',
    accessor: (agent) => `${agent.resolutionRate}%`,
  },
  {
    key: 'complaints',
    header: 'Reclamacoes',
    accessor: (agent) => agent.complaints,
  },
];

export default function AtendentesPage() {
  const [drawer, setDrawer] = useState<{ agent: AgentMetric; rows: DemoTicket[] } | null>(null);
  const [detail, setDetail] = useState<{ ticket: DemoTicket; contextLabel: string } | null>(null);
  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: getAgents,
  });

  const apiAgents = agentsQuery.data?.data ?? [];
  const usingApi = !agentsQuery.isError;
  const agents = apiAgents.map(mapAgent);
  const agentDetailQuery = useQuery({
    queryKey: ['agent-detail', drawer?.agent.id],
    queryFn: () => getAgent(drawer?.agent.id ?? ''),
    enabled: Boolean(drawer?.agent.id && usingApi),
  });

  function openAgent(agent: AgentMetric) {
    setDrawer({ agent, rows: agent.tickets ?? [] });
  }

  const drawerRows =
    usingApi && agentDetailQuery.data?.tickets
      ? (agentDetailQuery.data.tickets as unknown as DemoTicket[])
      : drawer?.rows ?? [];

  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 shadow-panel">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Performance individual</p>
          <h2 className="mt-3 text-2xl font-semibold text-card-foreground">Atendentes</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Clique em qualquer atendente para ver carteira, tickets abertos, historico recente, nota media e casos de risco.
          </p>
          <p className="mt-4 text-xs font-semibold text-primary">
            Fonte: {agentsQuery.isLoading ? 'Carregando API' : agentsQuery.isError ? 'API indisponivel' : 'Conectado a API real'}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className="rounded-lg border border-border bg-card p-4 text-left shadow-panel transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => openAgent(agent)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-card-foreground">{agent.name}</h3>
                  <p className="text-xs text-muted-foreground">{agent.queue}</p>
                </div>
                <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                  {agent.openTickets}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                <p className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                    Tickets
                  </span>
                  <span className="font-semibold text-card-foreground">{agent.ticketsHandled}</span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                    Nota
                  </span>
                  <span className="font-semibold text-card-foreground">{formatAverageRating(agent.averageRating)}</span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                    1a resposta
                  </span>
                  <span className="font-semibold text-card-foreground">{agent.firstResponseMinutes.toFixed(1).replace('.', ',')} min</span>
                </p>
              </div>
              <div className="mt-4 h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${agent.resolutionRate}%` }} />
              </div>
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                {agent.resolutionRate}% resolucao
              </p>
            </button>
          ))}
          {!agentsQuery.isLoading && agents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-5 text-sm leading-6 text-muted-foreground shadow-panel xl:col-span-5">
              Nenhum atendente/tecnico sincronizado ainda. Quando o GLPI trouxer responsaveis ou o Teams trouxer agentes, eles aparecerao aqui.
            </div>
          ) : null}
        </div>

        <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-card-foreground">Tabela de atendentes</h3>
            <p className="text-sm text-muted-foreground">Ranking com busca e detalhe da carteira de cada pessoa.</p>
          </div>
          <DataTable
            data={agents}
            columns={agentColumns}
            getSearchValue={(agent) => `${agent.name} ${agent.queue}`}
            searchPlaceholder="Buscar atendente ou fila"
            onRowClick={openAgent}
          />
        </section>
      </section>

      <DrilldownDrawer
        open={Boolean(drawer)}
        title={drawer ? drawer.agent.name : ''}
        description={
          drawer
            ? `${drawer.agent.openTickets} tickets em aberto, ${formatAverageRating(drawer.agent.averageRating).toLowerCase()} e ${drawer.agent.complaints} reclamacoes associadas.`
            : ''
        }
        filters={drawer ? [{ label: 'Atendente', value: drawer.agent.name }, { label: 'Fonte', value: usingApi ? 'API real' : 'API indisponivel' }] : []}
        rows={drawerRows}
        columns={ticketColumns}
        getSearchValue={getTicketSearchValue}
        onClose={() => setDrawer(null)}
        onRowClick={(ticket) => setDetail({ ticket, contextLabel: drawer ? `Atendente ${drawer.agent.name}` : 'Atendentes' })}
      />
      <TicketDetailDrawer
        ticket={detail?.ticket ?? null}
        contextLabel={detail?.contextLabel}
        onClose={() => setDetail(null)}
      />
    </DashboardShell>
  );
}

function formatAverageRating(value: number) {
  return value > 0 ? `${value.toFixed(1).replace('.', ',')} nota media` : 'sem avaliacoes';
}

function mapAgent(agent: AgentItem): AgentMetric {
  return {
    id: agent.id,
    name: agent.name,
    queue: agent.queue,
    ticketsHandled: agent.ticketsHandled,
    openTickets: agent.openTickets,
    averageRating: agent.averageRating,
    resolutionRate: agent.resolutionRate,
    firstResponseMinutes: agent.firstResponseMinutes,
    complaints: agent.complaints,
    tickets: agent.tickets as DemoTicket[] | undefined,
  };
}
