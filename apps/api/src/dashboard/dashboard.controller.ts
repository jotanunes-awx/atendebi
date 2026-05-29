import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(MockAuthGuard)
@Controller('dashboard')
export class DashboardController {
  @Get('overview')
  @ApiOperation({ summary: 'Returns overview metrics for the dashboard' })
  overview() {
    return {
      period: 'today',
      metrics: {
        totalTickets: 186,
        openTickets: 42,
        averageFirstResponseMinutes: 6.4,
        averageRating: 4.3,
        botFallbackRate: 12.8,
        complaints: 9,
        salesOpportunities: 27,
      },
      queues: [
        { name: 'Suporte', openTickets: 18, averageWaitMinutes: 7.2 },
        { name: 'Comercial', openTickets: 11, averageWaitMinutes: 4.1 },
        { name: 'Financeiro', openTickets: 13, averageWaitMinutes: 9.8 },
      ],
    };
  }
}
