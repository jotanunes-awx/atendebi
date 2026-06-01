'use client';

import { AlertTriangle, Clock3, Inbox, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { DashboardShell } from '@/components/dashboard-shell';
import { DrilldownDrawer } from '@/components/drilldown-drawer';
import { RiskBadge } from '@/components/risk-badge';
import { TicketDetailDrawer } from '@/components/ticket-detail-drawer';
import { ticketColumns, getTicketSearchValue } from '@/components/ticket-columns';
import { getQueue, getQueues, type QueueItem } from '@/lib/api-client';
import type { DemoTicket } from '@/lib/demo-data';

type QueueMetric = {
  id: string;
  name: string;
  openTickets: number;
  averageWaitMinutes: number;
  averageRating: number;
  riskTickets: number;
  owner: string;
  tickets?: DemoTicket[];
};

const queueColumns: DataTableColumn<QueueMetric>[] = [
  {
    key: 'name',
    header: 'Fila',
    accessor: (queue) => <span className="font-semibold text-card-foreground">{queue.name}</span>,
  },
  {
    key: 'open',
    header: 'Abertos',
    accessor: (queue) => <span className="font-semibold text-card-foreground">{queue.openTickets}</span>,
  },
  {
    key: 'wait',
    header: 'Espera',
    accessor: (queue) => `${queue.averageWaitMinutes.toFixed(1).replace('.', ',')} min`,
  },
  {
    key: 'rating',
    header: 'Nota',
    accessor: (queue) => formatAverageRating(queue.averageRating),
  },
  {
    key: 'risk',
    header: 'Risco',
    accessor: (queue) => <RiskBadge risk={queue.riskTickets >= 8 ? 'alto' : queue.riskTickets >= 4 ? 'medio' : 'baixo'} />,
  },
  {
    key: 'owner',
    header: 'Responsavel',
    accessor: (queue) => queue.owner,
  },
];

export default function FilasPage() {
  const [drawer, setDrawer] = useState<{ queue: QueueMetric; rows: DemoTicket[] } | null>(null);
  const [detail, setDetail] = useState<{ ticket: DemoTicket; contextLabel: string } | null>(null);
  const queuesQuery = useQuery({
    queryKey: ['queues'],
    queryFn: getQueues,
  });

  const apiQueues = queuesQuery.data?.data ?? [];
  const usingApi = !queuesQuery.isError;
  const queues = apiQueues.map(mapQueue);
  const queueDetailQuery = useQuery({
    queryKey: ['queue-detail', drawer?.queue.id],
    queryFn: () => getQueue(drawer?.queue.id ?? ''),
    enabled: Boolean(drawer?.queue.id && usingApi),
  });

  function openQueue(queue: QueueMetric) {
    setDrawer({ queue, rows: queue.tickets ?? [] });
  }

  const drawerRows =
    usingApi && queueDetailQuery.data?.tickets
      ? (queueDetailQuery.data.tickets as unknown as DemoTicket[])
      : drawer?.rows ?? [];
  const detailAgents = queueDetailQuery.data?.agents?.map((agent) => `${agent.name} (${agent.openTickets})`).join(', ');

  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 shadow-panel">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Operacao por fila</p>
          <h2 className="mt-3 text-2xl font-semibold text-card-foreground">Filas</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Cada fila agora abre a lista de tickets, riscos, responsavel e gargalos. Clique no numero de abertos ou na linha da tabela para detalhar.
          </p>
          <p className="mt-4 text-xs font-semibold text-primary">
            Fonte: {queuesQuery.isLoading ? 'Carregando API' : queuesQuery.isError ? 'API indisponivel' : 'Conectado a API real'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {queues.map((queue) => (
            <button
              key={queue.id}
              type="button"
              className="rounded-lg border border-border bg-card p-4 text-left shadow-panel transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => openQueue(queue)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-card-foreground">{queue.name}</p>
                  <p className="text-xs text-muted-foreground">{queue.owner}</p>
                </div>
                <Inbox className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-card-foreground">{queue.openTickets}</p>
              <p className="mt-1 text-xs text-muted-foreground">tickets abertos</p>
              <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {queue.averageWaitMinutes.toFixed(1).replace('.', ',')} min espera
                </span>
                <span className="flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                  {formatAverageRating(queue.averageRating)}
                </span>
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                  {queue.riskTickets} em risco
                </span>
              </div>
            </button>
          ))}
          {!queuesQuery.isLoading && queues.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-5 text-sm leading-6 text-muted-foreground shadow-panel xl:col-span-5">
              Nenhuma fila sincronizada ainda. Depois do sync do GLPI, as categorias/filas reais aparecerao aqui.
            </div>
          ) : null}
        </div>

        <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-card-foreground">Tabela de filas</h3>
            <p className="text-sm text-muted-foreground">Busca, ranking e clique para abrir os tickets da fila.</p>
          </div>
          <DataTable
            data={queues}
            columns={queueColumns}
            getSearchValue={(queue) => `${queue.name} ${queue.owner}`}
            searchPlaceholder="Buscar fila ou responsavel"
            onRowClick={openQueue}
          />
        </section>
      </section>

      <DrilldownDrawer
        open={Boolean(drawer)}
        title={drawer ? `Fila ${drawer.queue.name}` : ''}
        description={
          drawer
            ? `${drawer.queue.openTickets} tickets abertos, espera media de ${drawer.queue.averageWaitMinutes.toFixed(1).replace('.', ',')} minutos e ${drawer.queue.riskTickets} casos em risco.${detailAgents ? ` Atendentes: ${detailAgents}.` : ''}`
            : ''
        }
        filters={drawer ? [{ label: 'Fila', value: drawer.queue.name }, { label: 'Fonte', value: usingApi ? 'API real' : 'API indisponivel' }] : []}
        rows={drawerRows}
        columns={ticketColumns}
        getSearchValue={getTicketSearchValue}
        onClose={() => setDrawer(null)}
        onRowClick={(ticket) => setDetail({ ticket, contextLabel: drawer ? `Fila ${drawer.queue.name}` : 'Filas' })}
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
  return value > 0 ? `${value.toFixed(1).replace('.', ',')} nota media` : 'Sem avaliacoes';
}

function mapQueue(queue: QueueItem): QueueMetric {
  return {
    id: queue.id,
    name: queue.name,
    openTickets: queue.openTickets,
    averageWaitMinutes: queue.averageWaitMinutes,
    averageRating: queue.averageRating,
    riskTickets: queue.riskTickets,
    owner: queue.agents?.[0]?.name ?? 'Responsavel operacional',
    tickets: queue.tickets as DemoTicket[] | undefined,
  };
}
