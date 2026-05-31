import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MockAuthenticatedUser } from '../common/auth/mock-auth.guard';
import { PERMISSION_GROUPS } from '../common/auth/app-roles';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { SupportQueuesService } from './support-queues.service';

type RequestWithUser = {
  user?: MockAuthenticatedUser;
};

@ApiTags('Queues')
@ApiBearerAuth()
@UseGuards(MockAuthGuard, RolesGuard)
@Roles(...PERMISSION_GROUPS.OPERATIONS_READ)
@Controller('queues')
export class SupportQueuesController {
  constructor(private readonly supportQueuesService: SupportQueuesService) {}

  @Get()
  @ApiOperation({ summary: 'Lists support queues' })
  findAll(@Req() request: RequestWithUser) {
    return this.supportQueuesService.findAll(request.user?.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Returns support queue details' })
  findOne(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.supportQueuesService.findOne(request.user?.tenantId, id);
  }
}
