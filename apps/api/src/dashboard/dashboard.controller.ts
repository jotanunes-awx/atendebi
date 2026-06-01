import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MockAuthenticatedUser } from '../common/auth/mock-auth.guard';
import { PERMISSION_GROUPS } from '../common/auth/app-roles';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { DashboardService } from './dashboard.service';

type RequestWithUser = {
  user?: MockAuthenticatedUser;
};

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(MockAuthGuard, RolesGuard)
@Roles(...PERMISSION_GROUPS.DASHBOARD_READ)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Returns overview metrics for the dashboard' })
  overview(@Req() request: RequestWithUser, @Query() filters: Record<string, string | undefined>) {
    return this.dashboardService.overview(request.user?.tenantId, filters);
  }

  @Get('drilldown')
  @ApiOperation({ summary: 'Returns dashboard drilldown records' })
  drilldown(@Req() request: RequestWithUser, @Query() filters: Record<string, string | undefined>) {
    return this.dashboardService.drilldown(request.user?.tenantId, filters);
  }
}
