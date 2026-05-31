import { Module } from '@nestjs/common';
import { SupportQueuesController } from './support-queues.controller';
import { SupportQueuesService } from './support-queues.service';

@Module({
  controllers: [SupportQueuesController],
  providers: [SupportQueuesService],
})
export class SupportQueuesModule {}
