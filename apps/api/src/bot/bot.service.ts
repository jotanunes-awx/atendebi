import { Injectable } from '@nestjs/common';
import { MessageAuthorType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { presentTicket, ticketInclude } from '../common/data/ticket-presenter';
import { authorTypeLabel } from '../common/data/message-author';

@Injectable()
export class BotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async overview(tenantHeader?: string) {
    const tenantId = await this.tenantContext.resolveTenantId(tenantHeader);

    if (!tenantId) {
      return {
        fallbackRate: 0,
        humanRequests: 0,
        abandonedFlows: 0,
        misunderstoodQuestions: 0,
        botContainmentRate: 0,
        botHandledTickets: 0,
        humanHandledTickets: 0,
        messageMix: [],
        flows: [],
        failures: [],
      };
    }

    const tickets = await this.prisma.ticket.findMany({
      where: { tenantId },
      include: ticketInclude,
      orderBy: { openedAt: 'desc' },
    });
    const rows = tickets.map(presentTicket);
    const fallbackTickets = rows.filter((ticket) => ticket.botFallback);
    const misunderstood = rows.filter((ticket) => ticket.botFallback && ticket.tags.some((tag) => ['Boleto', 'Entrega'].includes(tag)));
    const abandoned = fallbackTickets.filter((ticket) => ticket.unresolved);

    const { messageMix, botContainmentRate, botHandledTickets, humanHandledTickets } =
      await this.buildAuthorTypeMetrics(tenantId);

    return {
      fallbackRate: rows.length > 0 ? Math.round((fallbackTickets.length / rows.length) * 1000) / 10 : 0,
      humanRequests: fallbackTickets.length,
      abandonedFlows: abandoned.length,
      misunderstoodQuestions: misunderstood.length,
      botContainmentRate,
      botHandledTickets,
      humanHandledTickets,
      messageMix,
      flows: buildFlows(rows),
      failures: fallbackTickets.slice(0, 25),
    };
  }

  /**
   * Metricas baseadas na coluna real author_type das mensagens: mix de mensagens
   * por autor e taxa de contencao do bot (tickets resolvidos so pelo bot, sem
   * nenhuma mensagem de atendente humano).
   */
  private async buildAuthorTypeMetrics(tenantId: string) {
    const grouped = await this.prisma.message.groupBy({
      by: ['authorType'],
      where: { tenantId },
      _count: { _all: true },
    });

    const messageMix = grouped
      .map((entry) => ({
        authorType: entry.authorType,
        label: authorTypeLabel(entry.authorType),
        value: entry._count._all,
      }))
      .sort((a, b) => b.value - a.value);

    const [botTickets, agentTickets] = await Promise.all([
      this.prisma.message.findMany({
        where: { tenantId, authorType: MessageAuthorType.BOT, ticketId: { not: null } },
        select: { ticketId: true },
        distinct: ['ticketId'],
      }),
      this.prisma.message.findMany({
        where: { tenantId, authorType: MessageAuthorType.AGENT, ticketId: { not: null } },
        select: { ticketId: true },
        distinct: ['ticketId'],
      }),
    ]);

    const humanTicketIds = new Set(agentTickets.map((message) => message.ticketId));
    const botOnly = botTickets.filter((message) => !humanTicketIds.has(message.ticketId)).length;
    const humanHandledTickets = humanTicketIds.size;
    const totalBotInvolved = botOnly + humanHandledTickets;

    return {
      messageMix,
      botHandledTickets: botOnly,
      humanHandledTickets,
      botContainmentRate: totalBotInvolved > 0 ? Math.round((botOnly / totalBotInvolved) * 1000) / 10 : 0,
    };
  }
}

type PresentedTicket = ReturnType<typeof presentTicket>;

function buildFlows(rows: PresentedTicket[]) {
  const counts = new Map<string, { total: number; fallback: number }>();

  for (const ticket of rows) {
    const flow = ticket.subject.includes('boleto')
      ? 'Financeiro/Boleto'
      : ticket.tags.includes('Entrega')
        ? 'Entrega'
        : ticket.tags.includes('Venda')
          ? 'Comercial'
          : ticket.queue;
    const current = counts.get(flow) ?? { total: 0, fallback: 0 };
    counts.set(flow, {
      total: current.total + 1,
      fallback: current.fallback + (ticket.botFallback ? 1 : 0),
    });
  }

  return Array.from(counts.entries()).map(([name, value]) => ({
    name,
    total: value.total,
    fallback: value.fallback,
    fallbackRate: value.total > 0 ? Math.round((value.fallback / value.total) * 100) : 0,
  }));
}
