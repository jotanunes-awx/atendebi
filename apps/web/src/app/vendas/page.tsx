'use client';

import { ClockAlert, FileText, Percent, ShoppingCart, Target, TrendingDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { DataTable } from '@/components/data-table';
import { DrilldownDrawer } from '@/components/drilldown-drawer';
import { MetricCard } from '@/components/metric-card';
import { TicketDetailDrawer } from '@/components/ticket-detail-drawer';
import { ticketColumns, getTicketSearchValue } from '@/components/ticket-columns';
import { getSalesOverview, getTickets, type SalesOverview } from '@/lib/api-client';
import { demoTickets, type DemoTicket } from '@/lib/demo-data';

type SalesDrawer = {
  title: string;
  description: string;
  rows: DemoTicket[];
  filters: Array<{ label: string; value: string }>;
};

export default function VendasPage() {
  const [drawer, setDrawer] = useState<SalesDrawer | null>(null);
  const [detail, setDetail] = useState<{ ticket: DemoTicket; contextLabel: string } | null>(null);
  const salesQuery = useQuery({
    queryKey: ['sales-overview'],
    queryFn: getSalesOverview,
  });
  const ticketsQuery = useQuery({
    queryKey: ['sales-tickets'],
    queryFn: () => getTickets({ pageSize: 200 }),
  });

  const apiTickets = ticketsQuery.data?.data ?? [];
  const usingApi = !salesQuery.isError && !ticketsQuery.isError && Boolean(salesQuery.data);
  const tickets = apiTickets.length > 0 ? (apiTickets as unknown as DemoTicket[]) : demoTickets;
  const overview = salesQuery.data ?? buildFallbackSalesOverview(demoTickets);
  const opportunityRows = overview.tickets.length > 0 ? (overview.tickets as unknown as DemoTicket[]) : tickets.filter((ticket) => ticket.isOpportunity);
  const proposalRows = tickets.filter((ticket) => ticket.isOpportunity && hasAnyTag(ticket, ['proposta']));
  const conversionRows = tickets.filter((ticket) => ticket.isOpportunity && ticket.status === 'CLOSED' && ticket.rating >= 4);
  const lostRows = tickets.filter((ticket) => ticket.isOpportunity && (ticket.firstResponseMinutes >= 8 || ticket.unresolved));

  function openSalesSlice(title: string, rows: DemoTicket[], label: string) {
    setDrawer({
      title,
      description: `${rows.length} conversas comerciais encontradas para investigar oportunidade, proposta, conversao ou perda.`,
      rows,
      filters: [{ label: 'Recorte', value: label }, { label: 'Fonte', value: usingApi ? 'API real' : 'Fallback local' }],
    });
  }

  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 shadow-panel">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Inteligencia comercial</p>
          <h2 className="mt-3 text-2xl font-semibold text-card-foreground">Vendas</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Encontre conversas com intencao de compra, propostas solicitadas e perdas por demora sem transformar o AtendeBI em CRM.
          </p>
          <p className="mt-4 text-xs font-semibold text-primary">
            Fonte: {usingApi ? 'Conectado a API real' : salesQuery.isLoading || ticketsQuery.isLoading ? 'Carregando API' : 'Usando fallback local'}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Oportunidades"
            value={String(overview.opportunities)}
            detail="Conversas com sinal de compra"
            tone="success"
            icon={Target}
            onClick={() => openSalesSlice('Oportunidades detectadas', opportunityRows, 'Sinal de compra')}
          />
          <MetricCard
            label="Leads ativos"
            value={String(overview.leads)}
            detail="Abertos ou pendentes"
            tone="info"
            icon={ShoppingCart}
            onClick={() => openSalesSlice('Leads ativos', opportunityRows.filter((ticket) => ['OPEN', 'PENDING'].includes(ticket.status)), 'Leads ativos')}
          />
          <MetricCard
            label="Propostas"
            value={String(overview.proposals)}
            detail="Pedidos de proposta"
            tone="neutral"
            icon={FileText}
            onClick={() => openSalesSlice('Propostas solicitadas', proposalRows, 'Proposta')}
          />
          <MetricCard
            label="Conversoes"
            value={String(overview.simulatedConversions)}
            detail="Conversao simulada por fechamento"
            tone="success"
            icon={Percent}
            onClick={() => openSalesSlice('Conversoes simuladas', conversionRows, 'Conversao simulada')}
          />
          <MetricCard
            label="Perdas por demora"
            value={String(overview.lostByDelay)}
            detail="Oportunidades com atraso ou sem solucao"
            tone="danger"
            icon={TrendingDown}
            onClick={() => openSalesSlice('Perdas por demora', lostRows, 'Demora comercial')}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-card-foreground">Conversas com intencao de compra</h3>
              <p className="text-sm text-muted-foreground">Clique em uma oportunidade para abrir o historico e entender o proximo passo.</p>
            </div>
            <DataTable
              data={opportunityRows}
              columns={ticketColumns}
              getSearchValue={getTicketSearchValue}
              searchPlaceholder="Buscar cliente, proposta, produto ou atendente"
              onRowClick={(ticket) => setDetail({ ticket, contextLabel: 'Vendas' })}
            />
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
            <div className="mb-4 flex items-start gap-2">
              <ClockAlert className="mt-0.5 h-4 w-4 text-warning" aria-hidden="true" />
              <div>
                <h3 className="text-base font-semibold text-card-foreground">Acoes comerciais sugeridas</h3>
                <p className="text-sm text-muted-foreground">Recortes operacionais para gestao, sem disparo de campanha.</p>
              </div>
            </div>
            <div className="space-y-3">
              <ActionCard
                title="Priorizar leads pendentes"
                description="Conversas com intencao de compra que ainda estao abertas ou pendentes."
                rows={opportunityRows.filter((ticket) => ['OPEN', 'PENDING'].includes(ticket.status))}
                onOpen={openSalesSlice}
              />
              <ActionCard
                title="Revisar perdas por demora"
                description="Oportunidades com primeira resposta alta ou sem solucao clara."
                rows={lostRows}
                onOpen={openSalesSlice}
              />
              <ActionCard
                title="Auditar propostas sem fechamento"
                description="Tickets com proposta, mas sem fechamento positivo registrado."
                rows={proposalRows.filter((ticket) => ticket.status !== 'CLOSED' || ticket.rating < 4)}
                onOpen={openSalesSlice}
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
        onRowClick={(ticket) => setDetail({ ticket, contextLabel: drawer?.title ?? 'Vendas' })}
      />
      <TicketDetailDrawer
        ticket={detail?.ticket ?? null}
        contextLabel={detail?.contextLabel}
        onClose={() => setDetail(null)}
      />
    </DashboardShell>
  );
}

function ActionCard({
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
      className="w-full rounded-md border border-border bg-secondary p-3 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onOpen(title, rows, title)}
    >
      <span className="block font-medium text-card-foreground">{title}</span>
      <span className="mt-1 block text-sm leading-6 text-muted-foreground">{description}</span>
      <span className="mt-2 block text-xs font-semibold text-primary">{rows.length} tickets relacionados</span>
    </button>
  );
}

function buildFallbackSalesOverview(tickets: DemoTicket[]): SalesOverview {
  const opportunities = tickets.filter((ticket) => ticket.isOpportunity);
  const proposals = opportunities.filter((ticket) => hasAnyTag(ticket, ['proposta']));
  const lostByDelay = opportunities.filter((ticket) => ticket.firstResponseMinutes >= 8 || ticket.unresolved);

  return {
    opportunities: opportunities.length,
    leads: opportunities.filter((ticket) => ['OPEN', 'PENDING'].includes(ticket.status)).length,
    proposals: proposals.length,
    simulatedConversions: opportunities.filter((ticket) => ticket.status === 'CLOSED' && ticket.rating >= 4).length,
    lostByDelay: lostByDelay.length,
    tickets: opportunities,
  };
}

function hasAnyTag(ticket: DemoTicket, tags: string[]) {
  const normalizedTags = ticket.tags.map((tag) => tag.toLowerCase());

  return tags.some((tag) => normalizedTags.includes(tag));
}
