import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationProvider, MessageDirection, Prisma, RawEventStatus, TicketStatus } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
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
  limit: number | null;
  pageSize: number;
  maxPages: number;
  syncDays: number;
  activeOnly: boolean;
  statuses: Set<number>;
};

type TeamsSyncOptions = {
  days: number;
  maxPages: number;
  includePstn: boolean;
  includeDirectRouting: boolean;
};

type TeamsCallBatch = {
  source: 'PSTN' | 'DIRECT_ROUTING';
  rows: Record<string, unknown>[];
};

type BlipSyncOptions = {
  contactLimit: number | null;
  contactPageSize: number;
  maxContactPages: number;
  threadMessagesPerContact: number;
  loggedMessagesLimit: number | null;
  loggedMessagesPageSize: number;
  maxLoggedMessagePages: number;
  includeContacts: boolean;
  includeThreads: boolean;
  includeLoggedMessages: boolean;
};

type BlipContactPayload = Record<string, unknown>;

type BlipThreadMessagePayload = Record<string, unknown>;

type BlipThreadIdentityCandidate = {
  identity: string;
  getFromOriginator: boolean;
  source: string;
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

    if (provider === IntegrationProvider.BLIP && ok) {
      return this.testBlipConnection(provider);
    }

    if (provider === IntegrationProvider.TEAMS_PHONE && ok) {
      return this.testTeamsConnection(provider);
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

    if (provider === IntegrationProvider.BLIP) {
      return this.syncBlipHistory(tenantId);
    }

    if (provider === IntegrationProvider.TEAMS_PHONE) {
      return this.syncTeamsPhoneCalls(tenantId);
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
      const missing =
        settings.webhookSecretRequired && !this.configService.get<string>('BLIP_WEBHOOK_SECRET') ? ['BLIP_WEBHOOK_SECRET'] : [];
      const syncEnabled =
        this.configService.get<string>('BLIP_ENABLED', 'false') === 'true' ||
        this.configService.get<string>('BLIP_SYNC_ENABLED', 'false') === 'true';

      if (syncEnabled) {
        const key = firstConfiguredValue(
          this.configService.get<string>('BLIP_BOT_KEY'),
          this.configService.get<string>('BLIP_ACCESS_KEY'),
          this.configService.get<string>('BLIP_AUTH_KEY'),
        );
        const httpBaseUrl = firstConfiguredValue(
          this.configService.get<string>('BLIP_HTTP_BASE_URL'),
          this.configService.get<string>('BLIP_API_BASE_URL'),
        );
        const contractId = firstConfiguredValue(this.configService.get<string>('BLIP_CONTRACT_ID'));

        if (!key) {
          missing.push('BLIP_BOT_KEY');
        }

        if (!httpBaseUrl && !contractId) {
          missing.push('BLIP_HTTP_BASE_URL ou BLIP_CONTRACT_ID');
        }
      }

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
      [
        firstConfiguredValue(readString(settings, 'tenantId'), this.configService.get<string>('TEAMS_TENANT_ID')),
        'TEAMS_TENANT_ID',
      ],
      [
        firstConfiguredValue(readString(settings, 'clientId'), this.configService.get<string>('TEAMS_CLIENT_ID')),
        'TEAMS_CLIENT_ID',
      ],
      [this.configService.get<string>('TEAMS_CLIENT_SECRET'), 'TEAMS_CLIENT_SECRET'],
    ];

    return checks.filter(([value]) => !hasConfiguredValue(value)).map(([, key]) => key);
  }

  private buildSettingsPreview(provider: SupportedProvider, settings: Record<string, unknown>) {
    if (provider === IntegrationProvider.BLIP) {
      const syncOptions = this.getBlipSyncOptions();

      return {
        mode:
          this.configService.get<string>('BLIP_SYNC_ENABLED', 'false') === 'true' ||
          this.configService.get<string>('BLIP_ENABLED', 'false') === 'true'
            ? 'webhook + api backfill'
            : readString(settings, 'mode') || 'webhook',
        apiBaseUrl: maskUrl(this.buildBlipCommandsUrl().replace(/\/commands$/, '')),
        authMethod: firstConfiguredValue(
          this.configService.get<string>('BLIP_BOT_KEY'),
          this.configService.get<string>('BLIP_ACCESS_KEY'),
          this.configService.get<string>('BLIP_AUTH_KEY'),
        )
          ? 'Authorization Key'
          : 'Nao configurado',
        syncEnabled: this.configService.get<string>('BLIP_SYNC_ENABLED', 'false') === 'true',
        contactLimit: syncOptions.contactLimit ?? 'todos',
        threadMessagesPerContact: syncOptions.threadMessagesPerContact,
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
        syncLimit: syncOptions.limit ?? 'todos',
        syncPageSize: syncOptions.pageSize,
        syncMaxPages: syncOptions.maxPages,
        activeOnly: syncOptions.activeOnly,
        syncDays: syncOptions.syncDays,
        activeStatuses: Array.from(syncOptions.statuses).join(', '),
      };
    }

    return {
      tenantId: maskId(
        firstConfiguredValue(readString(settings, 'tenantId'), this.configService.get<string>('TEAMS_TENANT_ID')) || '',
      ),
      clientId: maskId(
        firstConfiguredValue(readString(settings, 'clientId'), this.configService.get<string>('TEAMS_CLIENT_ID')) || '',
      ),
      authMethod: 'Microsoft Graph application permissions',
      permissions: ['CallRecords.Read.All'],
      syncEnabled: this.configService.get<string>('TEAMS_SYNC_ENABLED', 'false') === 'true',
      syncDays: this.getTeamsSyncOptions().days,
      syncMaxPages: this.getTeamsSyncOptions().maxPages,
      pstnCalls: this.getTeamsSyncOptions().includePstn,
      directRoutingCalls: this.getTeamsSyncOptions().includeDirectRouting,
    };
  }

  private buildBlipWebhookUrl(tenantKey: string) {
    const baseUrl =
      this.configService.get<string>('WEBHOOK_PUBLIC_BASE_URL') ??
      `http://localhost:${this.configService.get<string>('PORT') ?? this.configService.get<string>('API_PORT') ?? '3333'}`;

    return `${baseUrl.replace(/\/$/, '')}/webhooks/blip/${tenantKey}`;
  }

  private buildBlipCommandsUrl() {
    const configuredBaseUrl = firstConfiguredValue(
      this.configService.get<string>('BLIP_HTTP_BASE_URL'),
      this.configService.get<string>('BLIP_API_BASE_URL'),
    );
    const contractId = firstConfiguredValue(this.configService.get<string>('BLIP_CONTRACT_ID'));
    const baseUrl = configuredBaseUrl
      ? normalizeBlipBaseUrl(configuredBaseUrl)
      : contractId
        ? `https://${contractId}.http.msging.net`
        : 'https://SEU_CONTRATO.http.msging.net';

    return `${baseUrl.replace(/\/commands$/, '')}/commands`;
  }

  private async testBlipConnection(provider: SupportedProvider) {
    const checkedAt = new Date().toISOString();
    const hasApiKey = firstConfiguredValue(
      this.configService.get<string>('BLIP_BOT_KEY'),
      this.configService.get<string>('BLIP_ACCESS_KEY'),
      this.configService.get<string>('BLIP_AUTH_KEY'),
    );

    if (!hasApiKey) {
      return {
        provider,
        checkedAt,
        ok: true,
        status: 'webhook_ready',
        message: 'Webhook BLiP pronto. Para backfill por API, configure BLIP_BOT_KEY e BLIP_HTTP_BASE_URL ou BLIP_CONTRACT_ID.',
        details: [
          { item: 'Webhook URL gerada para o tenant', status: 'ok' },
          { item: 'Chave BLiP ainda nao configurada no backend', status: 'planned' },
        ],
      };
    }

    try {
      const command = await this.sendBlipCommand('postmaster@crm.msging.net', 'get', '/contacts?$skip=0&$take=1');
      const contacts = extractBlipItems(command);

      return {
        provider,
        checkedAt,
        ok: true,
        status: 'ready',
        message: 'Conexao com BLiP validada. O proximo passo e executar o sincronismo de contatos e conversas recentes.',
        details: [
          { item: 'BLIP_BOT_KEY configurada apenas no backend', status: 'ok' },
          { item: 'Commands API respondeu /contacts', status: 'ok' },
          { item: `${contacts.length} contato(s) retornado(s) no teste`, status: 'ok' },
        ],
      };
    } catch (error) {
      return {
        provider,
        checkedAt,
        ok: false,
        status: 'connection_failed',
        message: error instanceof Error ? error.message : 'Nao foi possivel validar a conexao com o BLiP.',
        details: [
          { item: 'Verificar BLIP_BOT_KEY', status: 'failed' },
          { item: 'Verificar BLIP_HTTP_BASE_URL ou BLIP_CONTRACT_ID', status: 'failed' },
          { item: 'Confirmar se a key pertence ao bot/roteador correto', status: 'failed' },
        ],
      };
    }
  }

  private async syncBlipHistory(tenantId: string) {
    const startedAt = new Date();
    const syncOptions = this.getBlipSyncOptions();
    const warnings: string[] = [];
    let importedContacts = 0;
    let importedMessages = 0;
    let skipped = 0;
    let contacts: BlipContactPayload[] = [];

    try {
      if (syncOptions.includeContacts) {
        contacts = await this.fetchBlipContacts(syncOptions);

        for (const contactPayload of contacts) {
          const imported = await this.upsertBlipContact(tenantId, contactPayload);
          importedContacts += imported ? 1 : 0;
          skipped += imported ? 0 : 1;
        }
      }

      if (syncOptions.includeThreads) {
        for (const contactPayload of contacts) {
          const identityCandidates = extractBlipThreadIdentityCandidates(contactPayload);

          if (identityCandidates.length === 0) {
            skipped += 1;
            continue;
          }

          let importedFromThread = false;

          for (const candidate of identityCandidates) {
            try {
              const messages = await this.fetchBlipThreadMessages(candidate, syncOptions);

              if (messages.length === 0) {
                continue;
              }

              for (const messagePayload of messages) {
                const imported = await this.upsertBlipMessage(tenantId, messagePayload, contactPayload, 'thread');
                importedMessages += imported ? 1 : 0;
                skipped += imported ? 0 : 1;
              }

              importedFromThread = true;
              break;
            } catch (error) {
              warnings.push(
                `Thread ${candidate.identity} (${candidate.source}): ${
                  error instanceof Error ? error.message : 'erro desconhecido'
                }`,
              );
            }
          }

          if (!importedFromThread) {
            skipped += 1;
          }
        }
      }

      if (syncOptions.includeLoggedMessages) {
        try {
          const messages = await this.fetchBlipLoggedMessages(syncOptions);

          for (const messagePayload of messages) {
            const imported = await this.upsertBlipMessage(tenantId, messagePayload, undefined, 'logged-message');
            importedMessages += imported ? 1 : 0;
            skipped += imported ? 0 : 1;
          }
        } catch (error) {
          warnings.push(`Mensagens logadas: ${error instanceof Error ? error.message : 'endpoint nao disponivel'}`);
        }
      }

      await this.prisma.integrationConfig.updateMany({
        where: { tenantId, provider: IntegrationProvider.BLIP },
        data: {
          isActive: true,
          settings: {
            mode: 'webhook + api backfill',
            authMethod: 'authorization-key',
            apiBaseUrl: this.buildBlipCommandsUrl().replace(/\/commands$/, ''),
            syncStrategy: 'commands-api',
            syncEnabled: true,
            lastSyncAt: new Date().toISOString(),
            lastSyncContacts: importedContacts,
            lastSyncMessages: importedMessages,
            lastSyncSkipped: skipped,
            warnings: warnings.slice(0, 10),
            contactLimit: syncOptions.contactLimit ?? 'all',
            contactPageSize: syncOptions.contactPageSize,
            threadMessagesPerContact: syncOptions.threadMessagesPerContact,
            includeLoggedMessages: syncOptions.includeLoggedMessages,
            sourceRetentionDays: Number(this.configService.get<string>('BLIP_SOURCE_RETENTION_DAYS', '90')),
            atendebiRetentionDays: Number(this.configService.get<string>('ATENDEBI_RETENTION_DAYS', '730')),
          },
        },
      });

      await this.prisma.auditLog.create({
        data: {
          tenantId,
          action: 'integration.blip.sync.completed',
          entityType: 'integration',
          entityId: IntegrationProvider.BLIP,
          metadata: {
            importedContacts,
            importedMessages,
            skipped,
            warnings: warnings.slice(0, 20),
            startedAt: startedAt.toISOString(),
            finishedAt: new Date().toISOString(),
            contactLimit: syncOptions.contactLimit ?? 'all',
            threadMessagesPerContact: syncOptions.threadMessagesPerContact,
          },
        },
      });

      return {
        provider: IntegrationProvider.BLIP,
        accepted: true,
        status: warnings.length ? 'synced_with_warnings' : 'synced',
        message: warnings.length
          ? `Sincronismo BLiP concluido com avisos: ${importedContacts} contatos e ${importedMessages} mensagens importados.`
          : `Sincronismo BLiP concluido: ${importedContacts} contatos e ${importedMessages} mensagens importados ou atualizados.`,
        imported: importedContacts + importedMessages,
        skipped,
        contacts: importedContacts,
        messages: importedMessages,
        warnings: warnings.slice(0, 5),
      };
    } catch (error) {
      return {
        provider: IntegrationProvider.BLIP,
        accepted: false,
        status: 'sync_failed',
        message: error instanceof Error ? error.message : 'Nao foi possivel sincronizar dados do BLiP.',
        imported: importedContacts + importedMessages,
        skipped,
        contacts: importedContacts,
        messages: importedMessages,
        warnings: warnings.slice(0, 5),
      };
    }
  }

  private async fetchBlipContacts(syncOptions: BlipSyncOptions): Promise<BlipContactPayload[]> {
    const contacts: BlipContactPayload[] = [];

    for (let page = 0; page < syncOptions.maxContactPages; page += 1) {
      const skip = page * syncOptions.contactPageSize;
      const command = await this.sendBlipCommand(
        'postmaster@crm.msging.net',
        'get',
        `/contacts?$skip=${skip}&$take=${syncOptions.contactPageSize}`,
      );
      const pageRows = extractBlipItems(command) as BlipContactPayload[];

      if (pageRows.length === 0) {
        break;
      }

      contacts.push(...pageRows);

      if (syncOptions.contactLimit && contacts.length >= syncOptions.contactLimit) {
        return contacts.slice(0, syncOptions.contactLimit);
      }

      if (pageRows.length < syncOptions.contactPageSize) {
        break;
      }
    }

    return syncOptions.contactLimit ? contacts.slice(0, syncOptions.contactLimit) : contacts;
  }

  private async fetchBlipThreadMessages(
    candidate: BlipThreadIdentityCandidate,
    syncOptions: BlipSyncOptions,
  ): Promise<BlipThreadMessagePayload[]> {
    const take = syncOptions.threadMessagesPerContact;
    const params = [`$take=${take}`, 'refreshExpiredMedia=true'];

    if (candidate.getFromOriginator) {
      params.push('getFromOriginator=true');
    }

    const command = await this.sendBlipCommand(
      'postmaster@msging.net',
      'get',
      `/threads/${encodeURIComponent(candidate.identity)}?${params.join('&')}`,
    );

    return extractBlipItems(command) as BlipThreadMessagePayload[];
  }

  private async fetchBlipLoggedMessages(syncOptions: BlipSyncOptions): Promise<BlipThreadMessagePayload[]> {
    const messages: BlipThreadMessagePayload[] = [];

    for (let page = 0; page < syncOptions.maxLoggedMessagePages; page += 1) {
      const skip = page * syncOptions.loggedMessagesPageSize;
      const command = await this.sendBlipCommand(
        'postmaster@msging.net',
        'get',
        `/messages?$skip=${skip}&$take=${syncOptions.loggedMessagesPageSize}`,
      );
      const pageRows = extractBlipItems(command) as BlipThreadMessagePayload[];

      if (pageRows.length === 0) {
        break;
      }

      messages.push(...pageRows);

      if (syncOptions.loggedMessagesLimit && messages.length >= syncOptions.loggedMessagesLimit) {
        return messages.slice(0, syncOptions.loggedMessagesLimit);
      }

      if (pageRows.length < syncOptions.loggedMessagesPageSize) {
        break;
      }
    }

    return syncOptions.loggedMessagesLimit ? messages.slice(0, syncOptions.loggedMessagesLimit) : messages;
  }

  private async sendBlipCommand(to: string, method: 'get' | 'set' | 'delete', uri: string, resource?: unknown) {
    const { commandsUrl, key } = this.getBlipConfig();
    const response = await fetch(commandsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: randomUUID(),
        to,
        method,
        uri,
        ...(resource ? { resource } : {}),
      }),
    });

    const bodyText = await response.text();

    if (!response.ok) {
      throw new Error(`BLiP Commands API retornou ${response.status}: ${truncate(bodyText, 240)}`);
    }

    const body = parseJsonRecord(bodyText);
    const status = readUnknownString(body.status)?.toLowerCase();

    if (status && status !== 'success') {
      const reason = asRecord(body.reason);
      const description = readUnknownString(reason.description) ?? readUnknownString(reason.code) ?? bodyText;
      throw new Error(`BLiP Commands API retornou status ${status}: ${truncate(description, 240)}`);
    }

    return body;
  }

  private async upsertBlipContact(tenantId: string, contactPayload: BlipContactPayload) {
    const identity = extractBlipContactIdentity(contactPayload);

    if (!identity) {
      return false;
    }

    const rawEvent = await this.upsertBlipRawEvent(tenantId, `blip-contact-${identity}`, 'blip.contact.backfill', contactPayload);
    const name = truncate(extractBlipContactName(contactPayload, identity), 180);
    const phone = extractBlipPhone(contactPayload, identity);
    const rawEmail = readFirstString(contactPayload, ['email', 'extras.email']);
    const email = rawEmail ? truncate(rawEmail, 180) : undefined;
    const externalId = truncate(identity, 180);

    await this.prisma.contact.upsert({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId,
        },
      },
      update: {
        name,
        phone,
        email,
        metadata: {
          source: 'BLIP',
          provider: 'BLIP',
          channel: inferBlipChannel(contactPayload, identity),
          rawEventId: rawEvent.id,
        },
      },
      create: {
        tenantId,
        externalId,
        name,
        phone,
        email,
        metadata: {
          source: 'BLIP',
          provider: 'BLIP',
          channel: inferBlipChannel(contactPayload, identity),
          rawEventId: rawEvent.id,
        },
      },
    });

    return true;
  }

  private async upsertBlipMessage(
    tenantId: string,
    messagePayload: BlipThreadMessagePayload,
    contactPayload: BlipContactPayload | undefined,
    source: 'thread' | 'logged-message',
  ) {
    const message = unwrapBlipMessage(messagePayload);
    const from = readFirstString(message, ['from', 'message.from', 'resource.from']);
    const to = readFirstString(message, ['to', 'message.to', 'resource.to']);
    const fallbackIdentity = contactPayload
      ? extractBlipTunnelOriginator(contactPayload) ?? extractBlipContactIdentity(contactPayload)
      : undefined;
    const contactIdentity = extractBlipConversationIdentity(message, fallbackIdentity, from, to);

    if (!contactIdentity) {
      return false;
    }

    const content = extractBlipContent(message);

    if (!content) {
      return false;
    }

    const payloadHash = hashJson({ source, contactIdentity, messagePayload });
    const messageId = readFirstString(message, ['id', 'messageId', 'message.id', 'resource.id']) ?? payloadHash.slice(0, 32);
    const messageExternalId = truncate(`blip-message-${contactIdentity}-${messageId}`, 180);
    const rawEvent = await this.upsertBlipRawEvent(
      tenantId,
      messageExternalId,
      source === 'thread' ? 'blip.thread.message' : 'blip.logged.message',
      messagePayload,
    );
    const channel = inferBlipChannel(message, contactIdentity);
    const direction = inferBlipDirection(message, from, to);
    const sentAt = extractBlipDate(message, rawEvent.receivedAt);
    const queueName = truncate(
      readFirstString(message, ['queue.name', 'resource.queue.name', 'metadata.queue', 'extras.queue']) ?? `BLiP - ${channel}`,
      160,
    );
    const agentName =
      truncate(
        readFirstString(message, ['agent.name', 'attendant.name', 'operator.name', 'resource.agent.name', 'metadata.agent']) ??
          (direction === MessageDirection.OUTBOUND ? 'BLiP Bot / Atendente' : ''),
        160,
      ) || undefined;
    const contactName =
      truncate(
        readFirstString(message, ['contact.name', 'customer.name', 'resource.customer.name']) ??
          (contactPayload ? extractBlipContactName(contactPayload, contactIdentity) : 'Cliente BLiP'),
        180,
      ) || undefined;
    const contactExternalId = truncate(contactIdentity, 180);
    const contact = await this.prisma.contact.upsert({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId: contactExternalId,
        },
      },
      update: {
        name: contactName,
        phone: extractBlipPhone(contactPayload ?? message, contactIdentity),
        metadata: {
          source: 'BLIP',
          provider: 'BLIP',
          channel,
        },
      },
      create: {
        tenantId,
        externalId: contactExternalId,
        name: contactName,
        phone: extractBlipPhone(contactPayload ?? message, contactIdentity),
        metadata: {
          source: 'BLIP',
          provider: 'BLIP',
          channel,
        },
      },
    });
    const queue = await this.prisma.supportQueue.upsert({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId: stableExternalId('blip-queue', queueName),
        },
      },
      update: { name: queueName, isActive: true },
      create: {
        tenantId,
        externalId: stableExternalId('blip-queue', queueName),
        name: queueName,
        isActive: true,
      },
    });
    const agent = agentName
      ? await this.prisma.agent.upsert({
          where: {
            tenantId_externalId: {
              tenantId,
              externalId: stableExternalId('blip-agent', agentName),
            },
          },
          update: { name: agentName, isActive: true },
          create: {
            tenantId,
            externalId: stableExternalId('blip-agent', agentName),
            name: agentName,
            isActive: true,
          },
        })
      : null;
    const status = inferBlipTicketStatus(message);
    const ticketExternalId =
      truncate(
        readFirstString(message, ['ticket.id', 'conversation.id', 'thread.id', 'resource.ticketId', 'resource.threadId']) ??
          `ticket-${contactIdentity}`,
        180,
      ) ?? `ticket-${payloadHash.slice(0, 32)}`;
    const subject = truncate(readFirstString(message, ['subject', 'category', 'resource.category']) ?? `Conversa BLiP - ${channel}`, 240);
    const ticket = await this.prisma.ticket.upsert({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId: ticketExternalId,
        },
      },
      update: {
        contactId: contact.id,
        queueId: queue.id,
        agentId: agent?.id ?? undefined,
        status,
        channel,
        subject,
        firstResponseAt: direction === MessageDirection.OUTBOUND ? sentAt : undefined,
        metadata: buildBlipTicketMetadata({
          channel,
          queueName,
          agentName,
          contactName: contact.name ?? 'Cliente BLiP',
          status,
          content,
          source,
        }),
      },
      create: {
        tenantId,
        externalId: ticketExternalId,
        contactId: contact.id,
        queueId: queue.id,
        agentId: agent?.id,
        status,
        channel,
        subject,
        openedAt: sentAt,
        closedAt: status === TicketStatus.CLOSED ? sentAt : null,
        firstResponseAt: direction === MessageDirection.OUTBOUND ? sentAt : undefined,
        metadata: buildBlipTicketMetadata({
          channel,
          queueName,
          agentName,
          contactName: contact.name ?? 'Cliente BLiP',
          status,
          content,
          source,
        }),
      },
    });

    await this.attachTag(tenantId, ticket.id, 'BLiP', '#0ea5e9');
    await this.attachTag(tenantId, ticket.id, channel, channel === 'WhatsApp' ? '#22c55e' : '#38bdf8');

    await this.prisma.message.upsert({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId: messageExternalId,
        },
      },
      update: {
        ticketId: ticket.id,
        contactId: contact.id,
        agentId: agent?.id ?? null,
        rawEventId: rawEvent.id,
        direction,
        senderName: truncate(inferBlipSenderName(direction, contact.name, agentName), 160),
        content,
        contentType: truncate(readFirstString(message, ['content.type', 'type', 'message.type']) ?? 'text/plain', 80),
        sentAt,
      },
      create: {
        tenantId,
        ticketId: ticket.id,
        contactId: contact.id,
        agentId: agent?.id,
        rawEventId: rawEvent.id,
        externalId: messageExternalId,
        direction,
        senderName: truncate(inferBlipSenderName(direction, contact.name, agentName), 160),
        content,
        contentType: truncate(readFirstString(message, ['content.type', 'type', 'message.type']) ?? 'text/plain', 80),
        sentAt,
        metadata: {
          source: 'BLIP',
          provider: 'BLIP',
          syncSource: source,
          senderRole: direction === MessageDirection.INBOUND ? 'Cliente' : direction === MessageDirection.OUTBOUND ? 'Atendente/Bot' : 'Sistema',
        },
      },
    });

    return true;
  }

  private async upsertBlipRawEvent(tenantId: string, providerEventId: string, eventType: string, payload: unknown) {
    const payloadHash = hashJson({ eventType, payload });

    return this.prisma.rawEvent.upsert({
      where: {
        tenantId_provider_providerEventId: {
          tenantId,
          provider: IntegrationProvider.BLIP,
          providerEventId: truncate(providerEventId, 180),
        },
      },
      update: {
        eventType,
        payloadHash,
        payload: toInputJson(payload),
        processingStatus: RawEventStatus.PROCESSED,
        processedAt: new Date(),
        errorMessage: null,
      },
      create: {
        tenantId,
        provider: IntegrationProvider.BLIP,
        providerEventId: truncate(providerEventId, 180),
        eventType,
        payloadHash,
        payload: toInputJson(payload),
        processingStatus: RawEventStatus.PROCESSED,
        processedAt: new Date(),
      },
    });
  }

  private getBlipConfig() {
    const key = firstConfiguredValue(
      this.configService.get<string>('BLIP_BOT_KEY'),
      this.configService.get<string>('BLIP_ACCESS_KEY'),
      this.configService.get<string>('BLIP_AUTH_KEY'),
    );
    const commandsUrl = this.buildBlipCommandsUrl();

    if (!key) {
      throw new Error('BLIP_BOT_KEY precisa estar configurada no .env da API para sincronismo por API.');
    }

    if (commandsUrl.includes('SEU_CONTRATO')) {
      throw new Error('BLIP_HTTP_BASE_URL ou BLIP_CONTRACT_ID precisa estar configurado no .env da API.');
    }

    return {
      commandsUrl,
      key,
    };
  }

  private getBlipSyncOptions(): BlipSyncOptions {
    const rawContactLimit = Number(this.configService.get<string>('BLIP_SYNC_CONTACT_LIMIT', '200'));
    const rawLoggedLimit = Number(this.configService.get<string>('BLIP_SYNC_LOGGED_MESSAGE_LIMIT', '0'));

    return {
      contactLimit: Number.isFinite(rawContactLimit) && rawContactLimit > 0 ? clamp(rawContactLimit, 1, 100000) : null,
      contactPageSize: clamp(Number(this.configService.get<string>('BLIP_SYNC_CONTACT_PAGE_SIZE', '100')), 1, 100),
      maxContactPages: clamp(Number(this.configService.get<string>('BLIP_SYNC_MAX_CONTACT_PAGES', '20')), 1, 1000),
      threadMessagesPerContact: clamp(Number(this.configService.get<string>('BLIP_SYNC_THREAD_MESSAGES_PER_CONTACT', '20')), 1, 100),
      loggedMessagesLimit: Number.isFinite(rawLoggedLimit) && rawLoggedLimit > 0 ? clamp(rawLoggedLimit, 1, 100000) : null,
      loggedMessagesPageSize: clamp(Number(this.configService.get<string>('BLIP_SYNC_LOGGED_MESSAGE_PAGE_SIZE', '100')), 1, 100),
      maxLoggedMessagePages: clamp(Number(this.configService.get<string>('BLIP_SYNC_MAX_LOGGED_MESSAGE_PAGES', '3')), 1, 1000),
      includeContacts: this.configService.get<string>('BLIP_SYNC_INCLUDE_CONTACTS', 'true') !== 'false',
      includeThreads: this.configService.get<string>('BLIP_SYNC_INCLUDE_THREADS', 'true') !== 'false',
      includeLoggedMessages: this.configService.get<string>('BLIP_SYNC_INCLUDE_LOGGED_MESSAGES', 'false') === 'true',
    };
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

  private async testTeamsConnection(provider: SupportedProvider) {
    const checkedAt = new Date().toISOString();

    try {
      const token = await this.getTeamsGraphToken();
      const probes = await Promise.all([
        this.probeTeamsEndpoint(token, 'PSTN'),
        this.probeTeamsEndpoint(token, 'DIRECT_ROUTING'),
      ]);
      const ok = probes.some((probe) => probe.ok);

      return {
        provider,
        checkedAt,
        ok,
        status: ok ? 'ready' : 'permission_failed',
        message: ok
          ? 'Conexao com Microsoft Graph validada. O proximo passo e executar o sincronismo do Teams Phone.'
          : 'Token do Entra ID foi emitido, mas o Graph negou Call Records. Verifique CallRecords.Read.All com admin consent.',
        details: [
          { item: 'Client credentials gerou token no Entra ID', status: 'ok' },
          ...probes.map((probe) => ({
            item: probe.label,
            status: probe.ok ? 'ok' : `failed: ${probe.message}`,
          })),
        ],
      };
    } catch (error) {
      return {
        provider,
        checkedAt,
        ok: false,
        status: 'connection_failed',
        message: error instanceof Error ? error.message : 'Nao foi possivel validar o Microsoft Graph.',
        details: [
          { item: 'Verificar TEAMS_TENANT_ID, TEAMS_CLIENT_ID e TEAMS_CLIENT_SECRET', status: 'failed' },
          { item: 'Verificar permissao Application CallRecords.Read.All com admin consent', status: 'failed' },
        ],
      };
    }
  }

  private async syncTeamsPhoneCalls(tenantId: string) {
    const startedAt = new Date();
    const token = await this.getTeamsGraphToken();
    const syncOptions = this.getTeamsSyncOptions();
    const batches = await this.fetchTeamsCallBatches(token, syncOptions);
    let imported = 0;

    for (const batch of batches) {
      for (const row of batch.rows) {
        await this.upsertTeamsCall(tenantId, batch.source, row);
        imported += 1;
      }
    }

    await this.prisma.integrationConfig.updateMany({
      where: { tenantId, provider: IntegrationProvider.TEAMS_PHONE },
      data: {
        isActive: true,
        settings: {
          mode: 'configured',
          tenantId: this.configService.get<string>('TEAMS_TENANT_ID') ?? '',
          clientId: this.configService.get<string>('TEAMS_CLIENT_ID') ?? '',
          authMethod: 'client_credentials',
          syncStrategy: 'graph-callrecords',
          syncEnabled: this.configService.get<string>('TEAMS_SYNC_ENABLED', 'false') === 'true',
          permissions: ['CallRecords.Read.All'],
          lastSyncAt: new Date().toISOString(),
          lastSyncCount: imported,
          syncDays: syncOptions.days,
          syncMaxPages: syncOptions.maxPages,
          includePstn: syncOptions.includePstn,
          includeDirectRouting: syncOptions.includeDirectRouting,
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'integration.teams_phone.sync.completed',
        entityType: 'integration',
        entityId: IntegrationProvider.TEAMS_PHONE,
        metadata: {
          imported,
          batches: batches.map((batch) => ({ source: batch.source, rows: batch.rows.length })),
          startedAt: startedAt.toISOString(),
          finishedAt: new Date().toISOString(),
          syncDays: syncOptions.days,
        },
      },
    });

    return {
      provider: IntegrationProvider.TEAMS_PHONE,
      accepted: true,
      status: 'synced',
      message: `Sincronismo Teams Phone concluido: ${imported} ligacoes importadas ou atualizadas.`,
      imported,
      batches: batches.map((batch) => ({ source: batch.source, rows: batch.rows.length })),
    };
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
            syncLimit: syncOptions.limit ?? 'all',
            syncPageSize: syncOptions.pageSize,
            syncMaxPages: syncOptions.maxPages,
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
            syncLimit: syncOptions.limit ?? 'all',
            syncPageSize: syncOptions.pageSize,
            syncMaxPages: syncOptions.maxPages,
            activeOnly: syncOptions.activeOnly,
            activeStatuses: Array.from(syncOptions.statuses),
          },
        },
      });

      return {
        provider: IntegrationProvider.GLPI,
        accepted: true,
        status: 'synced',
        message: `Sincronismo GLPI concluido: ${imported} chamados importados ou atualizados no historico.`,
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
    const tickets: GlpiTicketPayload[] = [];

    for (let page = 0; page < syncOptions.maxPages; page += 1) {
      const start = page * syncOptions.pageSize;
      const end = start + syncOptions.pageSize - 1;
      const params = new URLSearchParams({
        range: `${start}-${end}`,
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
      const pageRows = Array.isArray(body) ? body.map((ticket) => asRecord(ticket) as GlpiTicketPayload) : [];

      if (pageRows.length === 0) {
        break;
      }

      tickets.push(...filterGlpiTicketsForSync(pageRows, syncOptions));

      if (syncOptions.limit && tickets.length >= syncOptions.limit) {
        return tickets.slice(0, syncOptions.limit);
      }

      if (pageRows.length < syncOptions.pageSize) {
        break;
      }
    }

    return syncOptions.limit ? tickets.slice(0, syncOptions.limit) : tickets;
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
    const rawLimit = Number(this.configService.get<string>('GLPI_SYNC_LIMIT', '0'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? clamp(rawLimit, 1, 100000) : null;
    const pageSize = clamp(Number(this.configService.get<string>('GLPI_SYNC_PAGE_SIZE', '100')), 1, 200);
    const maxPages = clamp(Number(this.configService.get<string>('GLPI_SYNC_MAX_PAGES', '1000')), 1, 10000);
    const syncDays = clamp(Number(this.configService.get<string>('GLPI_SYNC_DAYS', '0')), 0, 3650);
    const activeOnly = this.configService.get<string>('GLPI_SYNC_ACTIVE_ONLY', 'false') === 'true';
    const statuses = parseNumberSet(this.configService.get<string>('GLPI_SYNC_STATUSES', ''));

    return {
      limit,
      pageSize,
      maxPages,
      syncDays,
      activeOnly,
      statuses: statuses.size > 0 ? statuses : new Set([1, 2, 3, 4, 7]),
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

  private getTeamsConfig() {
    const tenantId = this.configService.get<string>('TEAMS_TENANT_ID') ?? '';
    const clientId = this.configService.get<string>('TEAMS_CLIENT_ID') ?? '';
    const clientSecret = this.configService.get<string>('TEAMS_CLIENT_SECRET') ?? '';
    const graphBaseUrl = (this.configService.get<string>('TEAMS_GRAPH_BASE_URL') ?? 'https://graph.microsoft.com').replace(/\/$/, '');

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error('TEAMS_TENANT_ID, TEAMS_CLIENT_ID e TEAMS_CLIENT_SECRET precisam estar configurados no .env da API.');
    }

    return {
      tenantId,
      clientId,
      clientSecret,
      graphBaseUrl,
    };
  }

  private getTeamsSyncOptions(): TeamsSyncOptions {
    return {
      days: clamp(Number(this.configService.get<string>('TEAMS_SYNC_DAYS', '7')), 1, 30),
      maxPages: clamp(Number(this.configService.get<string>('TEAMS_SYNC_MAX_PAGES', '20')), 1, 1000),
      includePstn: this.configService.get<string>('TEAMS_SYNC_INCLUDE_PSTN', 'true') !== 'false',
      includeDirectRouting: this.configService.get<string>('TEAMS_SYNC_INCLUDE_DIRECT_ROUTING', 'true') !== 'false',
    };
  }

  private async getTeamsGraphToken() {
    const { tenantId, clientId, clientSecret } = this.getTeamsConfig();
    const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Entra ID nao emitiu token para Teams Phone. Status ${response.status}: ${truncate(body, 240)}`);
    }

    const body = (await response.json()) as { access_token?: string };

    if (!body.access_token) {
      throw new Error('Entra ID nao retornou access_token para Microsoft Graph.');
    }

    return body.access_token;
  }

  private async probeTeamsEndpoint(token: string, source: TeamsCallBatch['source']) {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const url = this.buildTeamsCallRecordsUrl(source, from, now);

    try {
      await this.fetchGraphCollection(token, url, 1);

      return {
        ok: true,
        label: source === 'PSTN' ? 'Graph getPstnCalls respondeu' : 'Graph getDirectRoutingCalls respondeu',
        message: 'ok',
      };
    } catch (error) {
      return {
        ok: false,
        label: source === 'PSTN' ? 'Graph getPstnCalls respondeu' : 'Graph getDirectRoutingCalls respondeu',
        message: error instanceof Error ? error.message : 'erro desconhecido',
      };
    }
  }

  private async fetchTeamsCallBatches(token: string, options: TeamsSyncOptions): Promise<TeamsCallBatch[]> {
    const now = new Date();
    const from = new Date(now.getTime() - options.days * 24 * 60 * 60 * 1000);
    const batches: TeamsCallBatch[] = [];
    const errors: string[] = [];

    for (const source of ['PSTN', 'DIRECT_ROUTING'] as const) {
      if ((source === 'PSTN' && !options.includePstn) || (source === 'DIRECT_ROUTING' && !options.includeDirectRouting)) {
        continue;
      }

      try {
        const rows = await this.fetchGraphCollection(token, this.buildTeamsCallRecordsUrl(source, from, now), options.maxPages);
        batches.push({ source, rows });
      } catch (error) {
        errors.push(`${source}: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
      }
    }

    if (batches.length === 0 && errors.length > 0) {
      throw new Error(`Nao foi possivel consultar Teams Phone no Microsoft Graph. ${errors.join(' | ')}`);
    }

    return batches;
  }

  private buildTeamsCallRecordsUrl(source: TeamsCallBatch['source'], from: Date, to: Date) {
    const { graphBaseUrl } = this.getTeamsConfig();
    const method = source === 'PSTN' ? 'getPstnCalls' : 'getDirectRoutingCalls';
    const apiVersion =
      source === 'PSTN'
        ? this.configService.get<string>('TEAMS_GRAPH_PSTN_VERSION', 'beta')
        : this.configService.get<string>('TEAMS_GRAPH_DIRECT_ROUTING_VERSION', 'v1.0');
    const fromValue = encodeURIComponent(from.toISOString());
    const toValue = encodeURIComponent(to.toISOString());

    return `${graphBaseUrl}/${apiVersion}/communications/callRecords/${method}(fromDateTime=${fromValue},toDateTime=${toValue})`;
  }

  private async fetchGraphCollection(token: string, initialUrl: string, maxPages: number) {
    let url: string | undefined = initialUrl;
    const rows: Record<string, unknown>[] = [];

    for (let page = 0; page < maxPages && url; page += 1) {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Microsoft Graph retornou ${response.status}: ${truncate(body, 240)}`);
      }

      const body = (await response.json()) as Record<string, unknown>;
      const value = Array.isArray(body.value) ? body.value.map(asRecord) : [];
      rows.push(...value);
      url = readUnknownString(body['@odata.nextLink']);
    }

    return rows;
  }

  private async upsertTeamsCall(tenantId: string, source: TeamsCallBatch['source'], row: Record<string, unknown>) {
    const payloadHash = createHash('sha256').update(JSON.stringify(row)).digest('hex');
    const rowId =
      readUnknownString(row.id) ??
      readUnknownString(row.callId) ??
      readUnknownString(row.correlationId) ??
      payloadHash.slice(0, 40);
    const externalCallId = `teams-phone-${source.toLowerCase()}-${rowId}`;
    const callerNumber = readUnknownString(row.callerNumber) ?? readUnknownString(row.caller) ?? 'Numero nao informado';
    const calleeNumber = readUnknownString(row.calleeNumber) ?? readUnknownString(row.callee) ?? 'Numero nao informado';
    const userDisplayName =
      readUnknownString(row.userDisplayName) ??
      readUnknownString(row.displayName) ??
      readUnknownString(row.userPrincipalName) ??
      'Usuario Teams nao identificado';
    const userPrincipalName = readUnknownString(row.userPrincipalName);
    const callType = readUnknownString(row.callType) ?? readUnknownString(row.callDirection) ?? 'Teams Phone';
    const direction = inferTeamsDirection(callType);
    const startAt = parseDate(
      readUnknownString(row.startDateTime) ?? readUnknownString(row.inviteDateTime) ?? readUnknownString(row.callStartTime),
    ) ?? new Date();
    const durationSeconds = readDurationSeconds(row);
    const endAt =
      parseDate(readUnknownString(row.endDateTime) ?? readUnknownString(row.callEndTime)) ??
      new Date(startAt.getTime() + durationSeconds * 1000);
    const callFailed = isTeamsCallFailed(row, durationSeconds);
    const ticketStatus = callFailed ? TicketStatus.CANCELED : TicketStatus.CLOSED;
    const sourceLabel = source === 'PSTN' ? 'PSTN' : 'Direct Routing';
    const queueName = `Teams Phone - ${sourceLabel}`;
    const counterpartyNumber = direction === MessageDirection.INBOUND ? callerNumber : calleeNumber;

    const rawEvent = await this.prisma.rawEvent.upsert({
      where: {
        tenantId_provider_providerEventId: {
          tenantId,
          provider: IntegrationProvider.TEAMS_PHONE,
          providerEventId: externalCallId,
        },
      },
      update: {
        payloadHash,
        payload: toInputJson(row),
        eventType: `teams_phone.${source.toLowerCase()}.call`,
        processingStatus: RawEventStatus.PROCESSED,
        processedAt: new Date(),
        errorMessage: null,
      },
      create: {
        tenantId,
        provider: IntegrationProvider.TEAMS_PHONE,
        providerEventId: externalCallId,
        eventType: `teams_phone.${source.toLowerCase()}.call`,
        payloadHash,
        payload: toInputJson(row),
        processingStatus: RawEventStatus.PROCESSED,
        processedAt: new Date(),
      },
    });

    const contact = await this.prisma.contact.upsert({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId: `teams-phone-contact-${counterpartyNumber.replace(/\W/g, '') || rowId}`,
        },
      },
      update: {
        name: counterpartyNumber,
        phone: counterpartyNumber,
        metadata: {
          source: 'TEAMS_PHONE',
          callerNumber,
          calleeNumber,
        },
      },
      create: {
        tenantId,
        externalId: `teams-phone-contact-${counterpartyNumber.replace(/\W/g, '') || rowId}`,
        name: counterpartyNumber,
        phone: counterpartyNumber,
        metadata: {
          source: 'TEAMS_PHONE',
          callerNumber,
          calleeNumber,
        },
      },
    });

    const queue = await this.prisma.supportQueue.upsert({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId: `teams-phone-${source.toLowerCase()}`,
        },
      },
      update: { name: queueName, isActive: true },
      create: {
        tenantId,
        externalId: `teams-phone-${source.toLowerCase()}`,
        name: queueName,
        isActive: true,
      },
    });

    const agent = await this.prisma.agent.upsert({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId: `teams-phone-user-${readUnknownString(row.userId) ?? userPrincipalName ?? userDisplayName}`,
        },
      },
      update: {
        name: userDisplayName,
        email: userPrincipalName,
        isActive: true,
      },
      create: {
        tenantId,
        externalId: `teams-phone-user-${readUnknownString(row.userId) ?? userPrincipalName ?? userDisplayName}`,
        name: userDisplayName,
        email: userPrincipalName,
        isActive: true,
      },
    });

    const subject = `${teamsDirectionLabel(direction)} ${callerNumber} -> ${calleeNumber}`;
    const ticket = await this.prisma.ticket.upsert({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId: externalCallId,
        },
      },
      update: {
        contactId: contact.id,
        queueId: queue.id,
        agentId: agent.id,
        status: ticketStatus,
        channel: 'Teams Phone',
        subject,
        openedAt: startAt,
        closedAt: endAt,
        firstResponseAt: startAt,
        metadata: buildTeamsTicketMetadata({
          source,
          sourceLabel,
          callType,
          callerNumber,
          calleeNumber,
          durationSeconds,
          userDisplayName,
          userPrincipalName,
          callFailed,
        }),
      },
      create: {
        tenantId,
        externalId: externalCallId,
        contactId: contact.id,
        queueId: queue.id,
        agentId: agent.id,
        status: ticketStatus,
        channel: 'Teams Phone',
        subject,
        openedAt: startAt,
        closedAt: endAt,
        firstResponseAt: startAt,
        metadata: buildTeamsTicketMetadata({
          source,
          sourceLabel,
          callType,
          callerNumber,
          calleeNumber,
          durationSeconds,
          userDisplayName,
          userPrincipalName,
          callFailed,
        }),
      },
    });

    await this.attachTag(tenantId, ticket.id, 'Teams Phone', '#6264a7');
    await this.attachTag(tenantId, ticket.id, sourceLabel, source === 'PSTN' ? '#0ea5e9' : '#22c55e');

    if (callFailed) {
      await this.attachTag(tenantId, ticket.id, 'Abandono', '#f97316');
    }

    await this.prisma.message.upsert({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId: `${externalCallId}-summary`,
        },
      },
      update: {
        ticketId: ticket.id,
        contactId: contact.id,
        agentId: agent.id,
        rawEventId: rawEvent.id,
        content: teamsCallSummary({ sourceLabel, direction, callerNumber, calleeNumber, durationSeconds, callFailed }),
        sentAt: startAt,
      },
      create: {
        tenantId,
        ticketId: ticket.id,
        contactId: contact.id,
        agentId: agent.id,
        rawEventId: rawEvent.id,
        externalId: `${externalCallId}-summary`,
        direction,
        senderName: direction === MessageDirection.INBOUND ? counterpartyNumber : userDisplayName,
        content: teamsCallSummary({ sourceLabel, direction, callerNumber, calleeNumber, durationSeconds, callFailed }),
        contentType: 'application/teams-call-summary',
        sentAt: startAt,
        metadata: {
          source: 'TEAMS_PHONE',
          senderRole: direction === MessageDirection.INBOUND ? 'Origem externa' : 'Usuario Teams',
        },
      },
    });
  }

  private async attachTag(tenantId: string, ticketId: string, name: string, color: string) {
    const tag = await this.prisma.tag.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name,
        },
      },
      update: { color },
      create: {
        tenantId,
        name,
        color,
      },
    });

    await this.prisma.ticketTag.upsert({
      where: {
        tenantId_ticketId_tagId: {
          tenantId,
          ticketId,
          tagId: tag.id,
        },
      },
      update: {},
      create: {
        tenantId,
        ticketId,
        tagId: tag.id,
      },
    });
  }
}

type GlpiTicketPayload = Record<string, unknown>;

function parseJsonRecord(bodyText: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(bodyText) as unknown);
  } catch {
    return {};
  }
}

function hashJson(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function extractBlipItems(command: Record<string, unknown>) {
  const resource = command.resource;

  if (Array.isArray(resource)) {
    return resource.map(asRecord);
  }

  if (Array.isArray(command.items)) {
    return command.items.map(asRecord);
  }

  const resourceRecord = asRecord(resource);

  if (Array.isArray(resourceRecord.items)) {
    return resourceRecord.items.map(asRecord);
  }

  if (Array.isArray(resourceRecord.messages)) {
    return resourceRecord.messages.map(asRecord);
  }

  if (resource && typeof resource === 'object') {
    return [resourceRecord];
  }

  return [];
}

function unwrapBlipMessage(messagePayload: BlipThreadMessagePayload) {
  const nestedMessage = asRecord(messagePayload.message);

  if (Object.keys(nestedMessage).length === 0) {
    return messagePayload;
  }

  return {
    ...messagePayload,
    ...nestedMessage,
    metadata: {
      ...asRecord(messagePayload.metadata),
      ...asRecord(nestedMessage.metadata),
    },
  };
}

function extractBlipContactIdentity(payload: Record<string, unknown>) {
  const identity = readFirstString(payload, [
    'identity',
    'userIdentity',
    'contactIdentity',
    'customerIdentity',
    'address',
    'contact.identity',
    'customer.identity',
    'resource.identity',
    'resource.customer.identity',
  ]);

  return identity ? truncate(identity, 180) : undefined;
}

function extractBlipTunnelOriginator(payload: Record<string, unknown>) {
  const originator = readFirstString(payload, [
    'extras.tunnel.originator',
    'metadata.tunnel.originator',
    'resource.extras.tunnel.originator',
  ]);

  return originator ? truncate(originator, 180) : undefined;
}

function extractBlipThreadIdentityCandidates(payload: Record<string, unknown>): BlipThreadIdentityCandidate[] {
  const identity = extractBlipContactIdentity(payload);
  const originator = extractBlipTunnelOriginator(payload);
  const candidates: BlipThreadIdentityCandidate[] = [];

  if (identity) {
    candidates.push({
      identity,
      getFromOriginator: identity.toLowerCase().includes('@tunnel.msging.net'),
      source: 'contact.identity',
    });
  }

  if (originator && originator !== identity) {
    candidates.push({
      identity: originator,
      getFromOriginator: false,
      source: 'extras.tunnel.originator',
    });
  }

  return candidates.filter(
    (candidate, index, all) => all.findIndex((item) => item.identity === candidate.identity) === index,
  );
}

function extractBlipConversationIdentity(
  payload: Record<string, unknown>,
  fallbackIdentity?: string,
  from?: string,
  to?: string,
) {
  const explicit = readFirstString(payload, [
    'contact.identity',
    'customer.identity',
    'resource.customer.identity',
    'resource.contact.identity',
    'metadata.customerIdentity',
    'userIdentity',
    'identity',
  ]);
  const candidate = explicit ?? fallbackIdentity ?? [from, to].find((item) => item && isLikelyBlipCustomerAddress(item));

  return candidate ? truncate(candidate, 180) : undefined;
}

function extractBlipContactName(payload: Record<string, unknown>, identity: string) {
  return (
    readFirstString(payload, [
      'name',
      'fullName',
      'displayName',
      'contact.name',
      'customer.name',
      'resource.customer.name',
      'extras.name',
    ]) ?? extractBlipPhone(payload, identity) ?? 'Cliente BLiP'
  );
}

function extractBlipPhone(payload: Record<string, unknown> | undefined, identity?: string) {
  const explicit = payload
    ? readFirstString(payload, ['phoneNumber', 'phone', 'telephone', 'contact.phone', 'customer.phone', 'extras.phone'])
    : undefined;

  if (explicit) {
    return truncate(explicit, 40);
  }

  if (!identity) {
    return undefined;
  }

  const identityWithPhone = payload ? extractBlipTunnelOriginator(payload) ?? identity : identity;
  const [prefix] = identityWithPhone.split('@');
  const digits = prefix.replace(/\D/g, '');

  return digits.length >= 8 ? truncate(`+${digits}`, 40) : undefined;
}

function inferBlipChannel(payload: Record<string, unknown>, identity?: string) {
  const explicit = readFirstString(payload, ['channel', 'source', 'resource.channel', 'metadata.channel', 'extras.channel']);

  if (explicit) {
    return truncate(explicit, 80);
  }

  const source = identity?.toLowerCase() ?? '';

  if (source.includes('@wa.gw') || source.includes('whatsapp')) {
    return 'WhatsApp';
  }

  if (source.includes('instagram')) {
    return 'Instagram';
  }

  if (source.includes('facebook')) {
    return 'Facebook';
  }

  if (source.includes('mail') || source.includes('email')) {
    return 'E-mail';
  }

  return 'BLiP';
}

function inferBlipDirection(payload: Record<string, unknown>, from?: string, to?: string): MessageDirection {
  const direction = readFirstString(payload, ['direction', 'message.direction', 'resource.direction'])?.toLowerCase();

  if (direction && ['outbound', 'outgoing', 'sent', 'enviada'].includes(direction)) {
    return MessageDirection.OUTBOUND;
  }

  if (direction && ['inbound', 'incoming', 'received', 'recebida'].includes(direction)) {
    return MessageDirection.INBOUND;
  }

  if (from && isLikelyBlipCustomerAddress(from)) {
    return MessageDirection.INBOUND;
  }

  if (to && isLikelyBlipCustomerAddress(to)) {
    return MessageDirection.OUTBOUND;
  }

  return MessageDirection.SYSTEM;
}

function inferBlipTicketStatus(payload: Record<string, unknown>) {
  const status = readFirstString(payload, ['status', 'ticket.status', 'resource.status', 'metadata.status'])?.toLowerCase();

  if (!status) {
    return TicketStatus.OPEN;
  }

  if (['closed', 'finished', 'completed', 'resolved', 'fechado', 'finalizado', 'resolvido'].includes(status)) {
    return TicketStatus.CLOSED;
  }

  if (['canceled', 'cancelled', 'cancelado'].includes(status)) {
    return TicketStatus.CANCELED;
  }

  if (['pending', 'waiting', 'pendente', 'aguardando'].includes(status)) {
    return TicketStatus.PENDING;
  }

  return TicketStatus.OPEN;
}

function extractBlipDate(payload: Record<string, unknown>, fallback: Date) {
  const value = readFirstValue(payload, ['date', 'timestamp', 'sentAt', 'message.date', 'resource.date', 'metadata.#wa.timestamp']);

  if (typeof value === 'string') {
    const parsed = /^\d+$/.test(value) ? new Date(Number(value) * (value.length <= 10 ? 1000 : 1)) : new Date(value);

    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }

  if (typeof value === 'number') {
    const parsed = new Date(value * (value <= 9999999999 ? 1000 : 1));

    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }

  return fallback;
}

function extractBlipContent(payload: Record<string, unknown>) {
  const value = readFirstValue(payload, ['content', 'text', 'body', 'message.content', 'resource.content']);

  if (typeof value === 'string') {
    return value.trim() || undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value && typeof value === 'object') {
    const record = asRecord(value);
    const text = readFirstString(record, ['text', 'title', 'description', 'value']);

    return text ?? JSON.stringify(value);
  }

  return undefined;
}

function inferBlipSenderName(direction: MessageDirection, contactName?: string | null, agentName?: string) {
  if (direction === MessageDirection.INBOUND) {
    return contactName ?? 'Cliente BLiP';
  }

  if (direction === MessageDirection.OUTBOUND) {
    return agentName ?? 'BLiP Bot / Atendente';
  }

  return 'BLiP';
}

function buildBlipTicketMetadata({
  channel,
  queueName,
  agentName,
  contactName,
  status,
  content,
  source,
}: {
  channel: string;
  queueName: string;
  agentName?: string;
  contactName: string;
  status: TicketStatus;
  content: string;
  source: 'thread' | 'logged-message';
}) {
  const contentLower = content.toLowerCase();
  const isComplaint = /reclama|problema|cancel|insatis|demora|erro|falha/.test(contentLower);
  const isOpportunity = /compr|proposta|orcamento|orçamento|venda|valor|preco|preço/.test(contentLower);
  const risk = isComplaint ? 'medio' : 'baixo';

  return {
    source: 'BLIP',
    provider: 'BLIP',
    syncSource: source,
    channel,
    queueDisplayName: queueName,
    agentDisplayName: agentName ?? 'Sem atendente identificado',
    customerDisplayName: contactName,
    group: queueName,
    signal: `Conversa / ${channel}`,
    sentiment: isComplaint ? 'negativo' : 'neutro',
    risk,
    resolutionStatus: status === TicketStatus.CLOSED ? 'Finalizado no BLiP' : 'Historico importado do BLiP',
    waitMinutes: 0,
    summary: truncate(content, 280),
    isComplaint,
    isOpportunity,
    botFallback: false,
    unresolved: status !== TicketStatus.CLOSED,
  };
}

function readFirstString(payload: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = readPathValue(payload, path);

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function readFirstValue(payload: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = readPathValue(payload, path);

    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
}

function readPathValue(payload: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, payload);
}

function isLikelyBlipCustomerAddress(value: string) {
  const normalized = value.toLowerCase();

  return (
    normalized.includes('@wa.gw.msging.net') ||
    normalized.includes('@instagram.gw') ||
    normalized.includes('@facebook.gw') ||
    normalized.includes('@0mn.io') ||
    (!normalized.includes('@msging.net') && !normalized.includes('postmaster@'))
  );
}

function stableExternalId(prefix: string, value: string) {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return truncate(`${prefix}-${slug || hashJson(value).slice(0, 16)}`, 180);
}

function normalizeBlipBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/$/, '');
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  return withProtocol.replace(/\/commands$/, '');
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
    return [
      'WEBHOOK_PUBLIC_BASE_URL',
      'BLIP_WEBHOOK_SECRET quando o secret for obrigatorio',
      'BLIP_BOT_KEY para backfill por API',
      'BLIP_HTTP_BASE_URL ou BLIP_CONTRACT_ID',
    ];
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
      ? 'Configurar o webhook na plataforma e executar sync quando quiser puxar historico recente.'
      : 'Executar teste de prontidao e habilitar o conector real de sincronismo.';
  }

  return `Configurar ${missingSettings.join(', ')} no .env da API e rodar o seed novamente.`;
}

function readyMessage(provider: SupportedProvider) {
  if (provider === IntegrationProvider.BLIP) {
    return 'Webhook e backfill BLiP prontos. A key continua somente no backend.';
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
      'Definir BLIP_BOT_KEY e BLIP_HTTP_BASE_URL ou BLIP_CONTRACT_ID para sincronizar historico recente.',
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

  const trimmed = value.trim();

  if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(trimmed)) {
    return false;
  }

  if (/^(SEU_|SUA_|COLE_AQUI|VALOR_|CHANGEME|CHANGE_ME)/i.test(trimmed)) {
    return false;
  }

  return true;
}

function firstConfiguredValue(...values: Array<string | undefined>) {
  return values.find((value) => hasConfiguredValue(value));
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

  if (status === 7) {
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

  if (normalizedStatus.includes('aprov')) {
    return 7;
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
    7: 'Aprovacao',
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

function buildTeamsTicketMetadata({
  source,
  sourceLabel,
  callType,
  callerNumber,
  calleeNumber,
  durationSeconds,
  userDisplayName,
  userPrincipalName,
  callFailed,
}: {
  source: TeamsCallBatch['source'];
  sourceLabel: string;
  callType: string;
  callerNumber: string;
  calleeNumber: string;
  durationSeconds: number;
  userDisplayName: string;
  userPrincipalName?: string;
  callFailed: boolean;
}) {
  const durationMinutes = Number((durationSeconds / 60).toFixed(1));

  return {
    source: 'TEAMS_PHONE',
    provider: 'TEAMS_PHONE',
    graphSource: source,
    callType,
    callerNumber,
    calleeNumber,
    durationSeconds,
    durationMinutes,
    userDisplayName,
    userPrincipalName,
    group: 'Teams Phone',
    signal: callFailed ? 'Telefonia / Nao atendida' : `Telefonia / ${sourceLabel}`,
    sentiment: callFailed ? 'negativo' : 'neutro',
    risk: callFailed ? 'medio' : 'baixo',
    resolutionStatus: callFailed ? 'Nao atendida ou falhou' : 'Chamada concluida',
    waitMinutes: 0,
    summary: callFailed
      ? `Ligacao ${sourceLabel} sem atendimento ou com falha entre ${callerNumber} e ${calleeNumber}.`
      : `Ligacao ${sourceLabel} concluida entre ${callerNumber} e ${calleeNumber}, duracao de ${durationMinutes} min.`,
    isComplaint: false,
    isOpportunity: false,
    botFallback: false,
    unresolved: callFailed,
  };
}

function inferTeamsDirection(callType: string) {
  const normalized = callType.toLowerCase();

  if (normalized.includes('inbound') || normalized.includes('incoming') || normalized.includes('entrada') || normalized.includes('ucap_in')) {
    return MessageDirection.INBOUND;
  }

  return MessageDirection.OUTBOUND;
}

function teamsDirectionLabel(direction: MessageDirection) {
  return direction === MessageDirection.INBOUND ? 'Ligacao recebida' : 'Ligacao realizada';
}

function teamsCallSummary({
  sourceLabel,
  direction,
  callerNumber,
  calleeNumber,
  durationSeconds,
  callFailed,
}: {
  sourceLabel: string;
  direction: MessageDirection;
  callerNumber: string;
  calleeNumber: string;
  durationSeconds: number;
  callFailed: boolean;
}) {
  const durationMinutes = Number((durationSeconds / 60).toFixed(1)).toString().replace('.', ',');
  const status = callFailed ? 'nao atendida ou com falha' : `concluida em ${durationMinutes} min`;

  return `${teamsDirectionLabel(direction)} via ${sourceLabel}: ${callerNumber} -> ${calleeNumber}. Resultado: ${status}.`;
}

function readDurationSeconds(row: Record<string, unknown>) {
  const raw =
    readUnknownString(row.duration) ??
    readUnknownString(row.durationSeconds) ??
    readUnknownString(row.callDuration) ??
    readUnknownString(row.totalCallDuration);

  if (!raw) {
    return 0;
  }

  const numeric = Number(raw);

  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.round(numeric));
  }

  const timeParts = raw.split(':').map((part) => Number(part));

  if (timeParts.length === 3 && timeParts.every(Number.isFinite)) {
    return timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
  }

  const isoMatch = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(raw);

  if (isoMatch) {
    return Number(isoMatch[1] ?? 0) * 3600 + Number(isoMatch[2] ?? 0) * 60 + Number(isoMatch[3] ?? 0);
  }

  return 0;
}

function isTeamsCallFailed(row: Record<string, unknown>, durationSeconds: number) {
  const successful = readBooleanish(row.successfulCall) ?? readBooleanish(row.isSuccessful);

  if (successful === false) {
    return true;
  }

  const result = [
    readUnknownString(row.callResult),
    readUnknownString(row.finalSipCodePhrase),
    readUnknownString(row.failureDateTime),
    readUnknownString(row.failureReason),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return durationSeconds === 0 || /fail|miss|unanswered|declined|busy|abandon|error|falha|nao atend/.test(result);
}

function readBooleanish(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }

    if (value.toLowerCase() === 'false') {
      return false;
    }
  }

  return undefined;
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
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
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
