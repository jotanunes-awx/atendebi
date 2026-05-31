import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MockAuthenticatedUser } from '../common/auth/mock-auth.guard';
import { PERMISSION_GROUPS } from '../common/auth/app-roles';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { BotService } from './bot.service';

type RequestWithUser = {
  user?: MockAuthenticatedUser;
};

@ApiTags('Bot')
@ApiBearerAuth()
@UseGuards(MockAuthGuard, RolesGuard)
@Roles(...PERMISSION_GROUPS.DASHBOARD_READ)
@Controller('bot')
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Returns bot intelligence overview' })
  overview(@Req() request: RequestWithUser) {
    return this.botService.overview(request.user?.tenantId);
  }
}
