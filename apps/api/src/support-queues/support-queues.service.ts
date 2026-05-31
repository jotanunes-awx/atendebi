import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { presentTicket, ticketInclude } from '../common/data/ticket-presenter';

@Injectable()
export class SupportQueuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(tenantHeader?: string) {
    const tenantId = await this.tenantContext.resolveTenantId(tenantHeader);

    if (!tenantId) {
      return { data: [] };
    }

    const queues = await this.prisma.supportQueue.findMany({
      where: { tenantId },
      include: {
        tickets: {
          include: ticketInclude,
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      data: queues.map((queue) => {
        const tickets = queue.tickets.map(presentTicket);

        return buildQueueResponse(queue, tickets);
      }),
    };
  }

  async findOne(tenantHeader: string | undefined, id: string) {
    const tenantId = await this.tenantContext.resolveTenantId(tenantHeader);

    if (!tenantId) {
      throw new NotFoundException('Queue not found');
    }

    const queue = await this.prisma.supportQueue.findFirst({
      where: {
        tenantId,
        OR: [{ id }, { externalId: id }, { name: id }],
      },
      include: {
        tickets: {
          include: ticketInclude,
          orderBy: { openedAt: 'desc' },
        },
      },
    });

    if (!queue) {
      throw new NotFoundException('Queue not found');
    }

    const tickets = queue.tickets.map(presentTicket);

    return {
      ...buildQueueResponse(queue, tickets),
      tickets,
      agents: Array.from(new Set(tickets.map((ticket) => ticket.agent))).map((agent) => ({
        name: agent,
        openTickets: tickets.filter((ticket) => ticket.agent === agent && ['OPEN', 'PENDING'].includes(ticket.status)).length,
      })),
    };
  }
}

type QueueRecord = {
  id: string;
  externalId: string | null;
  name: string;
};
type PresentedTicket = ReturnType<typeof presentTicket>;

function buildQueueResponse(queue: QueueRecord, tickets: PresentedTicket[]) {
  const openTickets = tickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING');
  const ratings = tickets.map((ticket) => ticket.rating).filter((rating) => rating > 0);

  return {
    id: queue.externalId ?? queue.id,
    internalId: queue.id,
    name: queue.name,
    openTickets: openTickets.length,
    averageWaitMinutes: average(tickets.map((ticket) => ticket.waitMinutes).filter((value) => value > 0)),
    averageRating: average(ratings),
    riskTickets: tickets.filter((ticket) => ticket.risk === 'alto').length,
    ticketsHandled: tickets.length,
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}
