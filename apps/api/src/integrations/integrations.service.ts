import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationProvider, Prisma, RawEventStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';

const supportedProviders = [IntegrationProvider.BLIP, IntegrationProvider.GLPI, IntegrationProvider.TEAMS_PHONE] as const;

type SupportedProvider = (typeof supportedProviders)[number];

type RawEventStats = {
  count: number;
  lastEventAt: string | null;
};

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly configService: ConfigService,
  ) {}

  async list(tenantHeader?: string) {
    const tenantId = await this.tenantContext.resolveTenantId(tenantHeader);

    if (!tenantId) {
      return { data: [] };
    }

    const [tenant, rawEventStats] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          integrationConfigs: {
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.getRawEventStats(tenantId),
    ]);

    if (!tenant) {
      return { data: [] };
    }

    const configByProvider = new Map(tenant.integrationConfigs.map((config) => [config.provider, config]));

    return {
      data: supportedProviders.map((provider) =>
        this.buildSummary({
          provider,
          tenantKey: tenant.key,
          config: configByProvider.get(provider),
          stats: rawEventStats.get(provider) ?? { count: 0, lastEventAt: null },
        }),
      ),
    };
  }

  async getOne(providerParam: string, tenantHeader?: string) {
    const provider = parseProvider(providerParam);
    const response = await this.list(tenantHeader);
    const integration = response.data.find((item) => item.provider === provider);

    if (!integration) {
      throw new NotFoundException('Integration not found for tenant');
    }

    return {
      ...integration,
      checklist: buildChecklist(provider, integration.missingSettings),
    };
  }

  async test(providerParam: string, tenantHeader?: string) {
    const provider = parseProvider(providerParam);
    const integration = await this.getOne(provider, tenantHeader);
    const ok = integration.missingSettings.length === 0;

    return {
      provider,
      checkedAt: new Date().toISOString(),
      ok,
      status: ok ? 'ready' : 'missing_credentials',
      message: ok ? readyMessage(provider) : missingMessage(provider, integration.missingSettings),
      details: integration.checklist,
    };
  }

  async sync(providerParam: string, tenantHeader?: string) {
    const provider = parseProvider(providerParam);

    if (provider === IntegrationProvider.BLIP) {
      throw new BadRequestException('BLiP sync is webhook-driven. Use POST /webhooks/blip/:tenantKey.');
    }

    const tenantId = await this.tenantContext.resolveTenantId(tenantHeader);

    if (!tenantId) {
      throw new NotFoundException('Tenant not found or inactive');
    }

    const readiness = await this.getOne(provider, tenantHeader);

    if (readiness.missingSettings.length > 0) {
      return {
        provider,
        accepted: false,
        status: 'missing_credentials',
        message: missingMessage(provider, readiness.missingSettings),
      };
    }

    const now = new Date();
    const payload = {
      provider,
      type: 'integration.sync.requested',
      requestedAt: now.toISOString(),
      mode: 'dry-run',
      note: 'Sync real sera implementado no conector especifico. Este registro valida tenant, configuracao e auditoria.',
    };
    const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    const rawEvent = await this.prisma.rawEvent.create({
      data: {
        tenantId,
        provider,
        eventType: 'integration.sync.requested',
        payloadHash,
        payload,
        processingStatus: RawEventStatus.IGNORED,
        processedAt: now,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'integration.sync.dry_run',
        entityType: 'integration',
        entityId: provider,
        metadata: {
          rawEventId: rawEvent.id,
          provider,
        },
      },
    });

    return {
      provider,
      accepted: true,
      status: 'registered',
      rawEventId: rawEvent.id,
      message: 'Sync dry-run registrado em raw_events para validar o fluxo sem chamar sistema externo.',
    };
  }

  private async getRawEventStats(tenantId: string) {
    const rows = await this.prisma.rawEvent.groupBy({
      by: ['provider'],
      where: { tenantId },
      _count: { _all: true },
      _max: { receivedAt: true },
    });

    return new Map<IntegrationProvider, RawEventStats>(
      rows.map((row) => [
        row.provider,
        {
          count: row._count._all,
          lastEventAt: row._max.receivedAt?.toISOString() ?? null,
        },
      ]),
    );
  }

  private buildSummary({
    provider,
    tenantKey,
    config,
    stats,
  }: {
    provider: SupportedProvider;
    tenantKey: string;
    config?: {
      provider: IntegrationProvider;
      name: string;
      tenantKey: string | null;
      settings: Prisma.JsonValue | null;
      isActive: boolean;
      updatedAt: Date;
    };
    stats: RawEventStats;
  }) {
    const settings = asRecord(config?.settings);
    const missingSettings = this.getMissingSettings(provider, settings);
    const configured = missingSettings.length === 0;
    const active = Boolean(config?.isActive && configured);
    const status = active ? 'connected' : configured ? 'ready' : 'pending';

    return {
      provider,
      label: providerLabel(provider),
      name: config?.name ?? providerLabel(provider),
      category: providerCategory(provider),
      description: providerDescription(provider),
      status,
      statusLabel: statusLabel(status),
      configured,
      active,
      tenantKey: provider === IntegrationProvider.BLIP ? config?.tenantKey ?? tenantKey : undefined,
      webhookUrl: provider === IntegrationProvider.BLIP ? this.buildBlipWebhookUrl(config?.tenantKey ?? tenantKey) : undefined,
      rawEvents: stats.count,
      lastEventAt: stats.lastEventAt ?? config?.updatedAt.toISOString() ?? null,
      missingSettings,
      requiredSettings: requiredSettings(provider),
      nextAction: nextAction(provider, missingSettings),
      capabilities: capabilities(provider),
      settingsPreview: this.buildSettingsPreview(provider, settings),
    };
  }

  private getMissingSettings(provider: SupportedProvider, settings: Record<string, unknown>): string[] {
    if (provider === IntegrationProvider.BLIP) {
      const missing = settings.webhookSecretRequired && !this.configService.get<string>('BLIP_WEBHOOK_SECRET') ? ['BLIP_WEBHOOK_SECRET'] : [];
      return missing;
    }

    if (provider === IntegrationProvider.GLPI) {
      const checks: Array<[string | undefined, string]> = [
        [readString(settings, 'baseUrl') || this.configService.get<string>('GLPI_BASE_URL'), 'GLPI_BASE_URL'],
        [this.configService.get<string>('GLPI_APP_TOKEN'), 'GLPI_APP_TOKEN'],
        [this.configService.get<string>('GLPI_USER_TOKEN'), 'GLPI_USER_TOKEN'],
      ];

      return checks.filter(([value]) => !value).map(([, key]) => key);
    }

    const checks: Array<[string | undefined, string]> = [
      [readString(settings, 'tenantId') || this.configService.get<string>('TEAMS_TENANT_ID'), 'TEAMS_TENANT_ID'],
      [readString(settings, 'clientId') || this.configService.get<string>('TEAMS_CLIENT_ID'), 'TEAMS_CLIENT_ID'],
      [this.configService.get<string>('TEAMS_CLIENT_SECRET'), 'TEAMS_CLIENT_SECRET'],
    ];

    return checks.filter(([value]) => !value).map(([, key]) => key);
  }

  private buildSettingsPreview(provider: SupportedProvider, settings: Record<string, unknown>) {
    if (provider === IntegrationProvider.BLIP) {
      return {
        mode: readString(settings, 'mode') || 'webhook',
        sourceRetentionDays: readNumber(settings, 'sourceRetentionDays') ?? 90,
        atendebiRetentionDays: readNumber(settings, 'atendebiRetentionDays') ?? Number(this.configService.get<string>('ATENDEBI_RETENTION_DAYS', '730')),
      };
    }

    if (provider === IntegrationProvider.GLPI) {
      const baseUrl = readString(settings, 'baseUrl') || this.configService.get<string>('GLPI_BASE_URL') || '';

      return {
        baseUrl: maskUrl(baseUrl),
        apiPath: readString(settings, 'apiPath') || '/apirest.php',
        authMethod: 'App Token + User Token',
        syncStrategy: 'Polling incremental',
        syncEnabled: this.configService.get<string>('GLPI_SYNC_ENABLED', 'false') === 'true',
      };
    }

    return {
      tenantId: maskId(readString(settings, 'tenantId') || this.configService.get<string>('TEAMS_TENANT_ID') || ''),
      clientId: maskId(readString(settings, 'clientId') || this.configService.get<string>('TEAMS_CLIENT_ID') || ''),
      authMethod: 'Microsoft Graph application permissions',
      permissions: ['CallRecords.Read.All', 'Reports.Read.All'],
      syncEnabled: this.configService.get<string>('TEAMS_SYNC_ENABLED', 'false') === 'true',
    };
  }

  private buildBlipWebhookUrl(tenantKey: string) {
    const baseUrl =
      this.configService.get<string>('WEBHOOK_PUBLIC_BASE_URL') ??
      `http://localhost:${this.configService.get<string>('PORT') ?? this.configService.get<string>('API_PORT') ?? '3333'}`;

    return `${baseUrl.replace(/\/$/, '')}/webhooks/blip/${tenantKey}`;
  }
}

function parseProvider(providerParam: string): SupportedProvider {
  const normalized = providerParam.trim().toUpperCase().replace(/[-\s]/g, '_');

  if (normalized === 'BLIP') {
    return IntegrationProvider.BLIP;
  }

  if (normalized === 'GLPI') {
    return IntegrationProvider.GLPI;
  }

  if (normalized === 'TEAMS' || normalized === 'TEAMS_PHONE' || normalized === 'TEAMS_PABX' || normalized === 'PABX') {
    return IntegrationProvider.TEAMS_PHONE;
  }

  throw new BadRequestException('Unsupported provider. Use BLIP, GLPI or TEAMS_PHONE.');
}

function providerLabel(provider: SupportedProvider) {
  const labels = {
    [IntegrationProvider.BLIP]: 'BLiP',
    [IntegrationProvider.GLPI]: 'GLPI',
    [IntegrationProvider.TEAMS_PHONE]: 'Teams Phone / PABX',
  };

  return labels[provider];
}

function providerCategory(provider: SupportedProvider) {
  const categories = {
    [IntegrationProvider.BLIP]: 'Atendimento conversacional',
    [IntegrationProvider.GLPI]: 'ITSM / chamados',
    [IntegrationProvider.TEAMS_PHONE]: 'Telefonia corporativa',
  };

  return categories[provider];
}

function providerDescription(provider: SupportedProvider) {
  const descriptions = {
    [IntegrationProvider.BLIP]: 'Coleta mensagens, tickets e eventos de atendimento via webhook.',
    [IntegrationProvider.GLPI]: 'Coleta chamados, categorias, tecnicos, SLA e historico de suporte interno.',
    [IntegrationProvider.TEAMS_PHONE]: 'Coleta chamadas, filas, atendentes, duracao e abandono via Microsoft Graph.',
  };

  return descriptions[provider];
}

function requiredSettings(provider: SupportedProvider) {
  if (provider === IntegrationProvider.BLIP) {
    return ['WEBHOOK_PUBLIC_BASE_URL', 'BLIP_WEBHOOK_SECRET quando o secret for obrigatorio'];
  }

  if (provider === IntegrationProvider.GLPI) {
    return ['GLPI_BASE_URL', 'GLPI_APP_TOKEN', 'GLPI_USER_TOKEN'];
  }

  return ['TEAMS_TENANT_ID', 'TEAMS_CLIENT_ID', 'TEAMS_CLIENT_SECRET', 'Permissoes Graph com admin consent'];
}

function capabilities(provider: SupportedProvider) {
  if (provider === IntegrationProvider.BLIP) {
    return ['Conversas', 'Mensagens', 'Filas', 'Atendentes', 'Bot', 'Qualidade'];
  }

  if (provider === IntegrationProvider.GLPI) {
    return ['Chamados', 'SLA', 'Tecnicos', 'Categorias', 'Tempo de resolucao', 'Backlog'];
  }

  return ['Ligacoes', 'Filas de atendimento', 'Duracao', 'Abandono', 'Atendentes', 'Relatorios Graph'];
}

function nextAction(provider: SupportedProvider, missingSettings: string[]) {
  if (missingSettings.length === 0) {
    return provider === IntegrationProvider.BLIP
      ? 'Configurar o webhook na plataforma e acompanhar raw_events.'
      : 'Executar teste de prontidao e habilitar o conector real de sincronismo.';
  }

  return `Configurar ${missingSettings.join(', ')} no .env da API e rodar o seed novamente.`;
}

function readyMessage(provider: SupportedProvider) {
  if (provider === IntegrationProvider.BLIP) {
    return 'Webhook BLiP pronto para receber eventos. O token continua fora do frontend.';
  }

  if (provider === IntegrationProvider.GLPI) {
    return 'Credenciais GLPI presentes. O proximo passo e ativar chamada real /initSession em homologacao.';
  }

  return 'Credenciais Teams presentes. O proximo passo e validar admin consent e consultar Microsoft Graph Call Records.';
}

function missingMessage(provider: SupportedProvider, missingSettings: string[]) {
  return `${providerLabel(provider)} ainda precisa de configuracao: ${missingSettings.join(', ')}.`;
}

function buildChecklist(provider: SupportedProvider, missingSettings: string[]) {
  const baseChecklist = {
    [IntegrationProvider.BLIP]: [
      'Cadastrar a URL do webhook no BLiP.',
      'Manter token/chave BLiP apenas no backend ou cofre.',
      'Validar x-atendebi-webhook-secret quando WEBHOOK_SECRET_REQUIRED=true.',
    ],
    [IntegrationProvider.GLPI]: [
      'Habilitar API REST do GLPI.',
      'Gerar App Token no GLPI.',
      'Gerar User Token de usuario tecnico com escopo adequado.',
      'Definir GLPI_BASE_URL, GLPI_APP_TOKEN e GLPI_USER_TOKEN no .env.',
    ],
    [IntegrationProvider.TEAMS_PHONE]: [
      'Criar App Registration no Entra ID.',
      'Adicionar permissoes Application CallRecords.Read.All e Reports.Read.All.',
      'Conceder admin consent.',
      'Definir TEAMS_TENANT_ID, TEAMS_CLIENT_ID e TEAMS_CLIENT_SECRET no .env.',
    ],
  }[provider];

  return baseChecklist.map((item) => ({
    item,
    status: missingSettings.length === 0 || !missingSettings.some((missing) => item.includes(missing.replace('_', ' '))) ? 'planned' : 'missing',
  }));
}

function statusLabel(status: string) {
  if (status === 'connected') {
    return 'Conectado';
  }

  if (status === 'ready') {
    return 'Pronto para testar';
  }

  return 'Pendente configuracao';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === 'string' ? value : '';
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === 'number' ? value : null;
}

function maskUrl(value: string) {
  if (!value) {
    return 'Nao configurado';
  }

  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
  } catch {
    return value.replace(/\/\/.*@/, '//***@');
  }
}

function maskId(value: string) {
  if (!value) {
    return 'Nao configurado';
  }

  return value.length <= 8 ? '***' : `${value.slice(0, 4)}...${value.slice(-4)}`;
}
