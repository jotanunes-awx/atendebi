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

type GlpiLookupContext = {
  sessionToken: string;
  users: Map<string, Promise<Record<string, unknown> | null>>;
  categories: Map<string, Promise<Record<string, unknown> | null>>;
  entities: Map<string, Promise<Record<string, unknown> | null>>;
  groups: Map<string, Promise<Record<string, unknown> | null>>;
};

type GlpiSyncOptions = {
  limit: number;
  overfetchLimit: number;
  syncDays: number;
  activeOnly: boolean;
  statuses: Set<number>;
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
      const syncOptions = this.getGlpiSyncOptions();

      return {
        baseUrl: maskUrl(baseUrl),
        apiPath: readString(settings, 'apiPath') || '/apirest.php',
        authMethod: 'App Token + User Token',
        syncStrategy: 'Polling incremental',
        syncEnabled: this.configService.get<string>('GLPI_SYNC_ENABLED', 'false') === 'true',
        syncLimit: syncOptions.limit,
        activeOnly: syncOptions.activeOnly,
        syncDays: syncOptions.syncDays,
        activeStatuses: Array.from(syncOptions.statuses).join(', '),
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
    const syncOptions = this.getGlpiSyncOptions();

    try {
      const tickets = await this.fetchGlpiTickets(session.sessionToken, syncOptions);
      const lookupContext = this.createGlpiLookupContext(session.sessionToken);
      let imported = 0;
      let skipped = 0;

      for (const ticket of tickets) {
        const normalized = await this.upsertGlpiTicket(tenantId, ticket, lookupContext);

        if (normalized) {
          imported += 1;
        } else {
          skipped += 1;
        }
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
            lastSyncSkipped: skipped,
            syncDays: syncOptions.syncDays,
            activeOnly: syncOptions.activeOnly,
            activeStatuses: Array.from(syncOptions.statuses),
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
            skipped,
            startedAt: startedAt.toISOString(),
            finishedAt: new Date().toISOString(),
            syncDays: syncOptions.syncDays,
            activeOnly: syncOptions.activeOnly,
            activeStatuses: Array.from(syncOptions.statuses),
          },
        },
      });

      return {
        provider: IntegrationProvider.GLPI,
        accepted: true,
        status: 'synced',
        message: `Sincronismo GLPI concluido: ${imported} chamados ativos/recentes importados ou atualizados.`,
        imported,
        skipped,
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

  private async fetchGlpiTickets(sessionToken: string, syncOptions: GlpiSyncOptions): Promise<GlpiTicketPayload[]> {
    const { apiBaseUrl, appToken } = this.getGlpiConfig();
    const params = new URLSearchParams({
      range: `0-${Math.max(syncOptions.overfetchLimit - 1, 0)}`,
      sort: 'date_mod',
      order: 'DESC',
      expand_dropdowns: 'true',
    });
    const response = await fetch(`${apiBaseUrl}/Ticket?${params.toString()}`, {
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
    const tickets = Array.isArray(body) ? body.map((ticket) => asRecord(ticket) as GlpiTicketPayload) : [];

    return filterGlpiTicketsForSync(tickets, syncOptions).slice(0, syncOptions.limit);
  }

  private createGlpiLookupContext(sessionToken: string): GlpiLookupContext {
    return {
      sessionToken,
      users: new Map(),
      categories: new Map(),
      entities: new Map(),
      groups: new Map(),
    };
  }

  private async fetchGlpiItem(
    context: GlpiLookupContext,
    itemType: 'User' | 'ITILCategory' | 'Entity' | 'Group',
    id?: string,
  ) {
    const normalizedId = normalizeExternalId(id);

    if (!normalizedId) {
      return null;
    }

    const cache =
      itemType === 'User'
        ? context.users
        : itemType === 'ITILCategory'
          ? context.categories
          : itemType === 'Entity'
            ? context.entities
            : context.groups;

    if (!cache.has(normalizedId)) {
      cache.set(
        normalizedId,
        this.fetchGlpiRecord(context.sessionToken, `${itemType}/${normalizedId}`).then((record) =>
          Array.isArray(record) ? null : record,
        ),
      );
    }

    return cache.get(normalizedId);
  }

  private async fetchGlpiCollection(context: GlpiLookupContext, path: string) {
    const response = await this.fetchGlpiRecord(context.sessionToken, path);

    return Array.isArray(response) ? response.map(asRecord) : [];
  }

  private async fetchGlpiRecord(sessionToken: string, path: string): Promise<Record<string, unknown> | Record<string, unknown>[] | null> {
    const { apiBaseUrl, appToken } = this.getGlpiConfig();

    try {
      const response = await fetch(`${apiBaseUrl}/${path}`, {
        method: 'GET',
        headers: {
          'App-Token': appToken,
          'Session-Token': sessionToken,
        },
      });

      if (!response.ok) {
        return null;
      }

      const body = (await response.json()) as unknown;

      return Array.isArray(body) ? body.map(asRecord) : asRecord(body);
    } catch {
      return null;
    }
  }

  private getGlpiSyncOptions(): GlpiSyncOptions {
    const limit = clamp(Number(this.configService.get<string>('GLPI_SYNC_LIMIT', '50')), 1, 200);
    const syncDays = clamp(Number(this.configService.get<string>('GLPI_SYNC_DAYS', '90')), 0, 3650);
    const activeOnly = this.configService.get<string>('GLPI_SYNC_ACTIVE_ONLY', 'true') !== 'false';
    const statuses = parseNumberSet(this.configService.get<string>('GLPI_SYNC_STATUSES', '1,2,3,4'));

    return {
      limit,
      overfetchLimit: Math.min(limit * 4, 500),
      syncDays,
      activeOnly,
      statuses: statuses.size > 0 ? statuses : new Set([1, 2, 3, 4]),
    };
  }

  private async upsertGlpiTicket(tenantId: string, ticket: GlpiTicketPayload, context: GlpiLookupContext) {
    const glpiId = readUnknownString(ticket.id) ?? readUnknownString(ticket['2']);

    if (!glpiId) {
      return false;
    }

    const externalTicketId = `glpi-ticket-${glpiId}`;
    const subject = truncate(readUnknownString(ticket.name) ?? readUnknownString(ticket['1']) ?? `Chamado GLPI ${glpiId}`, 240);
    const content = stripHtml(readUnknownString(ticket.content) ?? readUnknownString(ticket['21']) ?? '');
    const openedAt = parseDate(readUnknownString(ticket.date_creation) ?? readUnknownString(ticket.date) ?? readUnknownString(ticket['15'])) ?? new Date();
    const closedAt = parseDate(readUnknownString(ticket.closedate) ?? readUnknownString(ticket.solvedate));
    const glpiStatus = readGlpiStatus(ticket);
    const status = mapGlpiStatus(glpiStatus);
    const statusText = glpiStatusLabel(glpiStatus);
    const priority = Number(readUnknownString(ticket.priority) ?? readUnknownString(ticket.urgency) ?? 0);
    const rawCategory = readUnknownString(ticket.itilcategories_id);
    const rawEntity = readUnknownString(ticket.entities_id);
    const rawRequester = readUnknownString(ticket.users_id_recipient);
    const rawTechnician =
      readUnknownString(ticket.users_id_assign) ??
      readUnknownString(ticket.users_id_tech) ??
      readUnknownString(ticket.users_id_lastupdater);
    const ticketUsers = await this.fetchGlpiCollection(context, `Ticket/${glpiId}/Ticket_User`);
    const ticketGroups = await this.fetchGlpiCollection(context, `Ticket/${glpiId}/Group_Ticket`);
    const requesterId =
      findGlpiRelationId(ticketUsers, 1, 'users_id') ?? normalizeExternalId(rawRequester) ?? `ticket-${glpiId}`;
    const technicianId = findGlpiRelationId(ticketUsers, 2, 'users_id') ?? normalizeExternalId(rawTechnician);
    const groupId = findGlpiRelationId(ticketGroups, 2, 'groups_id') ?? findGlpiRelationId(ticketGroups, undefined, 'groups_id');
    const categoryId = normalizeExternalId(rawCategory);
    const entityId = normalizeExternalId(rawEntity);
    const requesterRecord = await this.fetchGlpiItem(context, 'User', requesterId);
    const technicianRecord = await this.fetchGlpiItem(context, 'User', technicianId);
    const categoryRecord = await this.fetchGlpiItem(context, 'ITILCategory', categoryId);
    const entityRecord = await this.fetchGlpiItem(context, 'Entity', entityId);
    const groupRecord = await this.fetchGlpiItem(context, 'Group', groupId);
    const requesterName = buildGlpiUserName(requesterRecord, rawRequester, requesterId, 'Solicitante');
    const technicianName = technicianId ? buildGlpiUserName(technicianRecord, rawTechnician, technicianId, 'Tecnico') : null;
    const categoryName = buildGlpiItemName(categoryRecord, rawCategory, categoryId, 'Categoria');
    const entityName = buildGlpiItemName(entityRecord, rawEntity, entityId, 'Entidade');
    const groupName = buildGlpiItemName(groupRecord, readRelationDisplayName(ticketGroups, groupId), groupId, 'Grupo');
    const queueName = groupName ?? categoryName ?? entityName ?? 'GLPI';
    const groupLabel = entityName ?? groupName ?? categoryName ?? 'GLPI';
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
        name: requesterName,
        metadata: {
          source: 'GLPI',
          requesterId,
          requesterName,
          entityName,
          groupName,
          categoryName,
        },
      },
      create: {
        tenantId,
        externalId: `glpi-requester-${requesterId}`,
        name: requesterName,
        metadata: {
          source: 'GLPI',
          requesterId,
          requesterName,
          entityName,
          groupName,
          categoryName,
        },
      },
    });

    const queue = await this.prisma.supportQueue.upsert({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId: groupId ? `glpi-group-${groupId}` : categoryId ? `glpi-category-${categoryId}` : entityId ? `glpi-entity-${entityId}` : 'glpi-default',
        },
      },
      update: {
        name: queueName,
        isActive: true,
      },
      create: {
        tenantId,
        externalId: groupId ? `glpi-group-${groupId}` : categoryId ? `glpi-category-${categoryId}` : entityId ? `glpi-entity-${entityId}` : 'glpi-default',
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
              name: technicianName ?? `Tecnico #${technicianId}`,
              isActive: true,
            },
            create: {
              tenantId,
              externalId: `glpi-technician-${technicianId}`,
              name: technicianName ?? `Tecnico #${technicianId}`,
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
        agentId: agent?.id ?? null,
        status,
        channel: 'GLPI',
        subject,
        openedAt,
        closedAt: isClosed ? closedAt ?? new Date() : null,
        firstResponseAt: openedAt,
        metadata: buildGlpiTicketMetadata({
          glpiId,
          status,
          statusText,
          priority,
          categoryId,
          categoryName,
          entityName,
          groupName,
          groupLabel,
          queueName,
          requesterName,
          technicianName,
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
        agentId: agent?.id ?? null,
        status,
        channel: 'GLPI',
        subject,
        openedAt,
        closedAt: isClosed ? closedAt : null,
        firstResponseAt: openedAt,
        metadata: buildGlpiTicketMetadata({
          glpiId,
          status,
          statusText,
          priority,
          categoryId,
          categoryName,
          entityName,
          groupName,
          groupLabel,
          queueName,
          requesterName,
          technicianName,
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
        agentId: agent?.id ?? null,
        rawEventId: rawEvent.id,
        senderName: contact.name,
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
          requesterName,
          technicianName,
          groupName,
          categoryName,
          entityName,
        },
      },
    });

    return true;
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

function mapGlpiStatus(status?: number) {
  if (status === 5 || status === 6) {
    return TicketStatus.CLOSED;
  }

  if (status === 4) {
    return TicketStatus.PENDING;
  }

  return TicketStatus.OPEN;
}

function readGlpiStatus(ticket: GlpiTicketPayload) {
  const rawStatus = readUnknownString(ticket.status) ?? readUnknownString(ticket['12']) ?? '';
  const numericStatus = Number(rawStatus);

  if (Number.isFinite(numericStatus) && numericStatus > 0) {
    return numericStatus;
  }

  const normalizedStatus = rawStatus
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalizedStatus.includes('novo')) {
    return 1;
  }

  if (normalizedStatus.includes('atribu')) {
    return 2;
  }

  if (normalizedStatus.includes('planej')) {
    return 3;
  }

  if (normalizedStatus.includes('pend')) {
    return 4;
  }

  if (normalizedStatus.includes('solucion')) {
    return 5;
  }

  if (normalizedStatus.includes('fech')) {
    return 6;
  }

  return 0;
}

function glpiStatusLabel(status?: number) {
  const labels: Record<number, string> = {
    1: 'Novo',
    2: 'Atribuido',
    3: 'Planejado',
    4: 'Pendente',
    5: 'Solucionado',
    6: 'Fechado',
  };

  return status ? labels[status] ?? `Status ${status}` : 'Sem status';
}

function filterGlpiTicketsForSync(tickets: GlpiTicketPayload[], options: GlpiSyncOptions) {
  const since = options.syncDays > 0 ? Date.now() - options.syncDays * 24 * 60 * 60 * 1000 : 0;

  return tickets.filter((ticket) => {
    const status = readGlpiStatus(ticket);
    const active = status > 0 && options.statuses.has(status);

    if (options.activeOnly && status > 0) {
      return active;
    }

    if (since === 0) {
      return true;
    }

    const referenceDate =
      parseDate(readUnknownString(ticket.date_mod) ?? readUnknownString(ticket['19'])) ??
      parseDate(readUnknownString(ticket.date_creation) ?? readUnknownString(ticket.date) ?? readUnknownString(ticket['15']));

    return active || Boolean(referenceDate && referenceDate.getTime() >= since);
  });
}

function parseNumberSet(value?: string) {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item) && item > 0),
  );
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function normalizeExternalId(value?: string) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed === '0') {
    return undefined;
  }

  return /^\d+$/.test(trimmed) ? trimmed : undefined;
}

function findGlpiRelationId(rows: Record<string, unknown>[], type: number | undefined, key: string) {
  const match = rows.find((row) => {
    if (type === undefined) {
      return Boolean(normalizeExternalId(readUnknownString(row[key])));
    }

    return Number(readUnknownString(row.type)) === type && Boolean(normalizeExternalId(readUnknownString(row[key])));
  });

  return normalizeExternalId(readUnknownString(match?.[key]));
}

function readRelationDisplayName(rows: Record<string, unknown>[], id?: string) {
  const row = rows.find((item) => normalizeExternalId(readUnknownString(item.groups_id)) === id);

  return readUnknownString(row?.groups_id);
}

function buildGlpiUserName(record: Record<string, unknown> | null | undefined, rawValue: string | undefined, id: string, prefix: string) {
  const firstName = readUnknownString(record?.firstname);
  const realName = readUnknownString(record?.realname);
  const fullName = [firstName, realName].filter(Boolean).join(' ').trim();
  const name = fullName || readUnknownString(record?.name) || readUnknownString(record?.completename);

  if (name) {
    return name;
  }

  if (rawValue && !normalizeExternalId(rawValue)) {
    return rawValue;
  }

  return `${prefix} #${id}`;
}

function buildGlpiItemName(
  record: Record<string, unknown> | null | undefined,
  rawValue: string | undefined,
  id: string | undefined,
  prefix: string,
) {
  const name = readUnknownString(record?.completename) || readUnknownString(record?.name);

  if (name) {
    return name;
  }

  if (rawValue && !normalizeExternalId(rawValue)) {
    return rawValue;
  }

  return id ? `${prefix} #${id}` : null;
}

function buildGlpiTicketMetadata({
  glpiId,
  status,
  statusText,
  priority,
  categoryId,
  categoryName,
  entityName,
  groupName,
  groupLabel,
  queueName,
  requesterName,
  technicianName,
  risk,
  content,
  subject,
}: {
  glpiId: string;
  status: TicketStatus;
  statusText: string;
  priority: number;
  categoryId?: string;
  categoryName: string | null;
  entityName: string | null;
  groupName: string | null;
  groupLabel: string;
  queueName: string;
  requesterName: string;
  technicianName: string | null;
  risk: string;
  content: string;
  subject: string;
}) {
  return {
    source: 'GLPI',
    provider: 'GLPI',
    glpiId,
    glpiStatus: status,
    glpiStatusLabel: statusText,
    priority,
    categoryId,
    categoryName,
    entityName,
    teamName: groupName,
    queueDisplayName: queueName,
    agentDisplayName: technicianName ?? 'Sem tecnico atribuido',
    customerDisplayName: requesterName,
    group: groupLabel,
    signal: `ITSM / ${statusText}`,
    sentiment: risk === 'alto' ? 'negativo' : 'neutro',
    risk,
    resolutionStatus: statusText,
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
