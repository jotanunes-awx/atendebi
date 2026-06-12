import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { matchesTicketPeriod, normalizePeriod, periodLabel, periodStartDate } from '../common/data/period-filter';
import { presentTicket, ticketInclude } from '../common/data/ticket-presenter';

@Injectable()
export class QualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async overview(tenantHeader?: string, period?: string) {
    const tenantId = await this.tenantContext.resolveTenantId(tenantHeader);
    const normalizedPeriod = normalizePeriod(period, '30d');

    if (!tenantId) {
      return emptyQualityOverview(normalizedPeriod);
    }

    const since = periodStartDate(normalizedPeriod);
    const tickets = await this.prisma.ticket.findMany({
      where: { tenantId, ...(since ? { openedAt: { gte: since } } : {}) },
      include: ticketInclude,
      orderBy: { openedAt: 'desc' },
    });
    const rows = tickets.map(presentTicket).filter((ticket) => matchesTicketPeriod(ticket, normalizedPeriod));
    const rated = rows.filter((ticket) => ticket.rating > 0);
    const lowRated = rows.filter((ticket) => ticket.rating > 0 && ticket.rating <= 2);
    const negative = rows.filter((ticket) => ticket.sentiment === 'negativo');
    const highRisk = rows.filter((ticket) => ticket.risk === 'alto');
    const unresolved = rows.filter((ticket) => ticket.unresolved);

    return {
      period: normalizedPeriod,
      periodLabel: periodLabel(normalizedPeriod),
      averageRating: average(rated.map((ticket) => ticket.rating)),
      totalRated: rated.length,
      lowRated: lowRated.length,
      negativeSentiment: negative.length,
      highRisk: highRisk.length,
      unresolved: unresolved.length,
      recurrentReasons: buildReasons(rows),
      recommendedActions: [
        {
          title: 'Auditar notas 1 e 2',
          description: 'Priorizar conversas com insatisfacao, demora e reclamacao.',
          tickets: lowRated.length,
        },
        {
          title: 'Revisar filas com risco alto',
          description: 'Cruzar tempo de resposta, fila e tags de risco.',
          tickets: highRisk.length,
        },
        {
          title: 'Acompanhar casos nao solucionados',
          description: 'Exigir proximo passo registrado para cada atendimento.',
          tickets: unresolved.length,
        },
      ],
      tickets: dedupeById([...lowRated, ...negative, ...highRisk]).slice(0, 25),
    };
  }
}

type PresentedTicket = ReturnType<typeof presentTicket>;

function buildReasons(rows: PresentedTicket[]) {
  const counts = new Map<string, number>();

  for (const ticket of rows) {
    for (const tag of ticket.tags) {
      if (['Reclamacao', 'Risco', 'Cancelamento', 'Boleto', 'Entrega'].includes(tag)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([label, count]) => ({ label, count }));
}

function dedupeById(rows: PresentedTicket[]) {
  const seen = new Set<string>();

  return rows.filter((ticket) => {
    if (seen.has(ticket.internalId)) {
      return false;
    }

    seen.add(ticket.internalId);
    return true;
  });
}

function emptyQualityOverview(period: string) {
  return {
    period,
    periodLabel: periodLabel(period),
    averageRating: 0,
    totalRated: 0,
    lowRated: 0,
    negativeSentiment: 0,
    highRisk: 0,
    unresolved: 0,
    recurrentReasons: [],
    recommendedActions: [],
    tickets: [],
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}
