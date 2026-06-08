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
  Search,
  ShoppingCart,
  Star,
  TicketCheck,
} from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
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
import { ticketColumns, getTicketSearchValue, formatDateTime, formatRatingLabel, hasTicketRating } from '@/components/ticket-columns';
import { DashboardShell } from '@/components/dashboard-shell';
import { getConversationMessages, getDashboardDrilldown, getDashboardOverview, getTickets } from '@/lib/api-client';
import {
  dashboardViewLabels,
  filterTicketsByExperience,
  getUserExperience,
  providerFilterValue,
  providerLabels,
  providerShortLabels,
  type DashboardViewMode,
  type ProviderScope,
} from '@/lib/access-control';
import { useAuth } from '@/lib/auth';
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
  distributionCharts: [],
  conversations: [],
};

const dashboardPeriodOptions = [
  { value: 'active', label: 'Ativos agora' },
  { value: '24h', label: 'Ultimas 24h' },
  { value: '7d', label: 'Ultimos 7 dias' },
  { value: '30d', label: 'Ultimos 30 dias' },
  { value: '90d', label: 'Ultimos 90 dias' },
  { value: '12m', label: 'Ultimos 12 meses' },
  { value: 'all', label: 'Todo historico' },
];

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

function InsightPieCard({
  chart,
  isReady,
  isDark,
  onSliceClick,
}: {
  chart: DashboardOverview['distributionCharts'][number];
  isReady: boolean;
  isDark: boolean;
  onSliceClick: (label: string) => void;
}) {
  const total = chart.items.reduce((sum, item) => sum + item.value, 0);

  return (
    <article className="rounded-lg border border-border bg-secondary p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">{chart.title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{chart.description}</p>
        </div>
        <span className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-muted-foreground">
          {total}
        </span>
      </div>

      {isReady ? (
        <div className="mt-3 h-52 min-h-[208px] w-full min-w-0 rounded-md bg-card/40">
          <ResponsiveContainer width="100%" height={208} minWidth={180}>
            <PieChart>
              <Tooltip
                wrapperStyle={{ outline: 'none' }}
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                  color: isDark ? '#f8fafc' : '#0f172a',
                }}
                formatter={(value, name) => [`${Number(value ?? 0)} registros`, String(name)]}
              />
              <Pie
                data={chart.items}
                dataKey="value"
                nameKey="label"
                innerRadius="58%"
                outerRadius="82%"
                paddingAngle={2}
                stroke={isDark ? '#0f172a' : '#ffffff'}
                strokeWidth={2}
                onClick={(_, index) => {
                  const item = chart.items[index];

                  if (item) {
                    onSliceClick(item.label);
                  }
                }}
                cursor="pointer"
              >
                {chart.items.map((item) => (
                  <Cell key={item.label} fill={item.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-3 h-52 min-h-[208px] w-full rounded-md bg-muted" />
      )}

      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Clique em uma fatia ou legenda para ver somente aquele grupo.
      </p>

      <div className="mt-3 space-y-2">
        {chart.items.slice(0, 4).map((item) => {
          const share = total > 0 ? Math.round((item.value / total) * 100) : 0;

          return (
            <button
              key={item.label}
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1 text-left transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onSliceClick(item.label)}
            >
              <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-card-foreground">
                {item.value} · {share}%
              </span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function ticketDescription(rows: DemoTicket[]) {
  const open = rows.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING').length;
  const highRisk = rows.filter((ticket) => ticket.risk === 'alto').length;

  return `${rows.length} registros no recorte atual, ${open} ainda abertos/pendentes e ${highRisk} com risco alto.`;
}

export default function Home() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const experience = useMemo(() => getUserExperience(user), [user]);
  const isDark = theme === 'dark';
  const [chartsReady, setChartsReady] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [detail, setDetail] = useState<TicketDetailState | null>(null);
  const [period, setPeriod] = useState('active');
  const [statusFilter, setStatusFilter] = useState('');
  const [provider, setProvider] = useState<ProviderScope | 'Todos'>('Todos');
  const [viewMode, setViewMode] = useState<DashboardViewMode>(experience.preferredView);
  const [personSearch, setPersonSearch] = useState('');
  const [historyGroup, setHistoryGroup] = useState('Todos');
  const [historyChannel, setHistoryChannel] = useState('Todos');
  const [selectedTicketId, setSelectedTicketId] = useState('');

  useEffect(() => {
    setViewMode(readDashboardViewFromUrl() ?? experience.preferredView);

    if (provider !== 'Todos' && !experience.allowedProviders.includes(provider)) {
      setProvider('Todos');
    }
  }, [experience, provider]);

  const dashboardFilters = useMemo(
    () => ({
      period,
      status: statusFilter || undefined,
      provider: providerFilterValue(provider, experience),
      search: personSearch.trim() || undefined,
    }),
    [experience, period, personSearch, provider, statusFilter],
  );

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'overview', dashboardFilters],
    queryFn: () => getDashboardOverview(dashboardFilters),
  });
  const ticketsQuery = useQuery({
    queryKey: ['dashboard', 'tickets', dashboardFilters],
    queryFn: () => getTickets({ pageSize: 300, ...dashboardFilters }),
  });

  useEffect(() => {
    setChartsReady(true);
  }, []);

  const dashboard = dashboardQuery.data ?? emptyDashboardOverview;
  const liveTickets = useMemo(
    () => filterTicketsByExperience((ticketsQuery.data?.data ?? []) as unknown as DemoTicket[], experience),
    [experience, ticketsQuery.data?.data],
  );
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
  const maxQueueOpen = Math.max(...dashboard.queueAttentionData.map((queue) => queue.abertos), 1);
  const hasQualityRatings = dashboard.qualitySummary.totalRated > 0;

  function openDrawer(title: string, rows: DemoTicket[], filters: DrawerState['filters'], description?: string) {
    setDrawer({
      title,
      description: description ?? ticketDescription(rows),
      filters,
      rows,
    });
  }

  async function openDashboardDrawer(
    title: string,
    fallbackRows: DemoTicket[],
    filters: DrawerState['filters'],
    description?: string,
    apiType = title,
    apiFilters: Record<string, string | number | undefined> = {},
  ) {
    if (dashboardQuery.isError) {
      openDrawer(title, fallbackRows, filters, description);
      return;
    }

    try {
      const response = await getDashboardDrilldown(apiType, { ...dashboardFilters, ...apiFilters });
      const apiRows = response.data as DemoTicket[];
      const rows = reconcileDrilldownRows(apiRows, fallbackRows, apiFilters);
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
      const response = await getTickets({ queue, pageSize: 100, ...dashboardFilters });
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
      <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Sua visao</p>
            <h2 className="mt-2 text-xl font-semibold tracking-normal text-card-foreground">
              {dashboardViewLabels[viewMode]}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              {experience.shortDescription} Use os filtros abaixo para responder perguntas simples: quem esta esperando,
              onde esta travado e quais casos precisam de cuidado.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[420px]">
            <label className="text-xs font-medium text-muted-foreground">
              Tipo de painel
              <select
                value={viewMode}
                onChange={(event) => {
                  const nextView = event.target.value as DashboardViewMode;
                  setViewMode(nextView);
                  updateDashboardViewUrl(nextView);
                }}
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              >
                {Object.entries(dashboardViewLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Origem dos dados
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value as ProviderScope | 'Todos')}
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              >
                <option value="Todos">Todas liberadas</option>
                {experience.allowedProviders.map((item) => (
                  <option key={item} value={item}>
                    {providerShortLabels[item]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {experience.allowedProviders.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setProvider(item)}
              className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                provider === item ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground hover:bg-primary/10'
              }`}
            >
              <span className="font-semibold">{providerShortLabels[item]}</span>
              <span className="ml-2 text-xs">{providerLabels[item]}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setProvider('Todos')}
            className={`rounded-md border px-3 py-2 text-sm transition-colors ${
              provider === 'Todos' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground hover:bg-primary/10'
            }`}
          >
            Todas as origens liberadas
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-panel sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-card-foreground">Painel de gestao</p>
          <p className="text-sm text-muted-foreground">
            Dados: {statusLabel} · {dashboard.periodLabel} · clique nos indicadores para abrir os atendimentos relacionados.
          </p>
        </div>
        <span className="w-fit rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          {dashboardQuery.isFetching ? 'Atualizando' : 'Pronto para detalhar'}
        </span>
      </div>

      <section className="mb-4 grid gap-3 rounded-lg border border-border bg-card p-4 shadow-panel md:grid-cols-[180px_180px_1fr]">
        <label className="text-xs font-medium text-muted-foreground">
          Recorte dos dados
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            {dashboardPeriodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="">Todos</option>
            <option value="OPEN">Abertos</option>
            <option value="PENDING">Pendentes</option>
            <option value="CLOSED">Fechados</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Buscar pessoa, chamado ou assunto
          <div className="mt-2 flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              value={personSearch}
              onChange={(event) => setPersonSearch(event.target.value)}
              placeholder="Ex.: Maria, notebook, chamado 75, financeiro"
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </label>
      </section>

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

      <section className="mt-5 rounded-lg border border-border bg-card p-4 shadow-panel">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-normal text-card-foreground">Leitura rapida para gestao</h2>
            <p className="text-sm text-muted-foreground">
              Graficos visuais para entender composicao, origem, risco e sentimento sem navegar por tabelas.
            </p>
          </div>
          <span className="w-fit rounded-md border border-info/30 bg-info/10 px-3 py-1 text-xs font-semibold text-info">
            Clique em uma fatia para detalhar
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboard.distributionCharts.map((chart) => (
            <InsightPieCard
              key={chart.title}
              chart={chart}
              isReady={chartsReady}
              isDark={isDark}
              onSliceClick={(label) => {
                const rows = getRowsForDistribution(chart.title, label, liveTickets);
                const drilldown = getDistributionDrilldown(chart.title, label);

                void openDashboardDrawer(
                  `${label} em ${chart.title}`,
                  rows,
                  [
                    { label: 'Grafico', value: chart.title },
                    { label: 'Grupo clicado', value: label },
                  ],
                  distributionDescription(chart.title, label, rows.length),
                  drilldown.type,
                  drilldown.filters,
                );
              }}
            />
          ))}
          {dashboard.distributionCharts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary p-5 text-sm leading-6 text-muted-foreground md:col-span-2 xl:col-span-4">
              Sincronize uma origem real para montar os graficos executivos.
            </div>
          ) : null}
        </div>
      </section>

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
                      void openDashboardDrawer(
                        `Volume ${hourLabel}`,
                        rows,
                        [{ label: 'Hora', value: hourLabel }],
                        ticketDescription(rows),
                        'Atendimentos',
                        { hour: hourLabel },
                      );
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
            <p className="text-sm text-muted-foreground">Grupos, categorias ou equipes com chamados no recorte</p>
          </div>
          <div className="h-72 w-full">
            {chartsReady ? (
              <div className="h-full space-y-3 overflow-auto pr-1">
                {dashboard.queueAttentionData.slice(0, 10).map((queue) => {
                  const rows = liveTickets.filter((ticket) => ticket.queue === queue.name);
                  const width = Math.max((queue.abertos / maxQueueOpen) * 100, queue.abertos > 0 ? 8 : 2);

                  return (
                    <button
                      key={queue.name}
                      type="button"
                      className="w-full rounded-md border border-border bg-secondary p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => void openQueueDrawer(queue.name, rows)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-semibold text-card-foreground">{queue.name}</span>
                        <span className="shrink-0 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          {queue.abertos} abertos
                        </span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-card">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{rows.length} registros no recorte</span>
                        <span>{queue.espera ? `${queue.espera} min espera` : 'Sem espera calculada'}</span>
                      </div>
                    </button>
                  );
                })}
                {dashboard.queueAttentionData.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border bg-secondary p-4 text-center text-sm leading-6 text-muted-foreground">
                    Nenhuma fila com chamado neste recorte. Ajuste o periodo ou sincronize o GLPI.
                  </div>
                ) : null}
              </div>
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
                    {hasQualityRatings ? String(dashboard.qualitySummary.averageRating).replace('.', ',') : 'Sem nota'}
                  </span>
                  {hasQualityRatings ? <span className="text-sm font-medium text-muted-foreground">de 5</span> : null}
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
                    {agent.rating > 0 ? agent.rating.toString().replace('.', ',') : 'Sem nota'}
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
                        {formatRatingLabel(selectedTicket.rating)}
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

function readDashboardViewFromUrl(): DashboardViewMode | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const view = new URLSearchParams(window.location.search).get('view');

  return isDashboardViewMode(view) ? view : null;
}

function updateDashboardViewUrl(view: DashboardViewMode) {
  if (typeof window === 'undefined' || window.location.pathname !== '/') {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set('view', view);
  window.history.replaceState(null, '', url.toString());
}

function isDashboardViewMode(value: string | null): value is DashboardViewMode {
  return value === 'executive' || value === 'service' || value === 'it' || value === 'commercial' || value === 'global';
}

function distributionDescription(title: string, label: string, count: number) {
  const plural = count === 1 ? 'registro' : 'registros';

  return `Voce clicou em "${label}" no grafico "${title}". A lista abaixo mostra somente esse grupo: ${count} ${plural}.`;
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

function getRowsForDistribution(title: string, label: string, tickets: DemoTicket[]) {
  if (title.includes('Status')) {
    const statusByLabel: Record<string, DemoTicket['status']> = {
      Abertos: 'OPEN',
      Pendentes: 'PENDING',
      Fechados: 'CLOSED',
      Cancelados: 'CANCELED',
    };
    const status = statusByLabel[label];

    return status ? tickets.filter((ticket) => ticket.status === status) : tickets;
  }

  if (title.includes('Origem')) {
    const normalizedLabel = label.toLowerCase();

    return tickets.filter((ticket) => {
      const source = `${ticket.provider} ${ticket.providerLabel} ${ticket.channel}`.toLowerCase();

      return source.includes(normalizedLabel.split(' ')[0] ?? normalizedLabel);
    });
  }

  if (title.includes('Risco')) {
    return tickets.filter((ticket) => ticket.risk.toLowerCase() === label.toLowerCase());
  }

  if (title.includes('Sentimento')) {
    return tickets.filter((ticket) => ticket.sentiment.toLowerCase() === label.toLowerCase());
  }

  return tickets;
}

function getDistributionDrilldown(title: string, label: string) {
  if (title.includes('Status')) {
    const statusByLabel: Record<string, DemoTicket['status']> = {
      Abertos: 'OPEN',
      Pendentes: 'PENDING',
      Fechados: 'CLOSED',
      Cancelados: 'CANCELED',
    };

    return { type: 'Atendimentos', filters: { status: statusByLabel[label] } };
  }

  if (title.includes('Origem')) {
    const providerByLabel: Record<string, string> = {
      BLiP: 'BLIP',
      GLPI: 'GLPI',
      'Teams Phone': 'TEAMS_PHONE',
      'Teams Phone / PABX': 'TEAMS_PHONE',
      Telefonia: 'TEAMS_PHONE',
    };
    const provider = providerByLabel[label] ?? (label.toLowerCase().includes('team') ? 'TEAMS_PHONE' : undefined);

    return { type: 'Atendimentos', filters: { provider } };
  }

  if (title.includes('Risco')) {
    return { type: 'Atendimentos', filters: { risk: label.toLowerCase() } };
  }

  if (title.includes('Sentimento')) {
    return { type: 'Atendimentos', filters: { sentiment: label.toLowerCase() } };
  }

  return { type: 'Atendimentos', filters: {} };
}

function reconcileDrilldownRows(
  apiRows: DemoTicket[],
  fallbackRows: DemoTicket[],
  apiFilters: Record<string, string | number | undefined>,
) {
  const hasExtraFilters = Object.values(apiFilters).some((value) => value !== undefined && value !== '');
  const filteredFallbackRows = hasExtraFilters ? applyClientDrilldownFilters(fallbackRows, apiFilters) : fallbackRows;

  if (apiRows.length === 0) {
    return filteredFallbackRows;
  }

  if (!hasExtraFilters) {
    return apiRows;
  }

  const narrowedRows = applyClientDrilldownFilters(apiRows, apiFilters);

  if (narrowedRows.length > 0) {
    return narrowedRows;
  }

  return filteredFallbackRows;
}

function applyClientDrilldownFilters(rows: DemoTicket[], filters: Record<string, string | number | undefined>) {
  return rows.filter((ticket) => {
    const hour = filters.hour ? String(filters.hour) : '';

    return (
      (!filters.status || ticket.status === filters.status) &&
      (!filters.provider || ticket.provider === filters.provider) &&
      (!filters.risk || ticket.risk === String(filters.risk).toLowerCase()) &&
      (!filters.sentiment || ticket.sentiment === String(filters.sentiment).toLowerCase()) &&
      (!hour || `${String(new Date(ticket.openedAt).getUTCHours()).padStart(2, '0')}h` === hour)
    );
  });
}

function getRowsForHour(hourLabel: string, tickets: DemoTicket[]) {
  const hour = Number(hourLabel.replace(/\D/g, ''));

  return tickets.filter((ticket) => new Date(ticket.openedAt).getUTCHours() === hour);
}

function getQualityConcernRows(tickets: DemoTicket[]) {
  return tickets.filter(
    (ticket) => (hasTicketRating(ticket) && ticket.rating <= 2) || ticket.unresolved || ticket.sentiment === 'negativo' || ticket.risk === 'alto',
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
    return tickets.filter((ticket) => ticket.risk === 'alto' || ticket.unresolved || (hasTicketRating(ticket) && ticket.rating <= 2));
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
