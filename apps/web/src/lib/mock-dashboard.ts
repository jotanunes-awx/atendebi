export type MetricTone = 'neutral' | 'good' | 'warning' | 'danger';

export type MetricIconKey = 'tickets' | 'clock' | 'star' | 'alert' | 'message' | 'sale';

export const dashboardMetrics = [
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

export type DashboardMetric = (typeof dashboardMetrics)[number];

export const queueAttentionData = [
  { name: 'Suporte', abertos: 18, espera: 7.2 },
  { name: 'Comercial', abertos: 11, espera: 4.1 },
  { name: 'Financeiro', abertos: 13, espera: 9.8 },
  { name: 'Retencao', abertos: 7, espera: 5.6 },
];

export type QueueAttentionItem = (typeof queueAttentionData)[number];

export const hourlyTicketVolume = [
  { hour: '08h', tickets: 12 },
  { hour: '10h', tickets: 24 },
  { hour: '12h', tickets: 31 },
  { hour: '14h', tickets: 28 },
  { hour: '16h', tickets: 36 },
  { hour: '18h', tickets: 22 },
];

export type HourlyTicketVolumeItem = (typeof hourlyTicketVolume)[number];

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

export type QualitySignal = (typeof qualitySignals)[number];

export const operationalRisks = [
  { label: 'Nota baixa sem contato posterior', value: 7, tone: 'danger' as const },
  { label: 'Cliente pediu humano 3x', value: 9, tone: 'warning' as const },
  { label: 'Conversa fechada sem tag', value: 18, tone: 'neutral' as const },
];

export type OperationalRisk = (typeof operationalRisks)[number];

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

export type AgentPerformanceItem = (typeof agentPerformance)[number];

export const recurringTopics = [
  { label: 'Entrega atrasada', count: 34, share: 28 },
  { label: 'Segunda via', count: 29, share: 24 },
  { label: 'Cancelamento', count: 21, share: 17 },
  { label: 'Troca de produto', count: 18, share: 15 },
  { label: 'Negociacao comercial', count: 16, share: 13 },
];

export type RecurringTopic = (typeof recurringTopics)[number];

export const resolutionFunnel = [
  { label: 'Iniciados', value: 186, share: 100 },
  { label: 'Resolvidos no bot', value: 76, share: 41 },
  { label: 'Transferidos', value: 64, share: 34 },
  { label: 'Resolvidos humano', value: 51, share: 27 },
  { label: 'Sem solucao', value: 14, share: 8 },
];

export type ResolutionFunnelItem = (typeof resolutionFunnel)[number];

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

export type ConversationSummary = (typeof conversations)[number];

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
  conversations: ConversationSummary[];
};

export const mockDashboardOverview: DashboardOverview = {
  period: 'today',
  periodLabel: 'Ultimas 24h',
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
  conversations,
};
