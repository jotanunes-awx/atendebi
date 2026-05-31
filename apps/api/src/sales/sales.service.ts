import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { presentTicket, ticketInclude } from '../common/data/ticket-presenter';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async overview(tenantHeader?: string) {
    const tenantId = await this.tenantContext.resolveTenantId(tenantHeader);

    if (!tenantId) {
      return {
        opportunities: 0,
        leads: 0,
        proposals: 0,
        simulatedConversions: 0,
        lostByDelay: 0,
        tickets: [],
      };
    }

    const tickets = await this.prisma.ticket.findMany({
      where: { tenantId },
      include: ticketInclude,
      orderBy: { openedAt: 'desc' },
    });
    const rows = tickets.map(presentTicket);
    const opportunities = rows.filter((ticket) => ticket.isOpportunity);
    const proposals = opportunities.filter((ticket) => ticket.tags.includes('Proposta'));
    const lostByDelay = opportunities.filter((ticket) => ticket.firstResponseMinutes >= 8 || ticket.unresolved);

    return {
      opportunities: opportunities.length,
      leads: opportunities.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING').length,
      proposals: proposals.length,
      simulatedConversions: opportunities.filter((ticket) => ticket.status === 'CLOSED' && ticket.rating >= 4).length,
      lostByDelay: lostByDelay.length,
      tickets: opportunities.slice(0, 25),
    };
  }
}
