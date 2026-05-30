import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';
import { conversationTickets, findConversationTicket } from '../conversations/mock-conversation-history';

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(MockAuthGuard)
@Controller('tickets')
export class TicketsController {
  @Get()
  @ApiOperation({ summary: 'Lists tickets' })
  findAll() {
    return { data: conversationTickets };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Returns ticket details' })
  findOne(@Param('id') id: string) {
    const ticket = findConversationTicket(id);

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }
}
