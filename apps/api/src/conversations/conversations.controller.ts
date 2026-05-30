import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION_GROUPS } from '../common/auth/app-roles';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { conversationMessagesByTicketId, findConversationTicket } from './mock-conversation-history';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(MockAuthGuard, RolesGuard)
@Roles(...PERMISSION_GROUPS.CONVERSATION_READ)
@Controller('conversations')
export class ConversationsController {
  @Get(':ticketId/messages')
  @ApiOperation({ summary: 'Lists messages for a ticket conversation' })
  messages(@Param('ticketId') ticketId: string) {
    const ticket = findConversationTicket(ticketId);
    const messages = conversationMessagesByTicketId[ticketId];

    if (!ticket || !messages) {
      throw new NotFoundException('Conversation not found');
    }

    return {
      ticketId,
      summary: {
        customerName: ticket.customerName,
        queue: ticket.queue,
        agent: ticket.agent,
        status: ticket.status,
        resolutionStatus: ticket.resolutionStatus,
        rating: ticket.rating,
        sentiment: ticket.sentiment,
        tags: ticket.tags,
        summary: ticket.summary,
      },
      data: messages,
    };
  }
}
