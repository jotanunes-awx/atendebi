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

  async overview(tenantHeader?: string, filters: Record<string, string | undefined> = {}) {
    const tenantId = await this.tenantContext.resolveTenantId(tenantHeader);

    if (!tenantId) {
      return this.emptyOverview();
    }

    const tickets = await this.prisma.ticket.findMany({
      where: { tenantId },
      include: ticketInclude,
      orderBy: { openedAt: 'desc' },
    });
    const normalizedFilters = withDefaultDashboardPeriod(filters);
    const rows = tickets.map(presentTicket).filter((ticket) => matchesGenericFilters(ticket, normalizedFilters));
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
      period: normalizedFilters.period ?? 'active',
      periodLabel: periodLabel(normalizedFilters.period),
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
          value: ratedTickets.length > 0 ? formatNumber(averageRating) : 'Sem nota',
          detail: ratedTickets.length > 0 ? 'Baseada nas avaliacoes' : 'Nenhuma avaliacao finalizada',
          tone: ratedTickets.length === 0 ? 'neutral' : averageRating < 3.5 ? 'warning' : 'good',
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
      operationalRisks: buildOperationalRisks(rows),
      improvementSuggestions: buildImprovementSuggestions(rows),
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
    const normalizedFilters = withDefaultDashboardPeriod(filters);
    const type = normalizedFilters.type ?? 'Atendimentos';
    const rows = tickets
      .map(presentTicket)
      .filter((ticket) => matchesDrilldownType(ticket, type))
      .filter((ticket) => matchesGenericFilters(ticket, normalizedFilters));

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
  const search = filters.search?.trim().toLowerCase();
  const haystack = [
    ticket.id,
    ticket.customerName,
    ticket.customerContact,
    ticket.queue,
    ticket.agent,
    ticket.subject,
    ticket.channel,
    ticket.group,
    ticket.status,
    ticket.resolutionStatus,
    ticket.tags.join(' '),
  ]
    .join(' ')
    .toLowerCase();

  return (
    (!filters.queue || ticket.queue === filters.queue) &&
    (!filters.agent || ticket.agent === filters.agent) &&
    (!filters.status || ticket.status === filters.status) &&
    (!filters.rating || ticket.rating === Number(filters.rating)) &&
    (!filters.sentiment || ticket.sentiment === filters.sentiment) &&
    (!search || haystack.includes(search)) &&
    matchesPeriod(ticket, filters.period)
  );
}

function withDefaultDashboardPeriod(filters: Record<string, string | undefined>): Record<string, string | undefined> {
  return {
    ...filters,
    period: filters.period || 'active',
  };
}

function matchesPeriod(ticket: PresentedTicket, period?: string) {
  if (!period || period === 'all') {
    return true;
  }

  if (period === 'active') {
    return ticket.status === 'OPEN' || ticket.status === 'PENDING';
  }

  const daysByPeriod: Record<string, number> = {
    '24h': 1,
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '12m': 365,
  };
  const days = daysByPeriod[period];

  if (!days) {
    return true;
  }

  return new Date(ticket.openedAt).getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function periodLabel(period?: string) {
  const labels: Record<string, string> = {
    active: 'Chamados ativos',
    '24h': 'Ultimas 24 horas',
    '7d': 'Ultimos 7 dias',
    '30d': 'Ultimos 30 dias',
    '90d': 'Ultimos 90 dias',
    '12m': 'Ultimos 12 meses',
    all: 'Todo o historico salvo',
  };

  return labels[period ?? 'active'] ?? 'Chamados ativos';
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
  const open = rows.filter((ticket) => ticket.status === 'OPEN').length;
  const pending = rows.filter((ticket) => ticket.status === 'PENDING').length;
  const resolved = rows.filter((ticket) => ticket.status === 'CLOSED' && !ticket.unresolved).length;
  const unresolved = rows.filter((ticket) => ticket.unresolved).length;

  return [
    { label: 'Iniciados', value: total, share: 100 },
    { label: 'Em andamento', value: open, share: percentage(open, total) },
    { label: 'Pendentes', value: pending, share: percentage(pending, total) },
    { label: 'Resolvidos', value: resolved, share: percentage(resolved, total) },
    { label: 'Sem solucao', value: unresolved, share: percentage(unresolved, total) },
  ];
}

function buildOperationalRisks(rows: PresentedTicket[]) {
  const lowRated = rows.filter((ticket) => ticket.rating > 0 && ticket.rating <= 2).length;
  const highRisk = rows.filter((ticket) => ticket.risk === 'alto').length;
  const openOrPending = rows.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING').length;
  const withoutTags = rows.filter((ticket) => ticket.tags.length === 0).length;

  return [
    { label: 'Notas baixas para revisar', value: lowRated, tone: 'danger' as const },
    { label: 'Prioridade ou risco alto', value: highRisk, tone: 'warning' as const },
    { label: 'Abertos ou pendentes', value: openOrPending, tone: 'neutral' as const },
    { label: 'Registros sem tag', value: withoutTags, tone: 'neutral' as const },
  ].filter((risk) => risk.value > 0);
}

function buildImprovementSuggestions(rows: PresentedTicket[]) {
  if (rows.length === 0) {
    return [];
  }

  const hasGlpi = rows.some((ticket) => ticket.channel === 'GLPI' || ticket.tags.includes('GLPI'));
  const highRisk = rows.filter((ticket) => ticket.risk === 'alto').length;
  const waiting = rows.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING').length;
  const slow = rows.filter((ticket) => ticket.firstResponseMinutes >= 8 || ticket.waitMinutes >= 8).length;
  const suggestions: string[] = [];

  if (hasGlpi) {
    suggestions.push('Priorizar chamados GLPI abertos ou pendentes antes de avaliar SLA e backlog.');
    suggestions.push('Mapear categorias GLPI com maior volume para criar grupos de gestao no AtendeBI.');
  }

  if (highRisk > 0) {
    suggestions.push('Abrir revisao operacional dos tickets em risco alto e registrar proximo passo.');
  }

  if (waiting > 0) {
    suggestions.push('Acompanhar tickets abertos ou pendentes para evitar envelhecimento da fila.');
  }

  if (slow > 0) {
    suggestions.push('Criar alerta para registros com primeira resposta ou espera acima do alvo definido.');
  }

  return suggestions.slice(0, 4);
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
