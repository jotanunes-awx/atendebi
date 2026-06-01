import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationProvider, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly configService: ConfigService,
  ) {}

  async overview(tenantHeader?: string) {
    const tenantId = await this.tenantContext.resolveTenantId(tenantHeader);

    if (!tenantId) {
      return emptySettingsOverview();
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        integrationConfigs: {
          orderBy: { createdAt: 'asc' },
        },
        roles: {
          include: {
            _count: {
              select: { users: true },
            },
          },
          orderBy: { name: 'asc' },
        },
        users: {
          include: {
            roles: {
              include: { role: true },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!tenant) {
      return emptySettingsOverview();
    }

    const [rawEventCount, latestRawEvent, rawEventGroups, ticketGroups] = await Promise.all([
      this.prisma.rawEvent.count({ where: { tenantId } }),
      this.prisma.rawEvent.findFirst({
        where: { tenantId },
        orderBy: { receivedAt: 'desc' },
      }),
      this.prisma.rawEvent.groupBy({
        by: ['provider'],
        where: { tenantId },
        _count: { _all: true },
        _max: { receivedAt: true },
      }),
      this.prisma.ticket.findMany({
        where: { tenantId },
        select: {
          metadata: true,
          status: true,
          channel: true,
        },
      }),
    ]);

    const integration = tenant.integrationConfigs.find((config) => config.provider === 'BLIP');
    const rawEventStats = new Map(
      rawEventGroups.map((group) => [
        group.provider,
        {
          count: group._count._all,
          lastEventAt: group._max.receivedAt?.toISOString() ?? null,
        },
      ]),
    );
    const blipStats = rawEventStats.get(IntegrationProvider.BLIP);
    const retentionDays = Number(this.configService.get<string>('ATENDEBI_RETENTION_DAYS', '730'));
    const sourceRetentionDays = Number(this.configService.get<string>('BLIP_SOURCE_RETENTION_DAYS', '90'));
    const webhookSecretRequired = this.configService.get<string>('WEBHOOK_SECRET_REQUIRED', 'false').toLowerCase() === 'true';
    const integrations = buildIntegrationSummaries({
      configs: tenant.integrationConfigs,
      tenantKey: tenant.key,
      rawEventStats,
      configService: this.configService,
      fallbackUpdatedAt: tenant.updatedAt,
    });

    return {
      source: 'api' as const,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        key: tenant.key,
        status: tenant.status,
      },
      integration: {
        provider: integration?.provider ?? 'BLIP',
        name: integration?.name ?? 'BLiP',
        status: integration?.isActive ? 'Conectado' : 'Pendente',
        tenantKey: integration?.tenantKey ?? tenant.key,
        webhookUrl: this.buildWebhookUrl(tenant.key),
        lastEventAt:
          blipStats?.lastEventAt ?? latestRawEvent?.receivedAt.toISOString() ?? integration?.updatedAt.toISOString() ?? tenant.updatedAt.toISOString(),
        rawEvents: blipStats?.count ?? rawEventCount,
        webhookSecretRequired,
      },
      integrations,
      security: {
        authMode:
          this.configService.get<string>('AUTH_MODE', 'mock') === 'entra'
            ? 'Microsoft Entra ID'
            : 'Mock local com fallback para Entra ID',
        tokenValidation:
          this.configService.get<string>('AUTH_MODE', 'mock') === 'entra'
            ? 'JWT Bearer validado via JWKS do Entra ID'
            : 'Headers mockados no desenvolvimento; JWT/OIDC disponivel para homologacao',
        structuredAudit: true,
        maskSensitiveData: true,
        blipTokenInFrontend: false,
      },
      retention: {
        sourceRetentionDays,
        retentionDays,
        retentionPolicy: `${Math.round(retentionDays / 30)} meses em banco proprio por tenant`,
        estimatedStorageGb: Math.round((retentionDays / 30) * 4.8),
      },
      users: tenant.users.map((user) => ({
        name: user.name,
        email: user.email,
        role: user.roles[0]?.role.name ?? 'ATENDEBI_ATENDENTE',
        status: user.status,
        area: inferArea(user.roles[0]?.role.name),
        lastAccess: 'Mock local',
      })),
      roles: tenant.roles.map((role) => ({
        role: role.name,
        label: role.name.replace('ATENDEBI_', ''),
        description: role.description ?? 'Perfil operacional AtendeBI',
        users: role._count.users,
      })),
      groups: buildGroups(ticketGroups),
      lgpd: {
        purpose: 'BI, auditoria, qualidade e inteligencia de atendimento',
        aiEnabled: false,
        aiConsentRequired: true,
        dataMinimization: true,
        auditLogs: true,
      },
    };
  }

  private buildWebhookUrl(tenantKey: string) {
    const baseUrl =
      this.configService.get<string>('WEBHOOK_PUBLIC_BASE_URL') ??
      `http://localhost:${this.configService.get<string>('PORT') ?? this.configService.get<string>('API_PORT') ?? '3333'}`;

    return `${baseUrl.replace(/\/$/, '')}/webhooks/blip/${tenantKey}`;
  }
}

type TicketGroupSeed = {
  metadata: Prisma.JsonValue | null;
  status: string;
  channel: string | null;
};

function buildGroups(tickets: TicketGroupSeed[]) {
  const groups = new Map<
    string,
    {
      name: string;
      tickets: number;
      openTickets: number;
      channels: Set<string>;
    }
  >();

  for (const ticket of tickets) {
    const metadata = asRecord(ticket.metadata);
    const groupName = readString(metadata, 'group', 'Sem grupo');
    const current = groups.get(groupName) ?? {
      name: groupName,
      tickets: 0,
      openTickets: 0,
      channels: new Set<string>(),
    };

    current.tickets += 1;

    if (ticket.status === 'OPEN' || ticket.status === 'PENDING') {
      current.openTickets += 1;
    }

    if (ticket.channel) {
      current.channels.add(ticket.channel);
    }

    groups.set(groupName, current);
  }

  return Array.from(groups.values())
    .sort((left, right) => right.tickets - left.tickets)
    .slice(0, 12)
    .map((group) => ({
      id: slug(group.name),
      name: group.name,
      tickets: group.tickets,
      openTickets: group.openTickets,
      channels: Array.from(group.channels),
    }));
}

function inferArea(role?: string) {
  if (role?.includes('COMERCIAL')) {
    return 'Comercial';
  }

  if (role?.includes('QUALIDADE')) {
    return 'Qualidade';
  }

  if (role?.includes('DIRETORIA')) {
    return 'Diretoria';
  }

  if (role?.includes('ADMIN')) {
    return 'TI / Administracao';
  }

  return 'Atendimento';
}

function emptySettingsOverview() {
  return {
    source: 'empty' as const,
    tenant: null,
    integration: null,
    integrations: [],
    security: null,
    retention: null,
    users: [],
    roles: [],
    groups: [],
    lgpd: null,
  };
}

type IntegrationConfigSeed = {
  provider: IntegrationProvider;
  name: string;
  tenantKey: string | null;
  settings: Prisma.JsonValue | null;
  isActive: boolean;
  updatedAt: Date;
};

type ProviderStats = Map<IntegrationProvider, { count: number; lastEventAt: string | null }>;

const integrationProviders = [IntegrationProvider.BLIP, IntegrationProvider.GLPI, IntegrationProvider.TEAMS_PHONE] as const;

function buildIntegrationSummaries({
  configs,
  tenantKey,
  rawEventStats,
  configService,
  fallbackUpdatedAt,
}: {
  configs: IntegrationConfigSeed[];
  tenantKey: string;
  rawEventStats: ProviderStats;
  configService: ConfigService;
  fallbackUpdatedAt: Date;
}) {
  const configByProvider = new Map(configs.map((config) => [config.provider, config]));

  return integrationProviders.map((provider) => {
    const config = configByProvider.get(provider);
    const stats = rawEventStats.get(provider);
    const settings = asRecord(config?.settings);
    const missingSettings = getMissingIntegrationSettings(provider, settings, configService);
    const configured = missingSettings.length === 0;
    const active = Boolean(config?.isActive && configured);
    const status = active ? 'connected' : configured ? 'ready' : 'pending';

    return {
      provider,
      label: integrationLabel(provider),
      name: config?.name ?? integrationLabel(provider),
      category: integrationCategory(provider),
      description: integrationDescription(provider),
      status,
      statusLabel: status === 'connected' ? 'Conectado' : status === 'ready' ? 'Pronto para testar' : 'Pendente configuracao',
      configured,
      active,
      tenantKey: provider === IntegrationProvider.BLIP ? config?.tenantKey ?? tenantKey : undefined,
      webhookUrl: provider === IntegrationProvider.BLIP ? buildWebhookUrl(configService, config?.tenantKey ?? tenantKey) : undefined,
      rawEvents: stats?.count ?? 0,
      lastEventAt: stats?.lastEventAt ?? config?.updatedAt.toISOString() ?? fallbackUpdatedAt.toISOString(),
      missingSettings,
      requiredSettings: integrationRequiredSettings(provider),
      nextAction:
        missingSettings.length > 0
          ? `Configurar ${missingSettings.join(', ')} no .env da API.`
          : provider === IntegrationProvider.BLIP
            ? 'Cadastrar webhook na origem e acompanhar raw_events.'
            : 'Executar teste de prontidao e ativar sincronismo real.',
      capabilities: integrationCapabilities(provider),
      settingsPreview: integrationSettingsPreview(provider, settings, configService),
    };
  });
}

function getMissingIntegrationSettings(provider: IntegrationProvider, settings: Record<string, unknown>, configService: ConfigService) {
  if (provider === IntegrationProvider.BLIP) {
    const webhookSecretRequired = configService.get<string>('WEBHOOK_SECRET_REQUIRED', 'false').toLowerCase() === 'true';
    return webhookSecretRequired && !configService.get<string>('BLIP_WEBHOOK_SECRET') ? ['BLIP_WEBHOOK_SECRET'] : [];
  }

  if (provider === IntegrationProvider.GLPI) {
    return [
      [readString(settings, 'baseUrl', '') || configService.get<string>('GLPI_BASE_URL'), 'GLPI_BASE_URL'],
      [configService.get<string>('GLPI_APP_TOKEN'), 'GLPI_APP_TOKEN'],
      [configService.get<string>('GLPI_USER_TOKEN'), 'GLPI_USER_TOKEN'],
    ]
      .filter(([value]) => !hasConfiguredValue(value))
      .map(([, key]) => key as string);
  }

  return [
    [readString(settings, 'tenantId', '') || configService.get<string>('TEAMS_TENANT_ID'), 'TEAMS_TENANT_ID'],
    [readString(settings, 'clientId', '') || configService.get<string>('TEAMS_CLIENT_ID'), 'TEAMS_CLIENT_ID'],
    [configService.get<string>('TEAMS_CLIENT_SECRET'), 'TEAMS_CLIENT_SECRET'],
  ]
    .filter(([value]) => !hasConfiguredValue(value))
    .map(([, key]) => key as string);
}

function integrationLabel(provider: IntegrationProvider) {
  if (provider === IntegrationProvider.BLIP) {
    return 'BLiP';
  }

  if (provider === IntegrationProvider.GLPI) {
    return 'GLPI';
  }

  return 'Teams Phone / PABX';
}

function integrationCategory(provider: IntegrationProvider) {
  if (provider === IntegrationProvider.BLIP) {
    return 'Atendimento conversacional';
  }

  if (provider === IntegrationProvider.GLPI) {
    return 'ITSM / chamados';
  }

  return 'Telefonia corporativa';
}

function integrationDescription(provider: IntegrationProvider) {
  if (provider === IntegrationProvider.BLIP) {
    return 'Coleta conversas, tickets, bot e mensagens via webhook.';
  }

  if (provider === IntegrationProvider.GLPI) {
    return 'Coleta chamados, SLAs, categorias, tecnicos e backlog do suporte.';
  }

  return 'Coleta ligacoes, filas, duracao, abandono e relatorios via Microsoft Graph.';
}

function integrationRequiredSettings(provider: IntegrationProvider) {
  if (provider === IntegrationProvider.BLIP) {
    return ['WEBHOOK_PUBLIC_BASE_URL', 'BLIP_WEBHOOK_SECRET quando obrigatorio'];
  }

  if (provider === IntegrationProvider.GLPI) {
    return ['GLPI_BASE_URL', 'GLPI_APP_TOKEN', 'GLPI_USER_TOKEN'];
  }

  return ['TEAMS_TENANT_ID', 'TEAMS_CLIENT_ID', 'TEAMS_CLIENT_SECRET', 'Admin consent no Graph'];
}

function integrationCapabilities(provider: IntegrationProvider) {
  if (provider === IntegrationProvider.BLIP) {
    return ['Conversas', 'Mensagens', 'Filas', 'Atendentes', 'Bot', 'Qualidade'];
  }

  if (provider === IntegrationProvider.GLPI) {
    return ['Chamados', 'SLA', 'Tecnicos', 'Categorias', 'Tempo de resolucao', 'Backlog'];
  }

  return ['Ligacoes', 'Filas', 'Atendentes', 'Duracao', 'Abandono', 'Call Records'];
}

function integrationSettingsPreview(provider: IntegrationProvider, settings: Record<string, unknown>, configService: ConfigService) {
  if (provider === IntegrationProvider.BLIP) {
    return {
      mode: readString(settings, 'mode', 'webhook'),
      sourceRetentionDays: readNumber(settings, 'sourceRetentionDays') ?? 90,
      atendebiRetentionDays: readNumber(settings, 'atendebiRetentionDays') ?? Number(configService.get<string>('ATENDEBI_RETENTION_DAYS', '730')),
    };
  }

  if (provider === IntegrationProvider.GLPI) {
    return {
      baseUrl: maskUrl(readString(settings, 'baseUrl', '') || configService.get<string>('GLPI_BASE_URL') || ''),
      apiPath: readString(settings, 'apiPath', '/apirest.php'),
      authMethod: 'App Token + User Token',
      syncStrategy: 'Polling incremental',
      syncEnabled: configService.get<string>('GLPI_SYNC_ENABLED', 'false') === 'true',
      syncLimit: configService.get<string>('GLPI_SYNC_LIMIT', '0') === '0' ? 'Todo historico' : configService.get<string>('GLPI_SYNC_LIMIT'),
      syncPageSize: configService.get<string>('GLPI_SYNC_PAGE_SIZE', '100'),
      syncActiveOnly: configService.get<string>('GLPI_SYNC_ACTIVE_ONLY', 'false') === 'true',
    };
  }

  return {
    tenantId: maskId(readString(settings, 'tenantId', '') || configService.get<string>('TEAMS_TENANT_ID') || ''),
    clientId: maskId(readString(settings, 'clientId', '') || configService.get<string>('TEAMS_CLIENT_ID') || ''),
    authMethod: 'Microsoft Graph application permissions',
    permissions: ['CallRecords.Read.All'],
    syncEnabled: configService.get<string>('TEAMS_SYNC_ENABLED', 'false') === 'true',
    syncDays: configService.get<string>('TEAMS_SYNC_DAYS', '7'),
    syncMaxPages: configService.get<string>('TEAMS_SYNC_MAX_PAGES', '20'),
    pstnCalls: configService.get<string>('TEAMS_SYNC_INCLUDE_PSTN', 'true') !== 'false',
    directRoutingCalls: configService.get<string>('TEAMS_SYNC_INCLUDE_DIRECT_ROUTING', 'true') !== 'false',
  };
}

function buildWebhookUrl(configService: ConfigService, tenantKey: string) {
  const baseUrl =
    configService.get<string>('WEBHOOK_PUBLIC_BASE_URL') ??
    `http://localhost:${configService.get<string>('PORT') ?? configService.get<string>('API_PORT') ?? '3333'}`;

  return `${baseUrl.replace(/\/$/, '')}/webhooks/blip/${tenantKey}`;
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === 'number' ? value : null;
}

function hasConfiguredValue(value?: string) {
  if (!value?.trim()) {
    return false;
  }

  return !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value.trim());
}

function maskUrl(value: string) {
  if (!value) {
    return 'Nao configurado';
  }

  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
  } catch {
    return value;
  }
}

function maskId(value: string) {
  if (!value) {
    return 'Nao configurado';
  }

  return value.length <= 8 ? '***' : `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(record: Record<string, unknown>, key: string, fallback: string) {
  const value = record[key];

  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
