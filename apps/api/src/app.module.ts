import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AgentsModule } from './agents/agents.module';
import { BotModule } from './bot/bot.module';
import { AuthModule } from './common/auth/auth.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { TenantContextModule } from './common/tenant/tenant-context.module';
import { ConversationsModule } from './conversations/conversations.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { QualityModule } from './quality/quality.module';
import { QueueModule } from './queues/queue.module';
import { SalesModule } from './sales/sales.module';
import { SettingsModule } from './settings/settings.module';
import { SupportQueuesModule } from './support-queues/support-queues.module';
import { TicketsModule } from './tickets/tickets.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: (config) => {
        if (!config.DATABASE_URL) {
          throw new Error('DATABASE_URL is required');
        }

        return config;
      },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: 'SYS:standard',
                },
              },
      },
    }),
    AuthModule,
    PrismaModule,
    TenantContextModule,
    QueueModule,
    HealthModule,
    IntegrationsModule,
    WebhooksModule,
    DashboardModule,
    TicketsModule,
    ConversationsModule,
    SupportQueuesModule,
    AgentsModule,
    QualityModule,
    BotModule,
    SalesModule,
    SettingsModule,
  ],
})
export class AppModule {}
