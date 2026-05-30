'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  History,
  Lightbulb,
  MessageCircle,
  ShoppingCart,
  Star,
  TicketCheck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardShell } from '@/components/dashboard-shell';
import { MetricCard } from '@/components/metric-card';
import { getConversationMessages, getDashboardOverview, getTickets } from '@/lib/api-client';
import { mockConversationMessages, mockConversationTickets } from '@/lib/mock-conversation-history';
import { mockDashboardOverview, type MetricIconKey } from '@/lib/mock-dashboard';

const qualitySignalStyles = {
  danger: 'border-rose-100 bg-rose-50',
  warning: 'border-amber-100 bg-amber-50',
  neutral: 'border-zinc-100 bg-zinc-50',
};

const operationalRiskStyles = {
  danger: 'bg-rose-50 text-rose-700',
  warning: 'bg-amber-50 text-amber-700',
  neutral: 'bg-zinc-50 text-zinc-700',
};

const ticketStatusStyles = {
  OPEN: 'border-teal-200 bg-teal-50 text-teal-800',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-800',
  CLOSED: 'border-zinc-200 bg-zinc-50 text-zinc-700',
};

const messageDirectionStyles = {
  INBOUND: 'mr-auto border-zinc-200 bg-white text-zinc-800',
  OUTBOUND: 'ml-auto border-teal-200 bg-teal-50 text-zinc-800',
  SYSTEM: 'mx-auto border-zinc-200 bg-zinc-50 text-zinc-600',
};

const metricIcons = {
  tickets: TicketCheck,
  clock: Clock3,
  star: Star,
  alert: AlertTriangle,
  message: MessageCircle,
  sale: ShoppingCart,
} satisfies Record<MetricIconKey, typeof TicketCheck>;

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Nota media ${rating} de 5`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < Math.round(rating);

        return (
          <Star
            key={index}
            className="h-6 w-6 text-amber-500"
            fill={filled ? '#f59e0b' : 'none'}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function useDarkMode() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = window.localStorage.getItem('atendebi-theme');
    setTheme(stored === 'dark' ? 'dark' : 'light');
  }, []);

  return theme;
}

export default function Home() {
  const theme = useDarkMode();
  const isDark = theme === 'dark';
  const [chartsReady, setChartsReady] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState('ticket-1001');
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: getDashboardOverview,
  });
  const ticketsQuery = useQuery({
    queryKey: ['tickets', 'history'],
    queryFn: getTickets,
  });
  const messagesQuery = useQuery({
    queryKey: ['conversations', selectedTicketId, 'messages'],
    queryFn: () => getConversationMessages(selectedTicketId),
    enabled: Boolean(selectedTicketId),
  });

  useEffect(() => {
    setChartsReady(true);
  }, []);

  const dashboard = dashboardQuery.data ?? mockDashboardOverview;
  const tickets = ticketsQuery.data?.data ?? mockConversationTickets;
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0];
  const conversation = messagesQuery.data ?? mockConversationMessages[selectedTicket?.id ?? selectedTicketId];
  const statusLabel = dashboardQuery.isLoading
    ? 'Carregando API'
    : dashboardQuery.isError
      ? 'Usando fallback local'
      : 'Conectado a API';

  return (
    <DashboardShell>
      <div className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-white px-4 py-3 shadow-panel sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-950">Dashboard conectado ao endpoint /dashboard/overview</p>
          <p className="text-sm text-zinc-500">
            Fonte atual: {statusLabel} · {dashboard.periodLabel}
          </p>
        </div>
        <span className="w-fit rounded-md border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800">
          {dashboardQuery.isFetching ? 'Sincronizando' : 'Atualizado'}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {dashboard.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} icon={metricIcons[metric.icon]} />
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-lg border border-border bg-white p-4 shadow-panel">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-normal text-zinc-950">Volume por hora</h2>
              <p className="text-sm text-zinc-500">Atendimentos iniciados no dia</p>
            </div>
          </div>
          <div className="h-72 w-full">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={dashboard.hourlyTicketVolume} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid
                    stroke={isDark ? 'rgba(148, 163, 184, 0.25)' : '#e4e4e7'}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="hour"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: isDark ? '#cbd5e1' : '#475569' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: isDark ? '#cbd5e1' : '#475569' }}
                  />
                  <Tooltip
                    wrapperStyle={{ outline: 'none' }}
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                      color: isDark ? '#f8fafc' : '#0f172a',
                    }}
                    labelStyle={{ color: isDark ? '#94a3b8' : '#475569' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tickets"
                    stroke={isDark ? '#5eead4' : '#0f766e'}
                    strokeWidth={3}
                    dot={{ r: 3, fill: isDark ? '#2dd4bf' : '#0f766e' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full rounded-md bg-zinc-100" />
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-white p-4 shadow-panel">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-normal text-zinc-950">Filas em atencao</h2>
            <p className="text-sm text-zinc-500">Abertos e espera media</p>
          </div>
          <div className="h-72 w-full">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                  data={dashboard.queueAttentionData}
                  layout="vertical"
                  margin={{ left: 12, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke={isDark ? 'rgba(148, 163, 184, 0.25)' : '#e4e4e7'}
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: isDark ? '#cbd5e1' : '#475569' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={78}
                    tick={{ fill: isDark ? '#cbd5e1' : '#475569' }}
                  />
                  <Tooltip
                    wrapperStyle={{ outline: 'none' }}
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                      color: isDark ? '#f8fafc' : '#0f172a',
                    }}
                    labelStyle={{ color: isDark ? '#94a3b8' : '#475569' }}
                  />
                  <Bar dataKey="abertos" fill={isDark ? '#5eead4' : '#b45309'} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full rounded-md bg-zinc-100" />
            )}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-lg border border-border bg-white shadow-panel">
        <div className="grid gap-5 p-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-normal text-zinc-950">Qualidade por estrelas</h2>
                <p className="text-sm text-zinc-600">
                  {dashboard.qualitySummary.totalRated} avaliacoes recebidas no periodo
                </p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-white">
                <Star className="h-5 w-5 text-amber-500" fill="#f59e0b" aria-hidden="true" />
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-semibold tracking-normal text-zinc-950">
                    {String(dashboard.qualitySummary.averageRating).replace('.', ',')}
                  </span>
                  <span className="text-sm font-medium text-zinc-600">de 5</span>
                </div>
                <div className="mt-3">
                  <RatingStars rating={dashboard.qualitySummary.averageRating} />
                </div>
              </div>
              <div className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-700">
                {dashboard.qualitySummary.aiConfidence}% de confianca nos sinais analisados
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {dashboard.qualitySignals.map((signal) => (
                <div key={signal.label} className={`rounded-md border p-3 ${qualitySignalStyles[signal.tone]}`}>
                  <p className="text-xs font-medium uppercase text-zinc-500">{signal.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950">{signal.value}</p>
                  <p className="mt-1 text-xs text-zinc-500">{signal.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-normal text-zinc-950">Risco operacional</h2>
                  <p className="text-sm text-zinc-500">Casos que merecem revisao</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-rose-600" aria-hidden="true" />
              </div>
              <div className="mt-4 space-y-3">
                {dashboard.operationalRisks.map((risk) => (
                  <div
                    key={risk.label}
                    className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 ${operationalRiskStyles[risk.tone]}`}
                  >
                    <span className="text-sm font-medium text-zinc-700">{risk.label}</span>
                    <span className="text-sm font-semibold">{risk.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-normal text-zinc-950">Melhorias sugeridas por IA</h2>
                  <p className="text-sm text-zinc-600">Fila de ideias para auditoria e gestao</p>
                </div>
                <BrainCircuit className="h-5 w-5 text-teal-700" aria-hidden="true" />
              </div>
              <ul className="mt-4 space-y-3">
                {dashboard.improvementSuggestions.map((suggestion) => (
                  <li key={suggestion} className="flex gap-3 rounded-md border border-teal-100 bg-white p-3">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
                    <span className="text-sm text-zinc-700">{suggestion}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium text-teal-800">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Sugestoes prontas para validacao da qualidade
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="rounded-lg border border-border bg-white p-4 shadow-panel">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-normal text-zinc-950">Atendentes</h2>
            <p className="text-sm text-zinc-500">Produtividade e resolucao</p>
          </div>
          <div className="space-y-3">
            {dashboard.agentPerformance.map((agent) => (
              <div key={agent.name} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-zinc-950">{agent.name}</p>
                    <p className="text-sm text-zinc-500">{agent.queue}</p>
                  </div>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-sm font-semibold text-emerald-700">
                    {agent.rating.toString().replace('.', ',')}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-zinc-600">
                  <span>{agent.tickets} tickets</span>
                  <span>{agent.resolutionRate}% resolucao</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-100">
                  <div className="h-2 rounded-full bg-teal-700" style={{ width: `${agent.resolutionRate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-white p-4 shadow-panel">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-normal text-zinc-950">Assuntos recorrentes</h2>
            <p className="text-sm text-zinc-500">Temas mais citados nas conversas</p>
          </div>
          <div className="space-y-3">
            {dashboard.recurringTopics.map((topic) => (
              <div key={topic.label}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-zinc-700">{topic.label}</span>
                  <span className="text-zinc-500">{topic.count}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-100">
                  <div className="h-2 rounded-full bg-amber-600" style={{ width: `${topic.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-white p-4 shadow-panel">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-normal text-zinc-950">Funil de resolucao</h2>
            <p className="text-sm text-zinc-500">Caminho dos atendimentos</p>
          </div>
          <div className="space-y-3">
            {dashboard.resolutionFunnel.map((step) => (
              <div key={step.label} className="rounded-md bg-zinc-50 px-3 py-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-zinc-700">{step.label}</span>
                  <span className="font-semibold text-zinc-950">{step.value}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white">
                  <div className="h-2 rounded-full bg-zinc-800" style={{ width: `${step.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-lg border border-border bg-white shadow-panel">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-normal text-zinc-950">Historico de conversas</h2>
            <p className="text-sm text-zinc-500">Tickets, mensagens e sinais de auditoria por atendimento</p>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800">
            <History className="h-4 w-4" aria-hidden="true" />
            {ticketsQuery.isFetching || messagesQuery.isFetching ? 'Sincronizando' : 'Dados da API'}
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[0.9fr_1.4fr]">
          <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-zinc-950">{tickets.length} conversas</p>
              <span className="text-xs font-medium text-zinc-500">mock via API</span>
            </div>
            <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
              {tickets.map((ticket) => {
                const selected = ticket.id === selectedTicket?.id;

                return (
                  <button
                    key={ticket.id}
                    aria-pressed={selected}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selected ? 'border-teal-300 bg-teal-50' : 'border-border bg-white hover:bg-zinc-50'
                    }`}
                    type="button"
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-950">{ticket.customerName}</p>
                        <p className="truncate text-sm text-zinc-500">{ticket.subject}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${
                          ticketStatusStyles[ticket.status as keyof typeof ticketStatusStyles] ?? ticketStatusStyles.OPEN
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-500">
                      <span>{ticket.queue}</span>
                      <span className="text-right">{formatDateTime(ticket.lastMessageAt)}</span>
                      <span>{ticket.agent}</span>
                      <span className="text-right">{ticket.resolutionStatus}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 p-4">
            {selectedTicket && conversation ? (
              <>
                <div className="rounded-lg border border-border bg-zinc-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-500">{selectedTicket.id}</p>
                      <h3 className="text-lg font-semibold tracking-normal text-zinc-950">
                        {selectedTicket.customerName}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-600">{selectedTicket.summary}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-sm font-medium text-amber-800">
                        {selectedTicket.rating} estrelas
                      </span>
                      <span className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm font-medium text-zinc-700">
                        {selectedTicket.sentiment}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedTicket.tags.map((tag) => (
                      <span key={tag} className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 max-h-[560px] space-y-3 overflow-auto rounded-lg border border-border bg-white p-4">
                  {conversation.data.map((message) => (
                    <article
                      key={message.id}
                      className={`max-w-[86%] rounded-lg border p-3 ${messageDirectionStyles[message.direction]}`}
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-zinc-950">{message.senderName}</p>
                          <p className="text-xs text-zinc-500">{message.senderRole}</p>
                        </div>
                        <time className="text-xs text-zinc-500">{formatDateTime(message.sentAt)}</time>
                      </div>
                      <p className="text-sm leading-6">{message.content}</p>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-border bg-zinc-50 p-6 text-sm text-zinc-600">
                Nenhuma conversa selecionada.
              </div>
            )}
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
