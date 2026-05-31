import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MockAuthenticatedUser } from '../common/auth/mock-auth.guard';
import { PERMISSION_GROUPS } from '../common/auth/app-roles';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { TicketFilters, TicketsService } from './tickets.service';

type RequestWithUser = {
  user?: MockAuthenticatedUser;
};

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(MockAuthGuard, RolesGuard)
@Roles(...PERMISSION_GROUPS.CONVERSATION_READ)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @ApiOperation({ summary: 'Lists tickets' })
  findAll(@Req() request: RequestWithUser, @Query() filters: TicketFilters) {
    return this.ticketsService.findAll(request.user?.tenantId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Returns ticket details' })
  findOne(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.ticketsService.findOne(request.user?.tenantId, id);
  }
}
