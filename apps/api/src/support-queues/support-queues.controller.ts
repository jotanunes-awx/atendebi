import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';

@ApiTags('Queues')
@ApiBearerAuth()
@UseGuards(MockAuthGuard)
@Controller('queues')
export class SupportQueuesController {
  @Get()
  @ApiOperation({ summary: 'Lists support queues' })
  findAll() {
    return {
      data: [
        { id: 'queue-1', name: 'Suporte', openTickets: 18, averageWaitMinutes: 7.2 },
        { id: 'queue-2', name: 'Comercial', openTickets: 11, averageWaitMinutes: 4.1 },
        { id: 'queue-3', name: 'Financeiro', openTickets: 13, averageWaitMinutes: 9.8 },
      ],
    };
  }
}
