import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { isUuid } from '../common/data/id-filter';
import { presentTicket, ticketInclude } from '../common/data/ticket-presenter';

export type TicketFilters = {
  provider?: string;
  status?: string;
  queue?: string;
  agent?: string;
  rating?: string;
  sentiment?: string;
  search?: string;
  period?: string;
  activeOnly?: string;
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
      where: buildTicketWhere(tenantId, filters),
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
        OR: isUuid(id) ? [{ id }, { externalId: id }] : [{ externalId: id }],
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

function buildTicketWhere(tenantId: string, filters: TicketFilters): Prisma.TicketWhereInput {
  const where: Prisma.TicketWhereInput = { tenantId };
  const status = parseTicketStatus(filters.status);

  if (status) {
    where.status = status;
  } else if (filters.activeOnly === 'true' || filters.period === 'active') {
    where.status = { in: [TicketStatus.OPEN, TicketStatus.PENDING] };
  }

  const openedAfter = openedAfterForPeriod(filters.period);

  if (openedAfter) {
    where.openedAt = { gte: openedAfter };
  }

  return where;
}

function parseTicketStatus(value?: string) {
  if (value === 'OPEN' || value === 'PENDING' || value === 'CLOSED' || value === 'CANCELED') {
    return value;
  }

  return undefined;
}

function openedAfterForPeriod(period?: string) {
  const daysByPeriod: Record<string, number> = {
    '24h': 1,
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '12m': 365,
  };
  const days = daysByPeriod[period ?? ''];

  return days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined;
}

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
    ticket.provider,
    ticket.providerLabel,
    ticket.status,
    ticket.resolutionStatus,
    ticket.channel,
    ticket.group,
    ticket.tags.join(' '),
  ]
    .join(' ')
    .toLowerCase();

  return (
    matchesProvider(ticket, filters.provider) &&
    (!filters.status || ticket.status === filters.status) &&
    (!filters.queue || ticket.queue === filters.queue) &&
    (!filters.agent || ticket.agent === filters.agent) &&
    (!filters.sentiment || ticket.sentiment === filters.sentiment) &&
    (!rating || ticket.rating === rating) &&
    (!search || haystack.includes(search)) &&
    matchesPeriod(ticket, filters.period, filters.activeOnly)
  );
}

function matchesProvider(ticket: PresentedTicket, providerFilter?: string) {
  if (!providerFilter) {
    return true;
  }

  const providers = providerFilter
    .split(',')
    .map((provider) => provider.trim().toUpperCase())
    .filter(Boolean);

  return providers.length === 0 || providers.includes(ticket.provider);
}

function matchesPeriod(ticket: PresentedTicket, period?: string, activeOnly?: string) {
  if (activeOnly === 'true' || period === 'active') {
    return ticket.status === 'OPEN' || ticket.status === 'PENDING';
  }

  if (!period || period === 'all') {
    return true;
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
