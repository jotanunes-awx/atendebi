import { Module } from '@nestjs/common';
import { SupportQueuesController } from './support-queues.controller';

@Module({
  controllers: [SupportQueuesController],
})
export class SupportQueuesModule {}
