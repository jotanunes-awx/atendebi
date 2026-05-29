import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type IntegrationProvider } from '@prisma/client';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { EVENT_PROCESSING_QUEUE, RawEventProcessingJob } from '../queues/queue.constants';

@Injectable()
export class BlipWebhookService {
  private readonly logger = new Logger(BlipWebhookService.name);
  private readonly provider: IntegrationProvider = 'BLIP';

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(EVENT_PROCESSING_QUEUE)
    private readonly eventQueue: Queue<RawEventProcessingJob>,
  ) {}

  async receive(tenantKey: string, payload: Record<string, unknown>) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { key: tenantKey },
      select: { id: true, key: true, status: true },
    });

    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new NotFoundException('Tenant not found or inactive');
    }

    const payloadHash = this.hashPayload(payload);
    const providerEventId = this.extractString(payload, ['id', 'eventId', 'message.id', 'resource.id']);
    const eventType = this.extractString(payload, ['type', 'eventType', 'message.type', 'resource.type']);

    try {
      const rawEvent = await this.prisma.rawEvent.create({
        data: {
          tenantId: tenant.id,
          provider: this.provider,
          providerEventId,
          eventType,
          payloadHash,
          payload: payload as Prisma.InputJsonValue,
        },
      });

      await this.eventQueue.add(
        'normalize-blip-event',
        {
          rawEventId: rawEvent.id,
          tenantId: tenant.id,
        },
        {
          jobId: rawEvent.id,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );

      this.logger.log({
        message: 'BLiP webhook event received',
        tenantId: tenant.id,
        rawEventId: rawEvent.id,
        eventType,
      });

      return {
        status: 'received' as const,
        rawEventId: rawEvent.id,
        duplicate: false,
        queued: true,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const rawEvent = await this.prisma.rawEvent.findUnique({
          where: {
            tenantId_provider_payloadHash: {
              tenantId: tenant.id,
              provider: this.provider,
              payloadHash,
            },
          },
          select: { id: true },
        });

        if (rawEvent) {
          return {
            status: 'received' as const,
            rawEventId: rawEvent.id,
            duplicate: true,
            queued: false,
          };
        }
      }

      throw error;
    }
  }

  private hashPayload(payload: Record<string, unknown>) {
    return createHash('sha256').update(this.stableStringify(payload)).digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, childValue]) => `${JSON.stringify(key)}:${this.stableStringify(childValue)}`)
        .join(',')}}`;
    }

    return JSON.stringify(value);
  }

  private extractString(payload: Record<string, unknown>, paths: string[]) {
    for (const path of paths) {
      const value = this.readPath(payload, path);

      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }

    return undefined;
  }

  private readPath(payload: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }

      return (current as Record<string, unknown>)[key];
    }, payload);
  }
}
