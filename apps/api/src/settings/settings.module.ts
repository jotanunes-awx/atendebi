import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { TenantContextModule } from '../common/tenant/tenant-context.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [PrismaModule, TenantContextModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
