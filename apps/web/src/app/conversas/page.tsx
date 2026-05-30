'use client';

import { Copy, Download, Filter, MessageSquareText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ConversationTimeline } from '@/components/conversation-timeline';
import { DataTable } from '@/components/data-table';
import { DashboardShell } from '@/components/dashboard-shell';
import { RiskBadge } from '@/components/risk-badge';
import { SentimentBadge } from '@/components/sentiment-badge';
import { StatusBadge } from '@/components/status-badge';
import { TicketDetailDrawer } from '@/components/ticket-detail-drawer';
import { Button } from '@/components/ui/button';
import { ticketColumns, getTicketSearchValue, formatDateTime } from '@/components/ticket-columns';
import { demoTickets, getDemoMessages, type DemoChannel, type DemoSentiment, type DemoTicket, type DemoTicketStatus } from '@/lib/demo-data';

const allQueues = ['Todas', ...Array.from(new Set(demoTickets.map((ticket) => ticket.queue)))];
const allAgents = ['Todos', ...Array.from(new Set(demoTickets.map((ticket) => ticket.agent)))];
const allStatuses: Array<'Todos' | DemoTicketStatus> = ['Todos', 'OPEN', 'PENDING', 'CLOSED', 'CANCELED'];
const allSentiments: Array<'Todos' | DemoSentiment> = ['Todos', 'positivo', 'neutro', 'negativo'];
const allChannels: Array<'Todos' | DemoChannel> = ['Todos', ...Array.from(new Set(demoTickets.map((ticket) => ticket.channel)))];
const allGroups = ['Todos', ...Array.from(new Set(demoTickets.map((ticket) => ticket.group)))];
const allTags = ['Todas', ...Array.from(new Set(demoTickets.flatMap((ticket) => ticket.tags)))];

export default function ConversasPage() {
  const [queue, setQueue] = useState('Todas');
  const [agent, setAgent] = useState('Todos');
  const [status, setStatus] = useState<'Todos' | DemoTicketStatus>('Todos');
  const [sentiment, setSentiment] = useState<'Todos' | DemoSentiment>('Todos');
  const [channel, setChannel] = useState<'Todos' | DemoChannel>('Todos');
  const [group, setGroup] = useState('Todos');
  const [tag, setTag] = useState('Todas');
  const [selectedTicketId, setSelectedTicketId] = useState(demoTickets[0]?.id ?? '');
  const [detailTicket, setDetailTicket] = useState<DemoTicket | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ticketFromUrl = new URLSearchParams(window.location.search).get('ticket');

    if (ticketFromUrl && demoTickets.some((ticket) => ticket.id === ticketFromUrl)) {
      setSelectedTicketId(ticketFromUrl);
    }
  }, []);

  const filteredTickets = useMemo(() => {
    return demoTickets.filter((ticket) => {
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
  }, [agent, channel, group, queue, sentiment, status, tag]);

  useEffect(() => {
    if (filteredTickets.length > 0 && !filteredTickets.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(filteredTickets[0].id);
    }
  }, [filteredTickets, selectedTicketId]);

  const selectedTicket =
    filteredTickets.find((ticket) => ticket.id === selectedTicketId) ??
    demoTickets.find((ticket) => ticket.id === selectedTicketId) ??
    filteredTickets[0] ??
    demoTickets[0];
  const messages = selectedTicket ? getDemoMessages(selectedTicket) : [];

  async function copyConversationLink(ticket: DemoTicket) {
    setCopied(true);
    await navigator.clipboard?.writeText(`http://localhost:3000/conversas?ticket=${ticket.id}`);
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
        </div>

        <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <Filter className="h-4 w-4 text-primary" aria-hidden="true" />
            Filtros de investigação
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            <FilterSelect label="Fila" value={queue} values={allQueues} onChange={setQueue} />
            <FilterSelect label="Atendente" value={agent} values={allAgents} onChange={setAgent} />
            <FilterSelect label="Status" value={status} values={allStatuses} onChange={(value) => setStatus(value as 'Todos' | DemoTicketStatus)} />
            <FilterSelect label="Sentimento" value={sentiment} values={allSentiments} onChange={(value) => setSentiment(value as 'Todos' | DemoSentiment)} />
            <FilterSelect label="Canal" value={channel} values={allChannels} onChange={(value) => setChannel(value as 'Todos' | DemoChannel)} />
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
                      {selectedTicket.rating} estrelas
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
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}
