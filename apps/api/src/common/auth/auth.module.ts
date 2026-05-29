import { Global, Module } from '@nestjs/common';
import { MockAuthGuard } from './mock-auth.guard';

@Global()
@Module({
  providers: [MockAuthGuard],
  exports: [MockAuthGuard],
})
export class AuthModule {}
