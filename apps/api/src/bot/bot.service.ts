import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { presentTicket, ticketInclude } from '../common/data/ticket-presenter';

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

    return {
      fallbackRate: rows.length > 0 ? Math.round((fallbackTickets.length / rows.length) * 1000) / 10 : 0,
      humanRequests: fallbackTickets.length,
      abandonedFlows: abandoned.length,
      misunderstoodQuestions: misunderstood.length,
      flows: buildFlows(rows),
      failures: fallbackTickets.slice(0, 25),
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
