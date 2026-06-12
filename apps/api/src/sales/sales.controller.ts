import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MockAuthenticatedUser } from '../common/auth/mock-auth.guard';
import { PERMISSION_GROUPS } from '../common/auth/app-roles';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { SalesService } from './sales.service';

type RequestWithUser = {
  user?: MockAuthenticatedUser;
};

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(MockAuthGuard, RolesGuard)
@Roles(...PERMISSION_GROUPS.DASHBOARD_READ)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Returns sales intelligence overview' })
  @ApiQuery({ name: 'period', required: false, description: 'Periodo: 24h, 7d, 30d, 90d, 12m, all (padrao 30d)' })
  overview(@Req() request: RequestWithUser, @Query('period') period?: string) {
    return this.salesService.overview(request.user?.tenantId, period);
  }
}
