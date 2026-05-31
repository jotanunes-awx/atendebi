import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PERMISSION_GROUPS } from '../common/auth/app-roles';
import { MockAuthenticatedUser, MockAuthGuard } from '../common/auth/mock-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { IntegrationsService } from './integrations.service';

type RequestWithUser = {
  user?: MockAuthenticatedUser;
};

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(MockAuthGuard, RolesGuard)
@Roles(...PERMISSION_GROUPS.ADMIN_ONLY)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lists tenant integration readiness for BLiP, GLPI and Teams Phone' })
  list(@Req() request: RequestWithUser) {
    return this.integrationsService.list(request.user?.tenantId);
  }

  @Get(':provider')
  @ApiOperation({ summary: 'Returns one integration readiness report' })
  @ApiParam({ name: 'provider', example: 'GLPI', description: 'BLIP, GLPI or TEAMS_PHONE' })
  getOne(@Param('provider') provider: string, @Req() request: RequestWithUser) {
    return this.integrationsService.getOne(provider, request.user?.tenantId);
  }

  @Post(':provider/test')
  @ApiOperation({ summary: 'Runs a readiness test for one integration without exposing secrets' })
  @ApiParam({ name: 'provider', example: 'TEAMS_PHONE', description: 'BLIP, GLPI or TEAMS_PHONE' })
  test(@Param('provider') provider: string, @Req() request: RequestWithUser) {
    return this.integrationsService.test(provider, request.user?.tenantId);
  }

  @Post(':provider/sync')
  @ApiOperation({ summary: 'Registers a sync dry-run for GLPI or Teams Phone' })
  @ApiParam({ name: 'provider', example: 'GLPI', description: 'GLPI or TEAMS_PHONE' })
  sync(@Param('provider') provider: string, @Req() request: RequestWithUser) {
    return this.integrationsService.sync(provider, request.user?.tenantId);
  }
}
