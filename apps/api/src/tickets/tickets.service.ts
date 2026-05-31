import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { presentTicket, ticketInclude } from '../common/data/ticket-presenter';

export type TicketFilters = {
  status?: string;
  queue?: string;
  agent?: string;
  rating?: string;
  sentiment?: string;
  search?: string;
  page?: string;
  pageSize?: string;
};

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(tenantHeader?: string, filters: TicketFilters = {}) {
    const tenantId = await this.tenantContext.resolveTenantId(tenantHeader);

    if (!tenantId) {
      return { data: [], meta: { total: 0, page: 1, pageSize: 25 } };
    }

    const tickets = await this.prisma.ticket.findMany({
      where: { tenantId },
      include: ticketInclude,
      orderBy: { openedAt: 'desc' },
    });
    const rows = tickets.map(presentTicket).filter((ticket) => matchesFilters(ticket, filters));
    const page = Math.max(Number(filters.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(filters.pageSize ?? 25), 1), 100);
    const start = (page - 1) * pageSize;

    return {
      data: rows.slice(start, start + pageSize),
      meta: {
        total: rows.length,
        page,
        pageSize,
      },
    };
  }

  async findOne(tenantHeader: string | undefined, id: string) {
    const tenantId = await this.tenantContext.resolveTenantId(tenantHeader);

    if (!tenantId) {
      throw new NotFoundException('Ticket not found');
    }

    const ticket = await this.prisma.ticket.findFirst({
      where: {
        tenantId,
        OR: [{ id }, { externalId: id }],
      },
      include: ticketInclude,
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return presentTicket(ticket);
  }
}

type PresentedTicket = ReturnType<typeof presentTicket>;

function matchesFilters(ticket: PresentedTicket, filters: TicketFilters) {
  const rating = filters.rating ? Number(filters.rating) : undefined;
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
    ticket.tags.join(' '),
  ]
    .join(' ')
    .toLowerCase();

  return (
    (!filters.status || ticket.status === filters.status) &&
    (!filters.queue || ticket.queue === filters.queue) &&
    (!filters.agent || ticket.agent === filters.agent) &&
    (!filters.sentiment || ticket.sentiment === filters.sentiment) &&
    (!rating || ticket.rating === rating) &&
    (!search || haystack.includes(search))
  );
}
