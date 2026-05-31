import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { isUuid } from '../common/data/id-filter';
import { presentTicket, ticketInclude } from '../common/data/ticket-presenter';

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(tenantHeader?: string) {
    const tenantId = await this.tenantContext.resolveTenantId(tenantHeader);

    if (!tenantId) {
      return { data: [] };
    }

    const agents = await this.prisma.agent.findMany({
      where: { tenantId },
      include: {
        tickets: {
          include: ticketInclude,
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      data: agents.map((agent) => buildAgentResponse(agent, agent.tickets.map(presentTicket))),
    };
  }

  async findOne(tenantHeader: string | undefined, id: string) {
    const tenantId = await this.tenantContext.resolveTenantId(tenantHeader);

    if (!tenantId) {
      throw new NotFoundException('Agent not found');
    }

    const agent = await this.prisma.agent.findFirst({
      where: {
        tenantId,
        OR: isUuid(id) ? [{ id }, { externalId: id }, { name: id }] : [{ externalId: id }, { name: id }],
      },
      include: {
        tickets: {
          include: ticketInclude,
          orderBy: { openedAt: 'desc' },
        },
      },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const tickets = agent.tickets.map(presentTicket);

    return {
      ...buildAgentResponse(agent, tickets),
      tickets,
    };
  }
}

type AgentRecord = {
  id: string;
  externalId: string | null;
  name: string;
  email: string | null;
};
type PresentedTicket = ReturnType<typeof presentTicket>;

function buildAgentResponse(agent: AgentRecord, tickets: PresentedTicket[]) {
  const openTickets = tickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING');
  const resolved = tickets.filter((ticket) => ticket.resolutionStatus === 'Resolvido');
  const ratings = tickets.map((ticket) => ticket.rating).filter((rating) => rating > 0);

  return {
    id: agent.externalId ?? agent.id,
    internalId: agent.id,
    name: agent.name,
    email: agent.email,
    queue: tickets[0]?.queue ?? 'Sem fila',
    ticketsHandled: tickets.length,
    openTickets: openTickets.length,
    averageRating: average(ratings),
    resolutionRate: tickets.length > 0 ? Math.round((resolved.length / tickets.length) * 100) : 0,
    firstResponseMinutes: average(tickets.map((ticket) => ticket.firstResponseMinutes).filter((value) => value > 0)),
    complaints: tickets.filter((ticket) => ticket.isComplaint).length,
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}
