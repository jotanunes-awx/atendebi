import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { presentMessage, presentTicket, ticketInclude } from '../common/data/ticket-presenter';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async messages(tenantHeader: string | undefined, ticketId: string) {
    const tenantId = await this.tenantContext.resolveTenantId(tenantHeader);

    if (!tenantId) {
      throw new NotFoundException('Conversation not found');
    }

    const ticket = await this.prisma.ticket.findFirst({
      where: {
        tenantId,
        OR: [{ id: ticketId }, { externalId: ticketId }],
      },
      include: ticketInclude,
    });

    if (!ticket) {
      throw new NotFoundException('Conversation not found');
    }

    const presentedTicket = presentTicket(ticket);

    return {
      ticketId: presentedTicket.id,
      summary: {
        customerName: presentedTicket.customerName,
        queue: presentedTicket.queue,
        agent: presentedTicket.agent,
        status: presentedTicket.status,
        resolutionStatus: presentedTicket.resolutionStatus,
        rating: presentedTicket.rating,
        sentiment: presentedTicket.sentiment,
        risk: presentedTicket.risk,
        tags: presentedTicket.tags,
        summary: presentedTicket.summary,
      },
      data: ticket.messages.map(presentMessage),
    };
  }
}
