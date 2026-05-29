import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';

const tickets = [
  {
    id: 'ticket-1001',
    customerName: 'Marina Costa',
    queue: 'Suporte',
    agent: 'Ana Lima',
    status: 'OPEN',
    rating: 5,
    openedAt: '2026-05-29T11:15:00.000Z',
  },
  {
    id: 'ticket-1002',
    customerName: 'Joao Pereira',
    queue: 'Financeiro',
    agent: 'Carlos Souza',
    status: 'PENDING',
    rating: 2,
    openedAt: '2026-05-29T12:40:00.000Z',
  },
];

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(MockAuthGuard)
@Controller('tickets')
export class TicketsController {
  @Get()
  @ApiOperation({ summary: 'Lists tickets' })
  findAll() {
    return { data: tickets };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Returns ticket details' })
  findOne(@Param('id') id: string) {
    return tickets.find((ticket) => ticket.id === id) ?? { id, status: 'NOT_FOUND' };
  }
}
