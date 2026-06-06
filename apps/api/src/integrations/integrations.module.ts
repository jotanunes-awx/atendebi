import { Module } from '@nestjs/common';
import { QueueModule } from '../queues/queue.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationSyncProcessor } from './integration-sync.processor';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [QueueModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IntegrationSyncProcessor],
})
export class IntegrationsModule {}
