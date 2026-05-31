import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MockAuthenticatedUser } from '../common/auth/mock-auth.guard';
import { PERMISSION_GROUPS } from '../common/auth/app-roles';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { QualityService } from './quality.service';

type RequestWithUser = {
  user?: MockAuthenticatedUser;
};

@ApiTags('Quality')
@ApiBearerAuth()
@UseGuards(MockAuthGuard, RolesGuard)
@Roles(...PERMISSION_GROUPS.OPERATIONS_READ)
@Controller('quality')
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Returns quality overview metrics' })
  overview(@Req() request: RequestWithUser) {
    return this.qualityService.overview(request.user?.tenantId);
  }
}
