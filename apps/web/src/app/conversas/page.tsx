'use client';

import { Copy, Download, Filter, MessageSquareText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ConversationTimeline } from '@/components/conversation-timeline';
import { DataTable } from '@/components/data-table';
import { DashboardShell } from '@/components/dashboard-shell';
import { RiskBadge } from '@/components/risk-badge';
import { SentimentBadge } from '@/components/sentiment-badge';
import { StatusBadge } from '@/components/status-badge';
import { TicketDetailDrawer } from '@/components/ticket-detail-drawer';
import { Button } from '@/components/ui/button';
import { ticketColumns, getTicketSearchValue, formatDateTime, formatRatingLabel } from '@/components/ticket-columns';
import { getConversationMessages, getTickets } from '@/lib/api-client';
import type { DemoTicket } from '@/lib/demo-data';

const allStatuses = ['Todos', 'OPEN', 'PENDING', 'CLOSED', 'CANCELED'];
const allSentiments = ['Todos', 'positivo', 'neutro', 'negativo'];
const periodOptions = ['active', '24h', '7d', '30d', '90d', '12m', 'all'];

export default function ConversasPage() {
  const [queue, setQueue] = useState('Todas');
  const [agent, setAgent] = useState('Todos');
  const [period, setPeriod] = useState('active');
  const [status, setStatus] = useState('Todos');
  const [sentiment, setSentiment] = useState('Todos');
  const [channel, setChannel] = useState('Todos');
  const [group, setGroup] = useState('Todos');
  const [tag, setTag] = useState('Todas');
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [detailTicket, setDetailTicket] = useState<DemoTicket | null>(null);
  const [copied, setCopied] = useState(false);

  const ticketsQuery = useQuery({
    queryKey: ['conversation-tickets', period, status],
    queryFn: () =>
      getTickets({
        pageSize: 300,
        period,
        status: status === 'Todos' ? undefined : status,
      }),
  });

  const apiTickets = ticketsQuery.data?.data ?? [];
  const usingApi = !ticketsQuery.isError;
  const tickets = useMemo(() => apiTickets as unknown as DemoTicket[], [apiTickets]);

  const allQueues = useMemo(() => ['Todas', ...Array.from(new Set(tickets.map((ticket) => ticket.queue)))], [tickets]);
  const allAgents = useMemo(() => ['Todos', ...Array.from(new Set(tickets.map((ticket) => ticket.agent)))], [tickets]);
  const allChannels = useMemo(() => ['Todos', ...Array.from(new Set(tickets.map((ticket) => ticket.channel)))], [tickets]);
  const allGroups = useMemo(() => ['Todos', ...Array.from(new Set(tickets.map((ticket) => ticket.group)))], [tickets]);
  const allTags = useMemo(() => ['Todas', ...Array.from(new Set(tickets.flatMap((ticket) => ticket.tags)))], [tickets]);

  useEffect(() => {
    const ticketFromUrl = new URLSearchParams(window.location.search).get('ticket');

    if (ticketFromUrl) {
      setSelectedTicketId(ticketFromUrl);
    }
  }, []);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      return (
        (queue === 'Todas' || ticket.queue === queue) &&
        (agent === 'Todos' || ticket.agent === agent) &&
        (status === 'Todos' || ticket.status === status) &&
        (sentiment === 'Todos' || ticket.sentiment === sentiment) &&
        (channel === 'Todos' || ticket.channel === channel) &&
        (group === 'Todos' || ticket.group === group) &&
        (tag === 'Todas' || ticket.tags.includes(tag))
      );
    });
  }, [agent, channel, group, queue, sentiment, status, tag, tickets]);

  useEffect(() => {
    if (filteredTickets.length > 0 && !filteredTickets.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(filteredTickets[0].id);
    }
  }, [filteredTickets, selectedTicketId]);

  const selectedTicket =
    filteredTickets.find((ticket) => ticket.id === selectedTicketId) ??
    tickets.find((ticket) => ticket.id === selectedTicketId) ??
    filteredTickets[0] ??
    tickets[0];

  const messagesQuery = useQuery({
    queryKey: ['conversation-messages', selectedTicket?.id],
    queryFn: () => getConversationMessages(selectedTicket?.id ?? ''),
    enabled: Boolean(selectedTicket?.id && usingApi),
  });

  const messages = messagesQuery.data?.data ?? [];

  async function copyConversationLink(ticket: DemoTicket) {
    setCopied(true);
    await navigator.clipboard?.writeText(`${window.location.origin}/conversas?ticket=${ticket.id}`);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 shadow-panel">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Auditoria de conversas</p>
          <h2 className="mt-3 text-2xl font-semibold text-card-foreground">Conversas</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Pesquise por cliente, telefone, ticket, fila, canal, grupo, tag ou sentimento. Ao clicar, a timeline completa fica aberta ao lado.
          </p>
          <p className="mt-4 text-xs font-semibold text-primary">
            Fonte: {ticketsQuery.isLoading ? 'Carregando API' : ticketsQuery.isError ? 'API indisponivel' : 'Conectado a API real'}
          </p>
        </div>

        <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <Filter className="h-4 w-4 text-primary" aria-hidden="true" />
            Filtros de investigacao
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <FilterSelect label="Periodo" value={period} values={periodOptions} onChange={setPeriod} />
            <FilterSelect label="Fila" value={queue} values={allQueues} onChange={setQueue} />
            <FilterSelect label="Atendente" value={agent} values={allAgents} onChange={setAgent} />
            <FilterSelect label="Status" value={status} values={allStatuses} onChange={setStatus} />
            <FilterSelect label="Sentimento" value={sentiment} values={allSentiments} onChange={setSentiment} />
            <FilterSelect label="Canal" value={channel} values={allChannels} onChange={setChannel} />
            <FilterSelect label="Grupo" value={group} values={allGroups} onChange={setGroup} />
            <FilterSelect label="Tag" value={tag} values={allTags} onChange={setTag} />
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-card-foreground">Lista de conversas</h3>
                <p className="text-sm text-muted-foreground">{filteredTickets.length} conversas encontradas</p>
              </div>
              <Button variant="outline" type="button">
                <Download className="h-4 w-4" aria-hidden="true" />
                Exportar
              </Button>
            </div>
            <DataTable
              data={filteredTickets}
              columns={ticketColumns}
              getSearchValue={getTicketSearchValue}
              searchPlaceholder="Buscar cliente, telefone, ticket, tag ou assunto"
              onRowClick={(ticket) => setSelectedTicketId(ticket.id)}
            />
          </section>

          <section className="rounded-lg border border-border bg-card shadow-panel">
            {selectedTicket ? (
              <>
                <div className="border-b border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{selectedTicket.id}</p>
                      <h3 className="mt-2 text-xl font-semibold text-card-foreground">{selectedTicket.customerName}</h3>
                      <p className="text-sm text-muted-foreground">{selectedTicket.customerContact}</p>
                    </div>
                    <StatusBadge status={selectedTicket.status} />
                  </div>

                  <p className="mt-4 text-sm leading-6 text-muted-foreground">{selectedTicket.summary}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning">
                      {formatRatingLabel(selectedTicket.rating)}
                    </span>
                    <SentimentBadge sentiment={selectedTicket.sentiment} />
                    <RiskBadge risk={selectedTicket.risk} />
                    {selectedTicket.tags.map((ticketTag) => (
                      <span key={ticketTag} className="rounded-md border border-border bg-secondary px-2 py-1 text-xs text-muted-foreground">
                        {ticketTag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>Fila: <strong className="text-card-foreground">{selectedTicket.queue}</strong></span>
                    <span>Atendente: <strong className="text-card-foreground">{selectedTicket.agent}</strong></span>
                    <span>Canal: <strong className="text-card-foreground">{selectedTicket.channel}</strong></span>
                    <span>Grupo: <strong className="text-card-foreground">{selectedTicket.group}</strong></span>
                    <span>Ultima msg: <strong className="text-card-foreground">{formatDateTime(selectedTicket.lastMessageAt)}</strong></span>
                    <span>Mensagens: <strong className="text-card-foreground">{messages.length}</strong></span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" onClick={() => copyConversationLink(selectedTicket)}>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      {copied ? 'Copiado' : 'Copiar link'}
                    </Button>
                    <Button variant="outline" type="button">
                      <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                      Abrir auditoria
                    </Button>
                    <Button variant="outline" type="button" onClick={() => setDetailTicket(selectedTicket)}>
                      Ver detalhe completo
                    </Button>
                  </div>
                </div>
                <div className="max-h-[620px] overflow-auto p-4">
                  {messagesQuery.isLoading && usingApi ? (
                    <p className="mb-3 text-xs font-semibold text-primary">Carregando mensagens da API...</p>
                  ) : null}
                  <ConversationTimeline messages={messages} />
                </div>
              </>
            ) : (
              <div className="p-6 text-sm text-muted-foreground">Nenhuma conversa selecionada.</div>
            )}
          </section>
        </div>
      </section>

      <TicketDetailDrawer
        ticket={detailTicket}
        contextLabel="Conversas"
        onClose={() => setDetailTicket(null)}
      />
    </DashboardShell>
  );
}

function FilterSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
      >
        {values.map((item) => (
          <option key={item} value={item}>
            {filterValueLabel(item)}
          </option>
        ))}
      </select>
    </label>
  );
}

function filterValueLabel(value: string) {
  const labels: Record<string, string> = {
    active: 'Ativos agora',
    '24h': 'Ultimas 24h',
    '7d': 'Ultimos 7 dias',
    '30d': 'Ultimos 30 dias',
    '90d': 'Ultimos 90 dias',
    '12m': 'Ultimos 12 meses',
    all: 'Todo historico',
    OPEN: 'Aberto',
    PENDING: 'Pendente',
    CLOSED: 'Fechado',
    CANCELED: 'Cancelado',
  };

  return labels[value] ?? value;
}
