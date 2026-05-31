import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MockAuthenticatedUser } from '../common/auth/mock-auth.guard';
import { PERMISSION_GROUPS } from '../common/auth/app-roles';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { AgentsService } from './agents.service';

type RequestWithUser = {
  user?: MockAuthenticatedUser;
};

@ApiTags('Agents')
@ApiBearerAuth()
@UseGuards(MockAuthGuard, RolesGuard)
@Roles(...PERMISSION_GROUPS.OPERATIONS_READ)
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @ApiOperation({ summary: 'Lists agents' })
  findAll(@Req() request: RequestWithUser) {
    return this.agentsService.findAll(request.user?.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Returns agent details' })
  findOne(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.agentsService.findOne(request.user?.tenantId, id);
  }
}
