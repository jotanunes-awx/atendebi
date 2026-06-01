import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationProvider, MessageDirection, Prisma, RawEventStatus, TicketStatus } from '@prisma/client';
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

    if (provider === IntegrationProvider.GLPI && ok) {
      return this.testGlpiConnection(provider);
    }

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

    if (provider === IntegrationProvider.GLPI) {
      return this.syncGlpiTickets(tenantId);
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

      return checks.filter(([value]) => !hasConfiguredValue(value)).map(([, key]) => key);
    }

    const checks: Array<[string | undefined, string]> = [
      [readString(settings, 'tenantId') || this.configService.get<string>('TEAMS_TENANT_ID'), 'TEAMS_TENANT_ID'],
      [readString(settings, 'clientId') || this.configService.get<string>('TEAMS_CLIENT_ID'), 'TEAMS_CLIENT_ID'],
      [this.configService.get<string>('TEAMS_CLIENT_SECRET'), 'TEAMS_CLIENT_SECRET'],
    ];

    return checks.filter(([value]) => !hasConfiguredValue(value)).map(([, key]) => key);
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

  private async testGlpiConnection(provider: SupportedProvider) {
    try {
      const session = await this.openGlpiSession();
      await this.closeGlpiSession(session.sessionToken).catch(() => undefined);

      return {
        provider,
        checkedAt: new Date().toISOString(),
        ok: true,
        status: 'ready',
        message: 'Conexao com GLPI validada via initSession. O proximo passo e executar o sincronismo.',
        details: [
          { item: 'GLPI_BASE_URL configurado', status: 'ok' },
          { item: 'GLPI_APP_TOKEN configurado', status: 'ok' },
          { item: 'GLPI_USER_TOKEN configurado', status: 'ok' },
          { item: 'initSession respondeu com session_token', status: 'ok' },
        ],
      };
    } catch (error) {
      return {
        provider,
        checkedAt: new Date().toISOString(),
        ok: false,
        status: 'connection_failed',
        message: error instanceof Error ? error.message : 'Nao foi possivel validar a conexao com o GLPI.',
        details: [
          { item: 'Verificar URL do GLPI e acesso de rede do servidor', status: 'failed' },
          { item: 'Verificar App Token e User Token', status: 'failed' },
        ],
      };
    }
  }

  private async syncGlpiTickets(tenantId: string) {
    const startedAt = new Date();
    const session = await this.openGlpiSession();
    const limit = Number(this.configService.get<string>('GLPI_SYNC_LIMIT', '50'));

    try {
      const tickets = await this.fetchGlpiTickets(session.sessionToken, limit);
      let imported = 0;

      for (const ticket of tickets) {
        await this.upsertGlpiTicket(tenantId, ticket);
        imported += 1;
      }

      await this.prisma.integrationConfig.updateMany({
        where: { tenantId, provider: IntegrationProvider.GLPI },
        data: {
          isActive: true,
          settings: {
            mode: 'configured',
            baseUrl: this.configService.get<string>('GLPI_BASE_URL') ?? '',
            apiPath: '/apirest.php',
            authMethod: 'app-token + user-token',
            syncStrategy: 'polling',
            syncEnabled: this.configService.get<string>('GLPI_SYNC_ENABLED', 'false') === 'true',
            lastSyncAt: new Date().toISOString(),
            lastSyncCount: imported,
          },
        },
      });

      await this.prisma.auditLog.create({
        data: {
          tenantId,
          action: 'integration.glpi.sync.completed',
          entityType: 'integration',
          entityId: IntegrationProvider.GLPI,
          metadata: {
            imported,
            startedAt: startedAt.toISOString(),
            finishedAt: new Date().toISOString(),
          },
        },
      });

      return {
        provider: IntegrationProvider.GLPI,
        accepted: true,
        status: 'synced',
        message: `Sincronismo GLPI concluido: ${imported} chamados importados/atualizados.`,
        imported,
      };
    } finally {
      await this.closeGlpiSession(session.sessionToken).catch(() => undefined);
    }
  }

  private async openGlpiSession() {
    const { apiBaseUrl, appToken, userToken } = this.getGlpiConfig();
    const response = await fetch(`${apiBaseUrl}/initSession`, {
      method: 'GET',
      headers: {
        'App-Token': appToken,
        Authorization: `user_token ${userToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`GLPI initSession falhou com status ${response.status}. Verifique URL, App Token e User Token.`);
    }

    const body = (await response.json()) as { session_token?: string };

    if (!body.session_token) {
      throw new Error('GLPI initSession nao retornou session_token.');
    }

    return {
      apiBaseUrl,
      appToken,
      sessionToken: body.session_token,
    };
  }

  private async closeGlpiSession(sessionToken: string) {
    const { apiBaseUrl, appToken } = this.getGlpiConfig();

    await fetch(`${apiBaseUrl}/killSession`, {
      method: 'GET',
      headers: {
        'App-Token': appToken,
        'Session-Token': sessionToken,
      },
    });
  }

  private async fetchGlpiTickets(sessionToken: string, limit: number): Promise<GlpiTicketPayload[]> {
    const { apiBaseUrl, appToken } = this.getGlpiConfig();
    const response = await fetch(`${apiBaseUrl}/Ticket?range=0-${Math.max(limit - 1, 0)}`, {
      method: 'GET',
      headers: {
        'App-Token': appToken,
        'Session-Token': sessionToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Nao foi possivel buscar chamados GLPI. Status ${response.status}.`);
    }

    const body = (await response.json()) as unknown;

    return Array.isArray(body) ? body.map((ticket) => asRecord(ticket) as GlpiTicketPayload) : [];
  }

  private async upsertGlpiTicket(tenantId: string, ticket: GlpiTicketPayload) {
    const glpiId = readUnknownString(ticket.id) ?? readUnknownString(ticket['2']);

    if (!glpiId) {
      return;
    }

    const externalTicketId = `glpi-ticket-${glpiId}`;
    const subject = truncate(readUnknownString(ticket.name) ?? readUnknownString(ticket['1']) ?? `Chamado GLPI ${glpiId}`, 240);
    const content = stripHtml(readUnknownString(ticket.content) ?? readUnknownString(ticket['21']) ?? '');
    const openedAt = parseDate(readUnknownString(ticket.date_creation) ?? readUnknownString(ticket.date) ?? readUnknownString(ticket['15'])) ?? new Date();
    const closedAt = parseDate(readUnknownString(ticket.closedate) ?? readUnknownString(ticket.solvedate));
    const status = mapGlpiStatus(readUnknownString(ticket.status) ?? readUnknownString(ticket['12']));
    const priority = Number(readUnknownString(ticket.priority) ?? readUnknownString(ticket.urgency) ?? 0);
    const categoryId = readUnknownString(ticket.itilcategories_id);
    const requesterId = readUnknownString(ticket.users_id_recipient) ?? `ticket-${glpiId}`;
    const technicianId =
      readUnknownString(ticket.users_id_lastupdater) ??
      readUnknownString(ticket.users_id_assign) ??
      readUnknownString(ticket.users_id_tech);
    const queueName = categoryId && categoryId !== '0' ? `GLPI Categoria ${categoryId}` : 'GLPI';
    const risk = priority >= 4 ? 'alto' : priority >= 3 ? 'medio' : 'baixo';
    const payloadHash = createHash('sha256').update(JSON.stringify(ticket)).digest('hex');
    const rawPayload = toInputJson(ticket);
    const isClosed = status === TicketStatus.CLOSED;

    const rawEvent = await this.prisma.rawEvent.upsert({
      where: {
        tenantId_provider_providerEventId: {
          tenantId,
          provider: IntegrationProvider.GLPI,
          providerEventId: externalTicketId,
        },
      },
      update: {
        payloadHash,
        payload: rawPayload,
        eventType: 'glpi.ticket',
        processingStatus: RawEventStatus.PROCESSED,
        processedAt: new Date(),
        errorMessage: null,
      },
      create: {
        tenantId,
        provider: IntegrationProvider.GLPI,
        providerEventId: externalTicketId,
        eventType: 'glpi.ticket',
        payloadHash,
        payload: rawPayload,
        processingStatus: RawEventStatus.PROCESSED,
        processedAt: new Date(),
      },
    });

    const contact = await this.prisma.contact.upsert({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId: `glpi-requester-${requesterId}`,
        },
      },
      update: {
        name: `Requerente GLPI ${requesterId}`,
        metadata: {
          source: 'GLPI',
          requesterId,
        },
      },
      create: {
        tenantId,
        externalId: `glpi-requester-${requesterId}`,
        name: `Requerente GLPI ${requesterId}`,
        metadata: {
          source: 'GLPI',
          requesterId,
        },
      },
    });

    const queue = await this.prisma.supportQueue.upsert({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId: categoryId ? `glpi-category-${categoryId}` : 'glpi-default',
        },
      },
      update: {
        name: queueName,
        isActive: true,
      },
      create: {
        tenantId,
        externalId: categoryId ? `glpi-category-${categoryId}` : 'glpi-default',
        name: queueName,
        isActive: true,
      },
    });
    const agent =
      technicianId && technicianId !== '0'
        ? await this.prisma.agent.upsert({
            where: {
              tenantId_externalId: {
                tenantId,
                externalId: `glpi-technician-${technicianId}`,
              },
            },
            update: {
              name: `Tecnico GLPI ${technicianId}`,
              isActive: true,
            },
            create: {
              tenantId,
              externalId: `glpi-technician-${technicianId}`,
              name: `Tecnico GLPI ${technicianId}`,
              isActive: true,
            },
          })
        : null;

    const normalizedTicket = await this.prisma.ticket.upsert({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId: externalTicketId,
        },
      },
      update: {
        contactId: contact.id,
        queueId: queue.id,
        agentId: agent?.id,
        status,
        channel: 'GLPI',
        subject,
        openedAt,
        closedAt: isClosed ? closedAt ?? new Date() : null,
        firstResponseAt: openedAt,
        metadata: buildGlpiTicketMetadata({
          glpiId,
          status,
          priority,
          categoryId,
          risk,
          content,
          subject,
        }),
      },
      create: {
        tenantId,
        externalId: externalTicketId,
        contactId: contact.id,
        queueId: queue.id,
        agentId: agent?.id,
        status,
        channel: 'GLPI',
        subject,
        openedAt,
        closedAt: isClosed ? closedAt : null,
        firstResponseAt: openedAt,
        metadata: buildGlpiTicketMetadata({
          glpiId,
          status,
          priority,
          categoryId,
          risk,
          content,
          subject,
        }),
      },
    });

    const tag = await this.prisma.tag.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: 'GLPI',
        },
      },
      update: {},
      create: {
        tenantId,
        name: 'GLPI',
        color: '#0ea5e9',
      },
    });

    await this.prisma.ticketTag.upsert({
      where: {
        tenantId_ticketId_tagId: {
          tenantId,
          ticketId: normalizedTicket.id,
          tagId: tag.id,
        },
      },
      update: {},
      create: {
        tenantId,
        ticketId: normalizedTicket.id,
        tagId: tag.id,
      },
    });

    await this.prisma.message.upsert({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId: `${externalTicketId}-description`,
        },
      },
      update: {
        ticketId: normalizedTicket.id,
        contactId: contact.id,
        agentId: agent?.id,
        rawEventId: rawEvent.id,
        content,
        sentAt: openedAt,
      },
      create: {
        tenantId,
        ticketId: normalizedTicket.id,
        contactId: contact.id,
        agentId: agent?.id,
        rawEventId: rawEvent.id,
        externalId: `${externalTicketId}-description`,
        direction: MessageDirection.INBOUND,
        senderName: contact.name,
        content,
        contentType: 'text/plain',
        sentAt: openedAt,
        metadata: {
          source: 'GLPI',
          senderRole: 'Solicitante',
        },
      },
    });
  }

  private getGlpiConfig() {
    const baseUrl = normalizeGlpiBaseUrl(this.configService.get<string>('GLPI_BASE_URL') ?? '');
    const appToken = this.configService.get<string>('GLPI_APP_TOKEN') ?? '';
    const userToken = this.configService.get<string>('GLPI_USER_TOKEN') ?? '';

    if (!baseUrl || !appToken || !userToken) {
      throw new Error('GLPI_BASE_URL, GLPI_APP_TOKEN e GLPI_USER_TOKEN precisam estar configurados no .env da API.');
    }

    return {
      apiBaseUrl: `${baseUrl}/apirest.php`,
      appToken,
      userToken,
    };
  }
}

type GlpiTicketPayload = Record<string, unknown>;

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

function hasConfiguredValue(value?: string) {
  if (!value?.trim()) {
    return false;
  }

  return !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value.trim());
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === 'number' ? value : null;
}

function readUnknownString(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeGlpiBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/$/, '');

  if (!trimmed) {
    return '';
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function parseDate(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapGlpiStatus(value?: string) {
  const status = Number(value);

  if (status === 5 || status === 6) {
    return TicketStatus.CLOSED;
  }

  if (status === 4) {
    return TicketStatus.PENDING;
  }

  return TicketStatus.OPEN;
}

function buildGlpiTicketMetadata({
  glpiId,
  status,
  priority,
  categoryId,
  risk,
  content,
  subject,
}: {
  glpiId: string;
  status: TicketStatus;
  priority: number;
  categoryId?: string;
  risk: string;
  content: string;
  subject: string;
}) {
  return {
    source: 'GLPI',
    provider: 'GLPI',
    glpiId,
    glpiStatus: status,
    priority,
    categoryId,
    group: 'GLPI',
    signal: 'ITSM',
    sentiment: risk === 'alto' ? 'negativo' : 'neutro',
    risk,
    resolutionStatus: status === TicketStatus.CLOSED ? 'Resolvido' : 'Em andamento',
    waitMinutes: 0,
    summary: content ? truncate(content, 280) : `Chamado GLPI sincronizado: ${subject}`,
    isComplaint: false,
    isOpportunity: false,
    botFallback: false,
    unresolved: status !== TicketStatus.CLOSED,
  };
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trim()}...` : value;
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
