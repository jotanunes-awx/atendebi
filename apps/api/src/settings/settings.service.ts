import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
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

    const [rawEventCount, latestRawEvent, ticketGroups] = await Promise.all([
      this.prisma.rawEvent.count({ where: { tenantId } }),
      this.prisma.rawEvent.findFirst({
        where: { tenantId },
        orderBy: { receivedAt: 'desc' },
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
    const retentionDays = Number(this.configService.get<string>('ATENDEBI_RETENTION_DAYS', '730'));
    const sourceRetentionDays = Number(this.configService.get<string>('BLIP_SOURCE_RETENTION_DAYS', '90'));
    const webhookSecretRequired = this.configService.get<string>('WEBHOOK_SECRET_REQUIRED', 'false').toLowerCase() === 'true';

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
        lastEventAt: latestRawEvent?.receivedAt.toISOString() ?? integration?.updatedAt.toISOString() ?? tenant.updatedAt.toISOString(),
        rawEvents: rawEventCount,
        webhookSecretRequired,
      },
      security: {
        authMode: 'Mock local preparado para Microsoft Entra ID',
        tokenValidation: 'Mock headers no MVP; JWT/OIDC no piloto',
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
    security: null,
    retention: null,
    users: [],
    roles: [],
    groups: [],
    lgpd: null,
  };
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
