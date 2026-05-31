import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MockAuthenticatedUser } from '../common/auth/mock-auth.guard';
import { PERMISSION_GROUPS } from '../common/auth/app-roles';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { SettingsService } from './settings.service';

type RequestWithUser = {
  user?: MockAuthenticatedUser;
};

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(MockAuthGuard, RolesGuard)
@Roles(...PERMISSION_GROUPS.ADMIN_ONLY)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Returns tenant settings overview for the admin workspace' })
  overview(@Req() request: RequestWithUser) {
    return this.settingsService.overview(request.user?.tenantId);
  }
}
