import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { EVENT_PROCESSING_QUEUE, RawEventProcessingJob } from './queue.constants';

@Processor(EVENT_PROCESSING_QUEUE)
export class EventProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(EventProcessingProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<RawEventProcessingJob>) {
    const { rawEventId, tenantId } = job.data;

    this.logger.log({
      message: 'Starting raw event processing',
      jobId: job.id,
      rawEventId,
      tenantId,
    });

    await this.prisma.rawEvent.update({
      where: { id: rawEventId },
      data: { processingStatus: 'PROCESSING' },
    });

    try {
      // Normalization into contacts, tickets and messages will be implemented in the next MVP step.
      await this.prisma.rawEvent.update({
        where: { id: rawEventId },
        data: {
          processingStatus: 'PROCESSED',
          processedAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.rawEvent.update({
        where: { id: rawEventId },
        data: {
          processingStatus: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown processing error',
        },
      });

      throw error;
    }
  }
}
