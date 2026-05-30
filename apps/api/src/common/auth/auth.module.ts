import { Global, Module } from '@nestjs/common';
import { MockAuthGuard } from './mock-auth.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  providers: [MockAuthGuard, RolesGuard],
  exports: [MockAuthGuard, RolesGuard],
})
export class AuthModule {}
