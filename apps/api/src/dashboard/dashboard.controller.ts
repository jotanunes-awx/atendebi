import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';

const dashboardOverview = {
  period: 'today',
  periodLabel: 'Ultimas 24h',
  updatedAt: new Date('2026-05-29T23:45:00.000Z').toISOString(),
  source: 'api',
  metrics: [
    {
      label: 'Atendimentos',
      value: '186',
      detail: '42 ainda abertos',
      tone: 'neutral',
      icon: 'tickets',
    },
    {
      label: 'Tempo medio',
      value: '6,4 min',
      detail: 'Primeira resposta',
      tone: 'good',
      icon: 'clock',
    },
    {
      label: 'Nota media',
      value: '4,3',
      detail: 'Baseada nas avaliacoes',
      tone: 'good',
      icon: 'star',
    },
    {
      label: 'Reclamacoes',
      value: '9',
      detail: 'Prioridade para qualidade',
      tone: 'danger',
      icon: 'alert',
    },
    {
      label: 'Fallback do bot',
      value: '12,8%',
      detail: 'Conversas transferidas',
      tone: 'warning',
      icon: 'message',
    },
    {
      label: 'Oportunidades',
      value: '27',
      detail: 'Sinais comerciais',
      tone: 'neutral',
      icon: 'sale',
    },
  ],
  hourlyTicketVolume: [
    { hour: '08h', tickets: 12 },
    { hour: '10h', tickets: 24 },
    { hour: '12h', tickets: 31 },
    { hour: '14h', tickets: 28 },
    { hour: '16h', tickets: 36 },
    { hour: '18h', tickets: 22 },
  ],
  queueAttentionData: [
    { name: 'Suporte', abertos: 18, espera: 7.2 },
    { name: 'Comercial', abertos: 11, espera: 4.1 },
    { name: 'Financeiro', abertos: 13, espera: 9.8 },
    { name: 'Retencao', abertos: 7, espera: 5.6 },
  ],
  qualitySummary: {
    averageRating: 4.3,
    totalRated: 128,
    lowRated: 11,
    unresolved: 14,
    reopened: 6,
    aiConfidence: 82,
  },
  qualitySignals: [
    {
      label: 'Atendimentos ruins',
      value: '11',
      detail: 'Notas 1 ou 2 estrelas',
      tone: 'danger',
    },
    {
      label: 'Nao solucionados',
      value: '14',
      detail: 'Fechados sem resolucao',
      tone: 'warning',
    },
    {
      label: 'Reabertos',
      value: '6',
      detail: 'Voltaram em ate 48h',
      tone: 'neutral',
    },
  ],
  operationalRisks: [
    { label: 'Nota baixa sem contato posterior', value: 7, tone: 'danger' },
    { label: 'Cliente pediu humano 3x', value: 9, tone: 'warning' },
    { label: 'Conversa fechada sem tag', value: 18, tone: 'neutral' },
  ],
  improvementSuggestions: [
    'Revisar respostas do bot nos pedidos de segunda via e entrega atrasada.',
    'Criar alerta para tickets com mais de 20 minutos sem resposta humana.',
    'Priorizar auditoria da fila Financeiro, onde aparecem mais notas baixas.',
    'Gerar resumo automatico da conversa antes da transferencia para atendente.',
  ],
  agentPerformance: [
    { name: 'Ana Lima', queue: 'Suporte', tickets: 38, rating: 4.8, resolutionRate: 94 },
    { name: 'Beatriz Rocha', queue: 'Comercial', tickets: 31, rating: 4.5, resolutionRate: 89 },
    { name: 'Carlos Souza', queue: 'Financeiro', tickets: 24, rating: 3.9, resolutionRate: 76 },
  ],
  recurringTopics: [
    { label: 'Entrega atrasada', count: 34, share: 28 },
    { label: 'Segunda via', count: 29, share: 24 },
    { label: 'Cancelamento', count: 21, share: 17 },
    { label: 'Troca de produto', count: 18, share: 15 },
    { label: 'Negociacao comercial', count: 16, share: 13 },
  ],
  resolutionFunnel: [
    { label: 'Iniciados', value: 186, share: 100 },
    { label: 'Resolvidos no bot', value: 76, share: 41 },
    { label: 'Transferidos', value: 64, share: 34 },
    { label: 'Resolvidos humano', value: 51, share: 27 },
    { label: 'Sem solucao', value: 14, share: 8 },
  ],
  conversations: [
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
  ],
};

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(MockAuthGuard)
@Controller('dashboard')
export class DashboardController {
  @Get('overview')
  @ApiOperation({ summary: 'Returns overview metrics for the dashboard' })
  overview() {
    return dashboardOverview;
  }
}
