import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { presentTicket, ticketInclude } from '../common/data/ticket-presenter';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async overview(tenantHeader?: string) {
    const tenantId = await this.tenantContext.resolveTenantId(tenantHeader);

    if (!tenantId) {
      return this.emptyOverview();
    }

    const tickets = await this.prisma.ticket.findMany({
      where: { tenantId },
      include: ticketInclude,
      orderBy: { openedAt: 'desc' },
    });
    const rows = tickets.map(presentTicket);
    const total = rows.length;
    const openTickets = rows.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING');
    const ratedTickets = rows.filter((ticket) => ticket.rating > 0);
    const lowRated = rows.filter((ticket) => ticket.rating > 0 && ticket.rating <= 2);
    const complaints = rows.filter((ticket) => ticket.isComplaint);
    const botFallbacks = rows.filter((ticket) => ticket.botFallback);
    const opportunities = rows.filter((ticket) => ticket.isOpportunity);
    const unresolved = rows.filter((ticket) => ticket.unresolved);
    const averageRating = average(ratedTickets.map((ticket) => ticket.rating));
    const averageFirstResponse = average(rows.map((ticket) => ticket.firstResponseMinutes).filter((value) => value > 0));
    const fallbackRate = total > 0 ? Math.round((botFallbacks.length / total) * 1000) / 10 : 0;

    return {
      period: 'last_30_days',
      periodLabel: 'Ultimos 30 dias',
      updatedAt: new Date().toISOString(),
      source: 'api' as const,
      metrics: [
        {
          label: 'Atendimentos',
          value: String(total),
          detail: `${openTickets.length} ainda abertos`,
          tone: 'neutral',
          icon: 'tickets',
        },
        {
          label: 'Tempo medio',
          value: `${formatNumber(averageFirstResponse)} min`,
          detail: 'Primeira resposta',
          tone: averageFirstResponse > 8 ? 'warning' : 'good',
          icon: 'clock',
        },
        {
          label: 'Nota media',
          value: formatNumber(averageRating),
          detail: 'Baseada nas avaliacoes',
          tone: averageRating < 3.5 ? 'warning' : 'good',
          icon: 'star',
        },
        {
          label: 'Reclamacoes',
          value: String(complaints.length),
          detail: 'Prioridade para qualidade',
          tone: complaints.length > 0 ? 'danger' : 'neutral',
          icon: 'alert',
        },
        {
          label: 'Fallback do bot',
          value: `${formatNumber(fallbackRate)}%`,
          detail: 'Conversas transferidas',
          tone: fallbackRate > 10 ? 'warning' : 'good',
          icon: 'message',
        },
        {
          label: 'Oportunidades',
          value: String(opportunities.length),
          detail: 'Sinais comerciais',
          tone: 'neutral',
          icon: 'sale',
        },
      ],
      hourlyTicketVolume: buildHourlyVolume(rows),
      queueAttentionData: buildQueueAttention(rows),
      qualitySummary: {
        averageRating,
        totalRated: ratedTickets.length,
        lowRated: lowRated.length,
        unresolved: unresolved.length,
        reopened: rows.filter((ticket) => ticket.tags.includes('Risco') && ticket.status !== 'CLOSED').length,
        aiConfidence: total > 0 ? 86 : 0,
      },
      qualitySignals: [
        {
          label: 'Atendimentos ruins',
          value: String(lowRated.length),
          detail: 'Notas 1 ou 2 estrelas',
          tone: 'danger',
        },
        {
          label: 'Nao solucionados',
          value: String(unresolved.length),
          detail: 'Fechados sem resolucao',
          tone: 'warning',
        },
        {
          label: 'Reabertos',
          value: String(rows.filter((ticket) => ticket.tags.includes('Risco') && ticket.status !== 'CLOSED').length),
          detail: 'Voltaram em ate 48h',
          tone: 'neutral',
        },
      ],
      operationalRisks: [
        { label: 'Nota baixa sem contato posterior', value: lowRated.length, tone: 'danger' },
        { label: 'Cliente pediu humano 3x', value: botFallbacks.length, tone: 'warning' },
        { label: 'Conversa fechada sem tag', value: rows.filter((ticket) => ticket.tags.length === 0).length, tone: 'neutral' },
      ],
      improvementSuggestions: [
        'Revisar respostas do bot nos pedidos de segunda via e entrega atrasada.',
        'Criar alerta para tickets com mais de 8 minutos sem resposta humana.',
        'Priorizar auditoria das filas com maior proporcao de notas baixas.',
        'Gerar resumo automatico da conversa antes da transferencia para atendente.',
      ],
      agentPerformance: buildAgentPerformance(rows),
      recurringTopics: buildRecurringTopics(rows),
      resolutionFunnel: buildResolutionFunnel(rows),
      conversations: rows.slice(0, 6).map((ticket) => ({
        id: ticket.id,
        customer: ticket.customerName,
        queue: ticket.queue,
        agent: ticket.agent,
        status: ticket.status,
        signal: ticket.signal,
      })),
    };
  }

  async drilldown(tenantHeader: string | undefined, filters: Record<string, string | undefined>) {
    const tenantId = await this.tenantContext.resolveTenantId(tenantHeader);

    if (!tenantId) {
      return { data: [], meta: { total: 0 } };
    }

    const tickets = await this.prisma.ticket.findMany({
      where: { tenantId },
      include: ticketInclude,
      orderBy: { openedAt: 'desc' },
    });
    const type = filters.type ?? 'Atendimentos';
    const rows = tickets
      .map(presentTicket)
      .filter((ticket) => matchesDrilldownType(ticket, type))
      .filter((ticket) => matchesGenericFilters(ticket, filters));

    return {
      data: rows,
      meta: {
        total: rows.length,
        type,
      },
    };
  }

  private emptyOverview() {
    return {
      period: 'last_30_days',
      periodLabel: 'Ultimos 30 dias',
      updatedAt: new Date().toISOString(),
      source: 'api' as const,
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
  }
}

type PresentedTicket = ReturnType<typeof presentTicket>;

function matchesDrilldownType(ticket: PresentedTicket, type: string) {
  switch (type) {
    case 'Atendimentos':
      return true;
    case 'Tempo medio':
      return ticket.firstResponseMinutes >= 7;
    case 'Nota media':
      return ticket.rating > 0;
    case 'Reclamacoes':
      return ticket.isComplaint;
    case 'Fallback do bot':
      return ticket.botFallback;
    case 'Oportunidades':
      return ticket.isOpportunity;
    default:
      return true;
  }
}

function matchesGenericFilters(ticket: PresentedTicket, filters: Record<string, string | undefined>) {
  return (
    (!filters.queue || ticket.queue === filters.queue) &&
    (!filters.agent || ticket.agent === filters.agent) &&
    (!filters.status || ticket.status === filters.status) &&
    (!filters.rating || ticket.rating === Number(filters.rating)) &&
    (!filters.sentiment || ticket.sentiment === filters.sentiment)
  );
}

function buildHourlyVolume(rows: PresentedTicket[]) {
  const countByHour = new Map<string, number>();

  for (const ticket of rows) {
    const hour = `${String(new Date(ticket.openedAt).getUTCHours()).padStart(2, '0')}h`;
    countByHour.set(hour, (countByHour.get(hour) ?? 0) + 1);
  }

  return Array.from(countByHour.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([hour, tickets]) => ({ hour, tickets }));
}

function buildQueueAttention(rows: PresentedTicket[]) {
  const byQueue = groupBy(rows, (ticket) => ticket.queue);

  return Array.from(byQueue.entries())
    .map(([name, tickets]) => ({
      name,
      abertos: tickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING').length,
      espera: average(tickets.map((ticket) => ticket.waitMinutes).filter((value) => value > 0)),
    }))
    .sort((left, right) => right.abertos - left.abertos);
}

function buildAgentPerformance(rows: PresentedTicket[]) {
  const byAgent = groupBy(rows, (ticket) => ticket.agent);

  return Array.from(byAgent.entries())
    .map(([name, tickets]) => {
      const resolved = tickets.filter((ticket) => ticket.resolutionStatus === 'Resolvido').length;

      return {
        name,
        queue: tickets[0]?.queue ?? 'Operacao',
        tickets: tickets.length,
        rating: average(tickets.map((ticket) => ticket.rating).filter((value) => value > 0)),
        resolutionRate: tickets.length > 0 ? Math.round((resolved / tickets.length) * 100) : 0,
      };
    })
    .sort((left, right) => right.tickets - left.tickets);
}

function buildRecurringTopics(rows: PresentedTicket[]) {
  const counts = new Map<string, number>();

  for (const ticket of rows) {
    for (const tag of ticket.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([label, count]) => ({
      label,
      count,
      share: rows.length > 0 ? Math.round((count / rows.length) * 100) : 0,
    }));
}

function buildResolutionFunnel(rows: PresentedTicket[]) {
  const total = rows.length;
  const botResolved = rows.filter((ticket) => !ticket.botFallback && ticket.status === 'CLOSED').length;
  const transferred = rows.filter((ticket) => ticket.botFallback).length;
  const humanResolved = rows.filter((ticket) => ticket.status === 'CLOSED' && ticket.resolutionStatus === 'Resolvido').length;
  const unresolved = rows.filter((ticket) => ticket.unresolved).length;

  return [
    { label: 'Iniciados', value: total, share: 100 },
    { label: 'Resolvidos no bot', value: botResolved, share: percentage(botResolved, total) },
    { label: 'Transferidos', value: transferred, share: percentage(transferred, total) },
    { label: 'Resolvidos humano', value: humanResolved, share: percentage(humanResolved, total) },
    { label: 'Sem solucao', value: unresolved, share: percentage(unresolved, total) },
  ];
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const map = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }

  return map;
}

function formatNumber(value: number) {
  return value.toFixed(value % 1 === 0 ? 0 : 1).replace('.', ',');
}
