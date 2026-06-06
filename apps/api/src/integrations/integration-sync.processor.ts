import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { IntegrationsService } from './integrations.service';
import { INTEGRATION_SYNC_QUEUE, type IntegrationSyncJob } from '../queues/queue.constants';

@Processor(INTEGRATION_SYNC_QUEUE, { concurrency: 1 })
export class IntegrationSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationSyncProcessor.name);

  constructor(private readonly integrationsService: IntegrationsService) {
    super();
  }

  async process(job: Job<IntegrationSyncJob>) {
    const { provider, tenantId } = job.data;

    this.logger.log({
      message: 'Starting integration sync job',
      jobId: job.id,
      provider,
      tenantId,
    });

    const result = await this.integrationsService.runSyncNow(provider, tenantId);

    this.logger.log({
      message: 'Integration sync job completed',
      jobId: job.id,
      provider,
      tenantId,
      resultStatus: result.status,
      imported: 'imported' in result ? result.imported : undefined,
    });

    return result;
  }
}
