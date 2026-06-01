import { Global, Module } from '@nestjs/common';
import { EntraTokenService } from './entra-token.service';
import { MockAuthGuard } from './mock-auth.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  providers: [EntraTokenService, MockAuthGuard, RolesGuard],
  exports: [EntraTokenService, MockAuthGuard, RolesGuard],
})
export class AuthModule {}
