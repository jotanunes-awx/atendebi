export type MetricTone = 'neutral' | 'good' | 'warning' | 'danger';

export type MetricIconKey = 'tickets' | 'clock' | 'star' | 'alert' | 'message' | 'sale';

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  tone: MetricTone;
  icon: MetricIconKey;
};

export const dashboardMetrics: DashboardMetric[] = [
  {
    label: 'Atendimentos',
    value: '186',
    detail: '42 ainda abertos',
    tone: 'neutral' as const,
    icon: 'tickets' as const,
  },
  {
    label: 'Tempo medio',
    value: '6,4 min',
    detail: 'Primeira resposta',
    tone: 'good' as const,
    icon: 'clock' as const,
  },
  {
    label: 'Nota media',
    value: '4,3',
    detail: 'Baseada nas avaliacoes',
    tone: 'good' as const,
    icon: 'star' as const,
  },
  {
    label: 'Reclamacoes',
    value: '9',
    detail: 'Prioridade para qualidade',
    tone: 'danger' as const,
    icon: 'alert' as const,
  },
  {
    label: 'Fallback do bot',
    value: '12,8%',
    detail: 'Conversas transferidas',
    tone: 'warning' as const,
    icon: 'message' as const,
  },
  {
    label: 'Oportunidades',
    value: '27',
    detail: 'Sinais comerciais',
    tone: 'neutral' as const,
    icon: 'sale' as const,
  },
];

export const queueAttentionData = [
  { name: 'Suporte', abertos: 18, espera: 7.2 },
  { name: 'Comercial', abertos: 11, espera: 4.1 },
  { name: 'Financeiro', abertos: 13, espera: 9.8 },
  { name: 'Retencao', abertos: 7, espera: 5.6 },
];

export type QueueAttentionItem = { name: string; abertos: number; espera: number };

export const hourlyTicketVolume = [
  { hour: '08h', tickets: 12 },
  { hour: '10h', tickets: 24 },
  { hour: '12h', tickets: 31 },
  { hour: '14h', tickets: 28 },
  { hour: '16h', tickets: 36 },
  { hour: '18h', tickets: 22 },
];

export type HourlyTicketVolumeItem = { hour: string; tickets: number };

export const qualitySummary = {
  averageRating: 4.3,
  totalRated: 128,
  lowRated: 11,
  unresolved: 14,
  reopened: 6,
  aiConfidence: 82,
};

export type QualitySummary = typeof qualitySummary;

export const qualitySignals = [
  {
    label: 'Atendimentos ruins',
    value: String(qualitySummary.lowRated),
    detail: 'Notas 1 ou 2 estrelas',
    tone: 'danger' as const,
  },
  {
    label: 'Nao solucionados',
    value: String(qualitySummary.unresolved),
    detail: 'Fechados sem resolucao',
    tone: 'warning' as const,
  },
  {
    label: 'Reabertos',
    value: String(qualitySummary.reopened),
    detail: 'Voltaram em ate 48h',
    tone: 'neutral' as const,
  },
];

export type QualitySignal = {
  label: string;
  value: string;
  detail: string;
  tone: MetricTone;
};

export const operationalRisks = [
  { label: 'Nota baixa sem contato posterior', value: 7, tone: 'danger' as const },
  { label: 'Cliente pediu humano 3x', value: 9, tone: 'warning' as const },
  { label: 'Conversa fechada sem tag', value: 18, tone: 'neutral' as const },
];

export type OperationalRisk = {
  label: string;
  value: number;
  tone: MetricTone;
};

export const improvementSuggestions = [
  'Revisar respostas do bot nos pedidos de segunda via e entrega atrasada.',
  'Criar alerta para tickets com mais de 20 minutos sem resposta humana.',
  'Priorizar auditoria da fila Financeiro, onde aparecem mais notas baixas.',
  'Gerar resumo automatico da conversa antes da transferencia para atendente.',
];

export const agentPerformance = [
  {
    name: 'Ana Lima',
    queue: 'Suporte',
    tickets: 38,
    rating: 4.8,
    resolutionRate: 94,
  },
  {
    name: 'Beatriz Rocha',
    queue: 'Comercial',
    tickets: 31,
    rating: 4.5,
    resolutionRate: 89,
  },
  {
    name: 'Carlos Souza',
    queue: 'Financeiro',
    tickets: 24,
    rating: 3.9,
    resolutionRate: 76,
  },
];

export type AgentPerformanceItem = {
  name: string;
  queue: string;
  tickets: number;
  rating: number;
  resolutionRate: number;
};

export const recurringTopics = [
  { label: 'Entrega atrasada', count: 34, share: 28 },
  { label: 'Segunda via', count: 29, share: 24 },
  { label: 'Cancelamento', count: 21, share: 17 },
  { label: 'Troca de produto', count: 18, share: 15 },
  { label: 'Negociacao comercial', count: 16, share: 13 },
];

export type RecurringTopic = { label: string; count: number; share: number };

export const resolutionFunnel = [
  { label: 'Iniciados', value: 186, share: 100 },
  { label: 'Resolvidos no bot', value: 76, share: 41 },
  { label: 'Transferidos', value: 64, share: 34 },
  { label: 'Resolvidos humano', value: 51, share: 27 },
  { label: 'Sem solucao', value: 14, share: 8 },
];

export type ResolutionFunnelItem = { label: string; value: number; share: number };

export type DashboardDistributionItem = {
  label: string;
  value: number;
  color: string;
};

export type DashboardDistributionChart = {
  title: string;
  description: string;
  items: DashboardDistributionItem[];
};

export const distributionCharts: DashboardDistributionChart[] = [
  {
    title: 'Status dos atendimentos',
    description: 'O que esta aberto, pendente ou finalizado',
    items: [
      { label: 'Abertos', value: 42, color: '#14b8a6' },
      { label: 'Pendentes', value: 31, color: '#f59e0b' },
      { label: 'Fechados', value: 113, color: '#22c55e' },
    ],
  },
  {
    title: 'Origem dos dados',
    description: 'De onde vem o volume analisado',
    items: [
      { label: 'BLiP', value: 96, color: '#0ea5e9' },
      { label: 'GLPI', value: 65, color: '#8b5cf6' },
      { label: 'Teams Phone', value: 25, color: '#f97316' },
    ],
  },
  {
    title: 'Risco percebido',
    description: 'Priorizacao visual para gestao',
    items: [
      { label: 'Baixo', value: 128, color: '#22c55e' },
      { label: 'Medio', value: 42, color: '#f59e0b' },
      { label: 'Alto', value: 16, color: '#f43f5e' },
    ],
  },
];

export const conversations = [
  {
    id: 'ticket-1001',
    customer: 'Marina Costa',
    queue: 'Suporte',
    agent: 'Ana Lima',
    status: 'Aberto',
    signal: 'Entrega',
  },
  {
    id: 'ticket-1002',
    customer: 'Joao Pereira',
    queue: 'Financeiro',
    agent: 'Carlos Souza',
    status: 'Pendente',
    signal: 'Nota baixa',
  },
  {
    id: 'ticket-1003',
    customer: 'Patricia Nunes',
    queue: 'Comercial',
    agent: 'Beatriz Rocha',
    status: 'Fechado',
    signal: 'Venda',
  },
  {
    id: 'ticket-1004',
    customer: 'Rafael Martins',
    queue: 'Retencao',
    agent: 'Ana Lima',
    status: 'Aberto',
    signal: 'Risco',
  },
];

export type ConversationSummary = {
  id: string;
  customer: string;
  queue: string;
  agent: string;
  status: string;
  signal: string;
};

export type DashboardOverview = {
  period: string;
  periodLabel: string;
  updatedAt: string;
  source: 'api' | 'mock';
  metrics: DashboardMetric[];
  hourlyTicketVolume: HourlyTicketVolumeItem[];
  queueAttentionData: QueueAttentionItem[];
  qualitySummary: QualitySummary;
  qualitySignals: QualitySignal[];
  operationalRisks: OperationalRisk[];
  improvementSuggestions: string[];
  agentPerformance: AgentPerformanceItem[];
  recurringTopics: RecurringTopic[];
  resolutionFunnel: ResolutionFunnelItem[];
  distributionCharts: DashboardDistributionChart[];
  conversations: ConversationSummary[];
};

export const mockDashboardOverview: DashboardOverview = {
  period: 'last_30_days',
  periodLabel: 'Ultimos 30 dias',
  updatedAt: '2026-05-29T23:45:00.000Z',
  source: 'mock',
  metrics: dashboardMetrics,
  hourlyTicketVolume,
  queueAttentionData,
  qualitySummary,
  qualitySignals,
  operationalRisks,
  improvementSuggestions,
  agentPerformance,
  recurringTopics,
  resolutionFunnel,
  distributionCharts,
  conversations,
};
