import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MockAuthenticatedUser } from '../common/auth/mock-auth.guard';
import { PERMISSION_GROUPS } from '../common/auth/app-roles';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { ConversationsService } from './conversations.service';

type RequestWithUser = {
  user?: MockAuthenticatedUser;
};

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(MockAuthGuard, RolesGuard)
@Roles(...PERMISSION_GROUPS.CONVERSATION_READ)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get(':ticketId/messages')
  @ApiOperation({ summary: 'Lists messages for a ticket conversation' })
  messages(@Req() request: RequestWithUser, @Param('ticketId') ticketId: string) {
    return this.conversationsService.messages(request.user?.tenantId, ticketId);
  }
}
