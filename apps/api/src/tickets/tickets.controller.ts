import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION_GROUPS } from '../common/auth/app-roles';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { conversationTickets, findConversationTicket } from '../conversations/mock-conversation-history';

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(MockAuthGuard, RolesGuard)
@Roles(...PERMISSION_GROUPS.CONVERSATION_READ)
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
