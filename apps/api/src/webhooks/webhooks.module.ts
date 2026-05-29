import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { QueueModule } from '../queues/queue.module';
import { BlipWebhookController } from './blip-webhook.controller';
import { BlipWebhookService } from './blip-webhook.service';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [BlipWebhookController],
  providers: [BlipWebhookService],
})
export class WebhooksModule {}
