import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MockAuthGuard } from '../common/auth/mock-auth.guard';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(MockAuthGuard)
@Controller('conversations')
export class ConversationsController {
  @Get(':ticketId/messages')
  @ApiOperation({ summary: 'Lists messages for a ticket conversation' })
  messages(@Param('ticketId') ticketId: string) {
    return {
      ticketId,
      data: [
        {
          id: 'msg-1',
          direction: 'INBOUND',
          senderName: 'Cliente',
          content: 'Preciso acompanhar meu pedido.',
          sentAt: '2026-05-29T11:16:00.000Z',
        },
        {
          id: 'msg-2',
          direction: 'OUTBOUND',
          senderName: 'Ana Lima',
          content: 'Claro, vou verificar o status agora.',
          sentAt: '2026-05-29T11:17:00.000Z',
        },
      ],
    };
  }
}
