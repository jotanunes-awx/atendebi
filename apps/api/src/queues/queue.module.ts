import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EVENT_PROCESSING_QUEUE, INTEGRATION_SYNC_QUEUE } from './queue.constants';
import { EventProcessingProcessor } from './event-processing.processor';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: Number(configService.get<string>('REDIS_PORT', '6379')),
        },
      }),
    }),
    BullModule.registerQueue({
      name: EVENT_PROCESSING_QUEUE,
    }),
    BullModule.registerQueue({
      name: INTEGRATION_SYNC_QUEUE,
    }),
  ],
  providers: [EventProcessingProcessor],
  exports: [BullModule],
})
export class QueueModule {}
