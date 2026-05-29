import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';

@ApiTags('Agents')
@ApiBearerAuth()
@UseGuards(MockAuthGuard)
@Controller('agents')
export class AgentsController {
  @Get()
  @ApiOperation({ summary: 'Lists agents' })
  findAll() {
    return {
      data: [
        { id: 'agent-1', name: 'Ana Lima', queue: 'Suporte', ticketsHandled: 38, averageRating: 4.8 },
        { id: 'agent-2', name: 'Carlos Souza', queue: 'Financeiro', ticketsHandled: 24, averageRating: 3.9 },
        { id: 'agent-3', name: 'Beatriz Rocha', queue: 'Comercial', ticketsHandled: 31, averageRating: 4.5 },
      ],
    };
  }
}
