'use client';

import { Copy, Download, Filter, MessageSquareText, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ConversationTimeline } from '@/components/conversation-timeline';
import { DashboardShell } from '@/components/dashboard-shell';
import { RiskBadge } from '@/components/risk-badge';
import { SentimentBadge } from '@/components/sentiment-badge';
import { StatusBadge } from '@/components/status-badge';
import { TicketDetailDrawer } from '@/components/ticket-detail-drawer';
import { Button } from '@/components/ui/button';
import {
  formatDateTime,
  formatRatingLabel,
  getTicketDisplayId,
  getTicketProvider,
  getTicketProviderLabel,
  getTicketSearchValue,
} from '@/components/ticket-columns';
import { getConversationMessages, getTickets } from '@/lib/api-client';
import {
  filterTicketsByExperience,
  getUserExperience,
  providerFilterValue,
  providerLabels,
  providerShortLabels,
  type ProviderScope,
} from '@/lib/access-control';
import { useAuth } from '@/lib/auth';
import type { DemoTicket } from '@/lib/demo-data';

const allStatuses = ['Todos', 'OPEN', 'PENDING', 'CLOSED', 'CANCELED'];
const allSentiments = ['Todos', 'positivo', 'neutro', 'negativo'];
const periodOptions = ['active', '24h', '7d', '30d', '90d', '12m', 'all'];

export default function ConversasPage() {
  const { user } = useAuth();
  const experience = useMemo(() => getUserExperience(user), [user]);
  const [queue, setQueue] = useState('Todas');
  const [agent, setAgent] = useState('Todos');
  const [period, setPeriod] = useState('active');
  const [status, setStatus] = useState('Todos');
  const [sentiment, setSentiment] = useState('Todos');
  const [source, setSource] = useState<ProviderScope | 'Todos'>('Todos');
  const [channel, setChannel] = useState('Todos');
  const [group, setGroup] = useState('Todos');
  const [tag, setTag] = useState('Todas');
  const [search, setSearch] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [detailTicket, setDetailTicket] = useState<DemoTicket | null>(null);
  const [copied, setCopied] = useState(false);

  const ticketsQuery = useQuery({
    queryKey: ['conversation-tickets', period, status, source, experience.allowedProviders.join(',')],
    queryFn: () =>
      getTickets({
        pageSize: 300,
        period,
        provider: providerFilterValue(source, experience),
        status: status === 'Todos' ? undefined : status,
      }),
  });

  const apiTickets = ticketsQuery.data?.data ?? [];
  const usingApi = !ticketsQuery.isError;
  const tickets = useMemo(
    () => filterTicketsByExperience(apiTickets as unknown as DemoTicket[], experience),
    [apiTickets, experience],
  );

  const allQueues = useMemo(() => ['Todas', ...Array.from(new Set(tickets.map((ticket) => ticket.queue)))], [tickets]);
  const allAgents = useMemo(() => ['Todos', ...Array.from(new Set(tickets.map((ticket) => ticket.agent)))], [tickets]);
  const allSources = useMemo(() => ['Todos', ...experience.allowedProviders], [experience.allowedProviders]);
  const allChannels = useMemo(() => ['Todos', ...Array.from(new Set(tickets.map((ticket) => ticket.channel)))], [tickets]);
  const allGroups = useMemo(() => ['Todos', ...Array.from(new Set(tickets.map((ticket) => ticket.group)))], [tickets]);
  const allTags = useMemo(() => ['Todas', ...Array.from(new Set(tickets.flatMap((ticket) => ticket.tags)))], [tickets]);
  const sourceCards = useMemo(() => {
    return allSources
      .filter((item) => item !== 'Todos')
      .map((item) => ({
        provider: item,
        label: providerFilterLabel(item),
        count: tickets.filter((ticket) => getTicketProvider(ticket) === item).length,
      }));
  }, [allSources, tickets]);

  useEffect(() => {
    if (source !== 'Todos' && !experience.allowedProviders.includes(source)) {
      setSource('Todos');
    }
  }, [experience.allowedProviders, source]);

  useEffect(() => {
    const ticketFromUrl = new URLSearchParams(window.location.search).get('ticket');

    if (ticketFromUrl) {
      setSelectedTicketId(ticketFromUrl);
    }
  }, []);

  const filteredTickets = useMemo(() => {
    const searchTerm = normalizeSearch(search);

    return tickets.filter((ticket) => {
      const searchable = normalizeSearch(`${getTicketSearchValue(ticket)} ${getTicketDisplayId(ticket)}`);

      return (
        (queue === 'Todas' || ticket.queue === queue) &&
        (agent === 'Todos' || ticket.agent === agent) &&
        (status === 'Todos' || ticket.status === status) &&
        (sentiment === 'Todos' || ticket.sentiment === sentiment) &&
        (source === 'Todos' || getTicketProvider(ticket) === source) &&
        (channel === 'Todos' || ticket.channel === channel) &&
        (group === 'Todos' || ticket.group === group) &&
        (tag === 'Todas' || ticket.tags.includes(tag)) &&
        (!searchTerm || searchable.includes(searchTerm))
      );
    });
  }, [agent, channel, group, queue, search, sentiment, source, status, tag, tickets]);

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
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Historico de atendimento</p>
          <h2 className="mt-3 text-2xl font-semibold text-card-foreground">Conversas e chamados</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Encontre rapidamente uma pessoa, assunto, fila ou atendimento. Ao clicar, a conversa aparece ao lado em formato de linha do tempo.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {experience.allowedProviders.map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => setSource(provider)}
                className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  source === provider ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground hover:bg-primary/10'
                }`}
              >
                <span className="font-semibold">{providerShortLabels[provider]}</span>
                <span className="ml-2 text-xs">{providerLabels[provider]}</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold text-primary">
            Dados: {ticketsQuery.isLoading ? 'Carregando API' : ticketsQuery.isError ? 'API indisponivel' : 'Conectado a API real'}
          </p>
        </div>

        <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <Filter className="h-4 w-4 text-primary" aria-hidden="true" />
            Encontrar atendimento
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-9">
            <FilterSelect label="Periodo" value={period} values={periodOptions} onChange={setPeriod} />
            <FilterSelect label="Origem" value={source} values={allSources} onChange={(value) => setSource(value as ProviderScope | 'Todos')} />
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
          <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-panel">
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

            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              {sourceCards.map((item) => (
                <button
                  key={item.provider}
                  type="button"
                  onClick={() => setSource(item.provider as ProviderScope)}
                  className={`rounded-lg border px-3 py-2 text-left transition hover:border-primary/60 ${
                    source === item.provider ? 'border-primary bg-primary/10' : 'border-border bg-secondary/40'
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Origem</p>
                  <p className="mt-1 text-sm font-semibold text-card-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.count} registros</p>
                </button>
              ))}
            </div>

            <ConversationSearch value={search} onChange={setSearch} />
            <ConversationList
              tickets={filteredTickets}
              selectedTicketId={selectedTicket?.id}
              onSelect={(ticket) => setSelectedTicketId(ticket.id)}
            />
          </section>

          <section className="min-w-0 rounded-lg border border-border bg-card shadow-panel">
            {selectedTicket ? (
              <>
                <div className="border-b border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        {getTicketProviderLabel(selectedTicket)} / {getTicketDisplayId(selectedTicket)}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-card-foreground">{selectedTicket.customerName}</h3>
                      <p className="break-words text-sm text-muted-foreground">{selectedTicket.customerContact}</p>
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
                    <span>Origem: <strong className="text-card-foreground">{getTicketProviderLabel(selectedTicket)}</strong></span>
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

function ConversationSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="mb-3 flex h-11 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground">
      <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar cliente, telefone, ticket, origem, tag ou assunto"
        className="h-full min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

function ConversationList({
  tickets,
  selectedTicketId,
  onSelect,
}: {
  tickets: DemoTicket[];
  selectedTicketId?: string;
  onSelect: (ticket: DemoTicket) => void;
}) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
        Nenhuma conversa encontrada com os filtros atuais.
      </div>
    );
  }

  return (
    <div className="max-h-[700px] space-y-3 overflow-y-auto pr-1">
      {tickets.map((ticket) => {
        const selected = ticket.id === selectedTicketId;

        return (
          <button
            key={ticket.id}
            type="button"
            onClick={() => onSelect(ticket)}
            className={`w-full rounded-lg border p-4 text-left transition hover:border-primary/60 hover:bg-primary/5 ${
              selected ? 'border-primary bg-primary/10' : 'border-border bg-background'
            }`}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  {getTicketProviderLabel(ticket)} / {getTicketDisplayId(ticket)}
                </p>
                <h4 className="mt-1 break-words text-base font-semibold text-card-foreground">{ticket.customerName}</h4>
                <p className="break-words text-xs text-muted-foreground">{ticket.customerContact}</p>
              </div>
              <StatusBadge status={ticket.status} className="shrink-0" />
            </div>

            <p className="mt-3 break-words text-sm leading-5 text-muted-foreground">{ticket.subject}</p>

            <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <span className="min-w-0 break-words">
                Fila: <strong className="text-card-foreground">{ticket.queue}</strong>
              </span>
              <span className="min-w-0 break-words">
                Atendente: <strong className="text-card-foreground">{ticket.agent}</strong>
              </span>
              <span>
                Canal: <strong className="text-card-foreground">{ticket.channel}</strong>
              </span>
              <span>
                Ultima msg: <strong className="text-card-foreground">{formatDateTime(ticket.lastMessageAt)}</strong>
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <SentimentBadge sentiment={ticket.sentiment} />
              <RiskBadge risk={ticket.risk} />
              <span className="rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning">
                {formatRatingLabel(ticket.rating)}
              </span>
              {ticket.tags.slice(0, 4).map((ticketTag) => (
                <span key={ticketTag} className="rounded-md border border-border bg-secondary px-2 py-1 text-xs text-muted-foreground">
                  {ticketTag}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
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
    BLIP: 'BLiP',
    GLPI: 'GLPI',
    TEAMS_PHONE: 'Teams Phone',
    UNKNOWN: 'Nao informado',
  };

  return labels[value] ?? value;
}

function providerFilterLabel(value: string) {
  return filterValueLabel(value);
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}
