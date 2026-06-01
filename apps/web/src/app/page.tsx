'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
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
import { ConversationTimeline } from '@/components/conversation-timeline';
import { DrilldownDrawer } from '@/components/drilldown-drawer';
import { MetricCard } from '@/components/metric-card';
import { RiskBadge } from '@/components/risk-badge';
import { SentimentBadge } from '@/components/sentiment-badge';
import { StatusBadge } from '@/components/status-badge';
import { TicketDetailDrawer } from '@/components/ticket-detail-drawer';
import { Button } from '@/components/ui/button';
import { ticketColumns, getTicketSearchValue, formatDateTime } from '@/components/ticket-columns';
import { DashboardShell } from '@/components/dashboard-shell';
import { getConversationMessages, getDashboardDrilldown, getDashboardOverview, getTickets } from '@/lib/api-client';
import type { DemoTicket } from '@/lib/demo-data';
import type { DashboardOverview, MetricIconKey } from '@/lib/mock-dashboard';
import { useTheme } from '@/lib/theme';

type ChartClickState = {
  activeLabel?: string | number;
  activePayload?: Array<{
    payload?: {
      name?: string;
      hour?: string;
    };
  }>;
};

type DrawerState = {
  title: string;
  description: string;
  filters: Array<{ label: string; value: string }>;
  rows: DemoTicket[];
};

type TicketDetailState = {
  ticket: DemoTicket;
  contextLabel?: string;
};

const metricIcons = {
  tickets: TicketCheck,
  clock: Clock3,
  star: Star,
  alert: AlertTriangle,
  message: MessageCircle,
  sale: ShoppingCart,
} satisfies Record<MetricIconKey, typeof TicketCheck>;

const emptyDashboardOverview: DashboardOverview = {
  period: 'last_30_days',
  periodLabel: 'Dados sincronizados',
  updatedAt: new Date().toISOString(),
  source: 'api',
  metrics: [
    { label: 'Atendimentos', value: '0', detail: '0 ainda abertos', tone: 'neutral', icon: 'tickets' },
    { label: 'Tempo medio', value: '0 min', detail: 'Primeira resposta', tone: 'neutral', icon: 'clock' },
    { label: 'Nota media', value: '0', detail: 'Baseada nas avaliacoes', tone: 'neutral', icon: 'star' },
    { label: 'Reclamacoes', value: '0', detail: 'Prioridade para qualidade', tone: 'neutral', icon: 'alert' },
    { label: 'Fallback do bot', value: '0%', detail: 'Conversas transferidas', tone: 'neutral', icon: 'message' },
    { label: 'Oportunidades', value: '0', detail: 'Sinais comerciais', tone: 'neutral', icon: 'sale' },
  ],
  hourlyTicketVolume: [],
  queueAttentionData: [],
  qualitySummary: { averageRating: 0, totalRated: 0, lowRated: 0, unresolved: 0, reopened: 0, aiConfidence: 0 },
  qualitySignals: [],
  operationalRisks: [],
  improvementSuggestions: [],
  agentPerformance: [],
  recurringTopics: [],
  resolutionFunnel: [],
  conversations: [],
};

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Nota media ${rating} de 5`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < Math.round(rating);

        return (
          <Star
            key={index}
            className="h-6 w-6 text-warning"
            fill={filled ? '#f59e0b' : 'none'}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

function ticketDescription(rows: DemoTicket[]) {
  const open = rows.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING').length;
  const highRisk = rows.filter((ticket) => ticket.risk === 'alto').length;

  return `${rows.length} registros no recorte atual, ${open} ainda abertos/pendentes e ${highRisk} com risco alto.`;
}

export default function Home() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [chartsReady, setChartsReady] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [detail, setDetail] = useState<TicketDetailState | null>(null);
  const [historyGroup, setHistoryGroup] = useState('Todos');
  const [historyChannel, setHistoryChannel] = useState('Todos');
  const [selectedTicketId, setSelectedTicketId] = useState('');

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => getDashboardOverview(),
  });
  const ticketsQuery = useQuery({
    queryKey: ['dashboard', 'tickets'],
    queryFn: () => getTickets({ pageSize: 300 }),
  });

  useEffect(() => {
    setChartsReady(true);
  }, []);

  const dashboard = dashboardQuery.data ?? emptyDashboardOverview;
  const liveTickets = useMemo(() => (ticketsQuery.data?.data ?? []) as unknown as DemoTicket[], [ticketsQuery.data?.data]);
  const historyGroups = useMemo(() => buildHistoryGroups(liveTickets), [liveTickets]);
  const historyChannels = useMemo(() => buildHistoryChannels(liveTickets), [liveTickets]);
  const selectedTicket = useMemo(
    () => liveTickets.find((ticket) => ticket.id === selectedTicketId) ?? liveTickets[0],
    [liveTickets, selectedTicketId],
  );
  const historyTickets = useMemo(() => {
    return liveTickets.filter((ticket) => {
      return (
        (historyGroup === 'Todos' || ticket.group === historyGroup) &&
        (historyChannel === 'Todos' || ticket.channel === historyChannel)
      );
    });
  }, [historyChannel, historyGroup, liveTickets]);
  useEffect(() => {
    if (historyTickets.length > 0 && !historyTickets.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(historyTickets[0].id);
    }
  }, [historyTickets, selectedTicketId]);
  const selectedMessagesQuery = useQuery({
    queryKey: ['dashboard-history-messages', selectedTicket?.id],
    queryFn: () => getConversationMessages(selectedTicket?.id ?? ''),
    enabled: Boolean(selectedTicket?.id && !ticketsQuery.isError),
  });
  const selectedMessages = selectedMessagesQuery.data?.data ?? [];
  const statusLabel = dashboardQuery.isLoading || ticketsQuery.isLoading
    ? 'Carregando API'
    : dashboardQuery.isError || ticketsQuery.isError
      ? 'API indisponivel'
      : 'Conectado a API';

  function openDrawer(title: string, rows: DemoTicket[], filters: DrawerState['filters'], description?: string) {
    setDrawer({
      title,
      description: description ?? ticketDescription(rows),
      filters,
      rows,
    });
  }

  async function openDashboardDrawer(title: string, fallbackRows: DemoTicket[], filters: DrawerState['filters'], description?: string) {
    if (dashboardQuery.isError) {
      openDrawer(title, fallbackRows, filters, description);
      return;
    }

    try {
      const response = await getDashboardDrilldown(title);
      const rows = response.data as DemoTicket[];
      openDrawer(title, rows, filters, description ?? ticketDescription(rows));
    } catch {
      openDrawer(title, fallbackRows, filters, description);
    }
  }

  async function openQueueDrawer(queue: string, fallbackRows: DemoTicket[]) {
    if (dashboardQuery.isError) {
      openDrawer(`Fila ${queue}`, fallbackRows, [{ label: 'Fila', value: queue }]);
      return;
    }

    try {
      const response = await getTickets({ queue, pageSize: 100 });
      const rows = response.data as DemoTicket[];
      openDrawer(`Fila ${queue}`, rows, [{ label: 'Fila', value: queue }]);
    } catch {
      openDrawer(`Fila ${queue}`, fallbackRows, [{ label: 'Fila', value: queue }]);
    }
  }

  function openTicketDetail(ticket: DemoTicket, contextLabel?: string) {
    setSelectedTicketId(ticket.id);
    setDetail({ ticket, contextLabel });
  }

  return (
    <DashboardShell>
      <div className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-panel sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-card-foreground">Dashboard com drill-down operacional</p>
          <p className="text-sm text-muted-foreground">
            Fonte atual: {statusLabel} · {dashboard.periodLabel} · clique nos indicadores para ver os tickets.
          </p>
        </div>
        <span className="w-fit rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          {dashboardQuery.isFetching ? 'Sincronizando' : 'Interativo'}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {dashboard.metrics.map((metric) => {
          const rows = getRowsForMetric(metric.label, liveTickets);

          return (
            <MetricCard
              key={metric.label}
              {...metric}
              icon={metricIcons[metric.icon]}
              onClick={() =>
                openDashboardDrawer(metric.label, rows, [{ label: 'Indicador', value: metric.label }])
              }
            />
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-normal text-card-foreground">Volume por hora</h2>
              <p className="text-sm text-muted-foreground">Clique em um ponto para ver os tickets daquele horario</p>
            </div>
          </div>
          <div className="h-72 w-full cursor-pointer">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height={288} minWidth={0}>
                <LineChart
                  data={dashboard.hourlyTicketVolume}
                  margin={{ left: -18, right: 8, top: 8, bottom: 0 }}
                  onClick={(state: ChartClickState) => {
                    if (state.activeLabel) {
                      const hourLabel = String(state.activeLabel);
                      const rows = getRowsForHour(hourLabel, liveTickets);
                      openDrawer(`Volume ${hourLabel}`, rows, [{ label: 'Hora', value: hourLabel }]);
                    }
                  }}
                >
                  <CartesianGrid stroke={isDark ? 'rgba(148, 163, 184, 0.25)' : '#e4e4e7'} strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fill: isDark ? '#cbd5e1' : '#475569' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: isDark ? '#cbd5e1' : '#475569' }} />
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
                    activeDot={{ r: 7 }}
                    dot={{ r: 4, fill: isDark ? '#2dd4bf' : '#0f766e' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full rounded-md bg-muted" />
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-normal text-card-foreground">Filas em atencao</h2>
            <p className="text-sm text-muted-foreground">Clique em uma barra para abrir a fila</p>
          </div>
          <div className="h-72 w-full cursor-pointer">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height={288} minWidth={0}>
                <BarChart
                  data={dashboard.queueAttentionData}
                  layout="vertical"
                  margin={{ left: 12, right: 8, top: 8, bottom: 0 }}
                  onClick={(state: ChartClickState) => {
                    const queue = state.activePayload?.[0]?.payload?.name;

                    if (queue) {
                      const rows = liveTickets.filter((ticket) => ticket.queue === queue);
                      void openQueueDrawer(queue, rows);
                    }
                  }}
                >
                  <CartesianGrid stroke={isDark ? 'rgba(148, 163, 184, 0.25)' : '#e4e4e7'} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: isDark ? '#cbd5e1' : '#475569' }} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={78} tick={{ fill: isDark ? '#cbd5e1' : '#475569' }} />
                  <Tooltip
                    wrapperStyle={{ outline: 'none' }}
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                      color: isDark ? '#f8fafc' : '#0f172a',
                    }}
                    labelStyle={{ color: isDark ? '#94a3b8' : '#475569' }}
                  />
                  <Bar dataKey="abertos" fill={isDark ? '#5eead4' : '#0f766e'} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full rounded-md bg-muted" />
            )}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-lg border border-border bg-card shadow-panel">
        <div className="grid gap-5 p-4 xl:grid-cols-[0.95fr_1.05fr]">
          <button
            type="button"
            className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-left transition-colors hover:border-warning/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() =>
              void openDashboardDrawer('Nota media', getQualityConcernRows(liveTickets), [
                { label: 'Nota', value: '1 ou 2 estrelas' },
              ])
            }
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-normal text-card-foreground">Qualidade por estrelas</h2>
                <p className="text-sm text-muted-foreground">
                  {dashboard.qualitySummary.totalRated} avaliacoes recebidas no periodo
                </p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-warning/30 bg-card">
                <Star className="h-5 w-5 text-warning" fill="#f59e0b" aria-hidden="true" />
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-semibold tracking-normal text-card-foreground">
                    {String(dashboard.qualitySummary.averageRating).replace('.', ',')}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">de 5</span>
                </div>
                <div className="mt-3">
                  <RatingStars rating={dashboard.qualitySummary.averageRating} />
                </div>
              </div>
              <div className="rounded-md border border-warning/30 bg-card px-3 py-2 text-sm text-muted-foreground">
                Clique para ver atendimentos ruins ou nao solucionados
              </div>
            </div>
          </button>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-normal text-card-foreground">Risco operacional</h2>
                  <p className="text-sm text-muted-foreground">Casos que merecem revisao</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
              </div>
              <div className="mt-4 space-y-3">
                {dashboard.operationalRisks.map((risk) => (
                  <button
                    key={risk.label}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-md bg-secondary px-3 py-2 text-left transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => openDrawer(risk.label, getRowsForRisk(risk.label, liveTickets), [{ label: 'Risco', value: risk.label }])}
                  >
                    <span className="text-sm font-medium text-muted-foreground">{risk.label}</span>
                    <span className="text-sm font-semibold text-card-foreground">{risk.value}</span>
                  </button>
                ))}
                {dashboard.operationalRisks.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border bg-secondary p-3 text-sm leading-6 text-muted-foreground">
                    Sem riscos calculados ainda.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-normal text-card-foreground">Melhorias sugeridas por IA</h2>
                  <p className="text-sm text-muted-foreground">Clique nas ideias para ver a base de conversas</p>
                </div>
                <BrainCircuit className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div className="mt-4 space-y-3">
                {dashboard.improvementSuggestions.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="flex w-full gap-3 rounded-md border border-primary/20 bg-card p-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() =>
                      openDrawer(
                        `Base da sugestao ${index + 1}`,
                        getRowsForSuggestion(index, liveTickets),
                        [{ label: 'Insight', value: `Sugestao ${index + 1}` }],
                        suggestion,
                      )
                    }
                  >
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-sm text-muted-foreground">{suggestion}</span>
                  </button>
                ))}
                {dashboard.improvementSuggestions.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border bg-card p-3 text-sm leading-6 text-muted-foreground">
                    Sem sugestoes ainda. Elas serao geradas com base nos dados sincronizados.
                  </div>
                ) : null}
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Sugestoes prontas para validacao da qualidade
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-normal text-card-foreground">Atendentes</h2>
            <p className="text-sm text-muted-foreground">Clique no atendente para ver carteira atual</p>
          </div>
          <div className="space-y-3">
            {dashboard.agentPerformance.slice(0, 3).map((agent) => (
              <button
                key={agent.name}
                type="button"
                className="w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => openDrawer(agent.name, liveTickets.filter((ticket) => ticket.agent === agent.name), [{ label: 'Atendente', value: agent.name }])}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-card-foreground">{agent.name}</p>
                    <p className="text-sm text-muted-foreground">{agent.queue}</p>
                  </div>
                  <span className="rounded-md bg-success/10 px-2 py-1 text-sm font-semibold text-success">
                    {agent.rating.toString().replace('.', ',')}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                  <span>{agent.tickets} tickets</span>
                  <span>{agent.resolutionRate}% resolucao</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${agent.resolutionRate}%` }} />
                </div>
              </button>
            ))}
            {dashboard.agentPerformance.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-secondary p-3 text-sm leading-6 text-muted-foreground">
                Nenhum atendente/tecnico sincronizado ainda.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-normal text-card-foreground">Assuntos recorrentes</h2>
            <p className="text-sm text-muted-foreground">Clique no tema para abrir conversas relacionadas</p>
          </div>
          <div className="space-y-3">
            {dashboard.recurringTopics.map((topic) => (
              <button
                key={topic.label}
                type="button"
                className="w-full rounded-md px-2 py-1 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() =>
                  openDrawer(
                    topic.label,
                    getRowsForTopic(topic.label, liveTickets),
                    [{ label: 'Assunto', value: topic.label }],
                  )
                }
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-muted-foreground">{topic.label}</span>
                  <span className="text-muted-foreground">{topic.count}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-warning" style={{ width: `${topic.share}%` }} />
                </div>
              </button>
            ))}
            {dashboard.recurringTopics.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-secondary p-3 text-sm leading-6 text-muted-foreground">
                Nenhum assunto recorrente identificado ainda.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 shadow-panel">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-normal text-card-foreground">Funil de resolucao</h2>
            <p className="text-sm text-muted-foreground">Cada etapa abre a lista correspondente</p>
          </div>
          <div className="space-y-3">
            {dashboard.resolutionFunnel.map((step) => {
              const rows = getRowsForFunnel(step.label, liveTickets);

              return (
                <button
                  key={step.label}
                  type="button"
                  className="w-full rounded-md bg-secondary px-3 py-2 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => openDrawer(step.label, rows, [{ label: 'Funil', value: step.label }])}
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-muted-foreground">{step.label}</span>
                    <span className="font-semibold text-card-foreground">{step.value}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-card">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${step.share}%` }} />
                  </div>
                </button>
              );
            })}
            {dashboard.resolutionFunnel.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-secondary p-3 text-sm leading-6 text-muted-foreground">
                O funil aparece depois que houver tickets sincronizados.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-lg border border-border bg-card shadow-panel">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-normal text-card-foreground">Historico de conversas</h2>
            <p className="text-sm text-muted-foreground">
              Organize por grupo, canal e equipe antes de abrir a timeline ou o detalhe completo.
            </p>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <History className="h-4 w-4" aria-hidden="true" />
            {historyTickets.length} de {liveTickets.length} registros
          </div>
        </div>

        <div className="border-b border-border p-4">
          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-card-foreground">Grupos configuraveis</p>
                  <p className="text-xs text-muted-foreground">Exemplo: JotaVendas 1, JotaVendas 2, Retencao VIP.</p>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-border bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-primary/10"
                  onClick={() => setHistoryGroup('Todos')}
                >
                  Todos
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {historyGroups.slice(0, 8).map((group) => {
                  const selected = historyGroup === group.name;

                  return (
                    <button
                      key={group.id}
                      type="button"
                      className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selected ? 'border-primary/40 bg-primary/10' : 'border-border bg-card hover:bg-secondary'
                      }`}
                      onClick={() => setHistoryGroup(group.name)}
                    >
                      <p className="truncate font-semibold text-card-foreground">{group.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {group.openTickets} abertos · {group.highRiskTickets} risco alto
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">{group.channels.join(', ')}</p>
                    </button>
                  );
                })}
                {historyGroups.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-secondary p-4 text-sm leading-6 text-muted-foreground sm:col-span-2 xl:col-span-4">
                    Nenhum grupo real ainda. Eles serao montados a partir dos campos de grupo/canal das integracoes.
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-card-foreground">Canais</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                    historyChannel === 'Todos'
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-secondary text-muted-foreground hover:bg-primary/10'
                  }`}
                  onClick={() => setHistoryChannel('Todos')}
                >
                  Todos
                </button>
                {historyChannels.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      historyChannel === channel.name
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-secondary text-muted-foreground hover:bg-primary/10'
                    }`}
                    onClick={() => setHistoryChannel(channel.name)}
                  >
                    {channel.name} · {channel.tickets}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[0.9fr_1.4fr]">
          <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
            <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
              {historyTickets.slice(0, 32).map((ticket) => {
                const selected = ticket.id === selectedTicket?.id;

                return (
                  <button
                    key={ticket.id}
                    aria-pressed={selected}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selected ? 'border-primary/40 bg-primary/10' : 'border-border bg-card hover:bg-secondary'
                    }`}
                    type="button"
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-card-foreground">{ticket.customerName}</p>
                        <p className="truncate text-sm text-muted-foreground">{ticket.subject}</p>
                      </div>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>{ticket.queue}</span>
                      <span className="text-right">{formatDateTime(ticket.lastMessageAt)}</span>
                      <span>{ticket.group}</span>
                      <span className="text-right">{ticket.resolutionStatus}</span>
                    </div>
                  </button>
                );
              })}
              {historyTickets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Nenhuma conversa encontrada para este grupo/canal.
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 p-4">
            {selectedTicket ? (
              <>
                <div className="rounded-lg border border-border bg-secondary p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{selectedTicket.id}</p>
                      <h3 className="text-lg font-semibold tracking-normal text-card-foreground">
                        {selectedTicket.customerName}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedTicket.summary}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-sm font-medium text-warning">
                        {selectedTicket.rating} estrelas
                      </span>
                      <SentimentBadge sentiment={selectedTicket.sentiment} />
                      <RiskBadge risk={selectedTicket.risk} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedTicket.tags.map((tag) => (
                      <span key={tag} className="rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold text-card-foreground">{selectedTicket.channel}</span> ·{' '}
                      {selectedTicket.group} · {selectedTicket.agent}
                    </div>
                    <Button type="button" size="sm" onClick={() => openTicketDetail(selectedTicket, 'Historico de conversas')}>
                      Ver detalhe completo
                    </Button>
                  </div>
                </div>

                <div className="mt-4 max-h-[560px] overflow-auto rounded-lg border border-border bg-card p-4">
                  <ConversationTimeline messages={selectedMessages} />
                </div>
              </>
            ) : null}
          </div>
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
        onRowClick={(ticket) => openTicketDetail(ticket, drawer?.title)}
      />
      <TicketDetailDrawer
        ticket={detail?.ticket ?? null}
        contextLabel={detail?.contextLabel}
        onClose={() => setDetail(null)}
      />
    </DashboardShell>
  );
}

function getRowsForMetric(label: string, tickets: DemoTicket[]) {
  if (label === 'Tempo medio') {
    return tickets.filter((ticket) => ticket.firstResponseMinutes >= 7 || ticket.waitMinutes >= 7);
  }

  if (label === 'Nota media') {
    return tickets.filter((ticket) => ticket.rating > 0);
  }

  if (label === 'Reclamacoes') {
    return tickets.filter((ticket) => ticket.isComplaint || ticket.sentiment === 'negativo' || ticket.risk === 'alto');
  }

  if (label === 'Fallback do bot') {
    return tickets.filter((ticket) => ticket.botFallback);
  }

  if (label === 'Oportunidades') {
    return tickets.filter((ticket) => ticket.isOpportunity);
  }

  return tickets;
}

function getRowsForHour(hourLabel: string, tickets: DemoTicket[]) {
  const hour = Number(hourLabel.replace(/\D/g, ''));

  return tickets.filter((ticket) => new Date(ticket.openedAt).getUTCHours() === hour);
}

function getQualityConcernRows(tickets: DemoTicket[]) {
  return tickets.filter(
    (ticket) => ticket.rating <= 2 || ticket.unresolved || ticket.sentiment === 'negativo' || ticket.risk === 'alto',
  );
}

function getRowsForRisk(label: string, tickets: DemoTicket[]) {
  const normalized = label.toLowerCase();

  if (normalized.includes('nota')) {
    return tickets.filter((ticket) => ticket.rating > 0 && ticket.rating <= 2);
  }

  if (normalized.includes('humano') || normalized.includes('bot')) {
    return tickets.filter((ticket) => ticket.botFallback);
  }

  if (normalized.includes('tag')) {
    return tickets.filter((ticket) => ticket.tags.length === 0);
  }

  if (normalized.includes('prioridade') || normalized.includes('risco')) {
    return tickets.filter((ticket) => ticket.risk === 'alto');
  }

  if (normalized.includes('aberto') || normalized.includes('pendente')) {
    return tickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING');
  }

  return tickets.filter((ticket) => ticket.risk !== 'baixo' || ticket.unresolved);
}

function getRowsForSuggestion(index: number, tickets: DemoTicket[]) {
  if (index === 0) {
    return tickets.filter((ticket) => ticket.risk === 'alto' || ticket.unresolved || ticket.rating <= 2);
  }

  if (index === 1) {
    return tickets.filter((ticket) => ticket.waitMinutes >= 8 || ticket.firstResponseMinutes >= 8);
  }

  return tickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING');
}

function getRowsForTopic(label: string, tickets: DemoTicket[]) {
  const keyword = label.split(' ')[0]?.toLowerCase() ?? label.toLowerCase();

  return tickets.filter((ticket) => {
    const source = `${ticket.subject} ${ticket.summary} ${ticket.tags.join(' ')}`.toLowerCase();

    return source.includes(keyword);
  });
}

function getRowsForFunnel(label: string, tickets: DemoTicket[]) {
  const normalized = label.toLowerCase();

  if (normalized.includes('pendente')) {
    return tickets.filter((ticket) => ticket.status === 'PENDING');
  }

  if (normalized.includes('andamento') || normalized.includes('aberto')) {
    return tickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING');
  }

  if (normalized.includes('resolvido') || normalized.includes('fechado')) {
    return tickets.filter((ticket) => ticket.status === 'CLOSED' && !ticket.unresolved);
  }

  if (normalized.includes('cancel') || normalized.includes('sem solucao')) {
    return tickets.filter((ticket) => ticket.status === 'CANCELED' || ticket.unresolved);
  }

  return tickets;
}

function buildHistoryGroups(tickets: DemoTicket[]) {
  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      openTickets: number;
      highRiskTickets: number;
      channels: string[];
      channelSet: Set<string>;
    }
  >();

  for (const ticket of tickets) {
    const current = groups.get(ticket.group) ?? {
      id: slug(ticket.group),
      name: ticket.group,
      openTickets: 0,
      highRiskTickets: 0,
      channels: [],
      channelSet: new Set<string>(),
    };

    if (ticket.status === 'OPEN' || ticket.status === 'PENDING') {
      current.openTickets += 1;
    }

    if (ticket.risk === 'alto') {
      current.highRiskTickets += 1;
    }

    if (ticket.channel && !current.channelSet.has(ticket.channel)) {
      current.channelSet.add(ticket.channel);
      current.channels.push(ticket.channel);
    }

    groups.set(ticket.group, current);
  }

  return Array.from(groups.values()).map(({ channelSet, ...group }) => group);
}

function buildHistoryChannels(tickets: DemoTicket[]) {
  const counts = new Map<string, number>();

  for (const ticket of tickets) {
    counts.set(ticket.channel, (counts.get(ticket.channel) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([name, tickets]) => ({
    id: slug(name),
    name,
    tickets,
  }));
}

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
