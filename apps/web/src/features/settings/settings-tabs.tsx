import {
  AlertTriangle,
  Archive,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Database,
  EyeOff,
  FileClock,
  KeyRound,
  Layers3,
  LockKeyhole,
  PhoneCall,
  PlugZap,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
  TestTube2,
  UserCog,
  UsersRound,
  Webhook,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import type {
  IntegrationProvider,
  IntegrationSummary,
  IntegrationSyncResult,
  IntegrationTestResult,
  SettingsOverview,
} from '@/lib/api-client';
import {
  ComplianceRow,
  ConfigField,
  HealthCard,
  PipelineStep,
  SectionTitle,
  StatusPill,
  ToggleRow,
} from './settings-components';
import { permissionRows, type MockUserRow, type PermissionRow } from './settings-data';

type CopyHandler = (label: string, value: string) => void;

const userColumns: DataTableColumn<MockUserRow>[] = [
  {
    key: 'name',
    header: 'Usuario',
    accessor: (row) => (
      <div>
        <p className="font-semibold text-card-foreground">{row.name}</p>
        <p className="text-xs text-muted-foreground">{row.email}</p>
      </div>
    ),
  },
  { key: 'area', header: 'Area', accessor: (row) => row.area },
  {
    key: 'role',
    header: 'Perfil',
    accessor: (row) => <span className="font-medium text-card-foreground">{row.role.replace('ATENDEBI_', '')}</span>,
  },
  { key: 'status', header: 'Status', accessor: (row) => <StatusPill status={row.status} /> },
  { key: 'lastAccess', header: 'Ultimo acesso', accessor: (row) => row.lastAccess },
];

const permissionColumns: DataTableColumn<PermissionRow>[] = [
  {
    key: 'module',
    header: 'Modulo',
    accessor: (row) => <span className="font-semibold text-card-foreground">{row.module}</span>,
  },
  { key: 'admin', header: 'Admin', accessor: (row) => row.admin },
  { key: 'diretoria', header: 'Diretoria', accessor: (row) => row.diretoria },
  { key: 'gestor', header: 'Gestor', accessor: (row) => row.gestor },
  { key: 'qualidade', header: 'Qualidade', accessor: (row) => row.qualidade },
  { key: 'comercial', header: 'Comercial', accessor: (row) => row.comercial },
  { key: 'atendente', header: 'Atendente', accessor: (row) => row.atendente },
];

export function IntegrationTab({
  copied,
  webhookSecretRequired,
  settings,
  testingProvider,
  syncingProvider,
  integrationResults,
  onCopy,
  onTestIntegration,
  onSyncIntegration,
  onToggleSecret,
}: {
  copied: string | null;
  webhookSecretRequired: boolean;
  settings?: SettingsOverview;
  testingProvider: IntegrationProvider | null;
  syncingProvider: IntegrationProvider | null;
  integrationResults: Record<string, IntegrationTestResult | IntegrationSyncResult>;
  onCopy: CopyHandler;
  onTestIntegration: (provider: IntegrationProvider) => void | Promise<void>;
  onSyncIntegration: (provider: IntegrationProvider) => void | Promise<void>;
  onToggleSecret: () => void;
}) {
  const integrations = settings?.integrations ?? [];

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-5 shadow-panel">
        <SectionTitle
          icon={PlugZap}
          title="Fontes de dados do atendimento"
          description="O AtendeBI pode receber conversas do BLiP, chamados do GLPI e telefonia do Teams/PABX sem expor segredos no frontend."
        />

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {integrations.map((item) => (
            <IntegrationProviderCard
              key={item.provider}
              integration={item}
              copied={copied}
              result={integrationResults[item.provider]}
              testing={testingProvider === item.provider}
              syncing={syncingProvider === item.provider}
              onCopy={onCopy}
              onTestIntegration={onTestIntegration}
              onSyncIntegration={onSyncIntegration}
            />
          ))}
          {integrations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary p-5 text-sm leading-6 text-muted-foreground xl:col-span-3">
              Nenhuma integracao retornada pela API. Rode o seed de configuracao e depois sincronize uma origem real.
            </div>
          ) : null}
        </div>

      </section>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-lg border border-border bg-card p-5 shadow-panel">
          <SectionTitle
            icon={Webhook}
            title="Pipeline de entrada"
            description="Cada origem entra por um conector, mas tudo vira historico auditavel no banco do AtendeBI."
          />
          <div className="mt-5 space-y-3">
            <PipelineStep number="1" title="Receber ou sincronizar" description="BLiP entra por webhook; GLPI e Teams entram por sincronismo controlado no backend." />
            <PipelineStep number="2" title="Salvar bruto" description="Todo evento relevante permanece em raw_events para auditoria, rastreio e reprocessamento." />
            <PipelineStep number="3" title="Normalizar" description="Conectores transformam origem em Contact, Ticket, Message, fila, atendente e metadados." />
            <PipelineStep number="4" title="Disponibilizar BI" description="Dashboard usa banco proprio, nao chama BLiP, GLPI ou Graph direto no frontend." />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-panel">
          <SectionTitle icon={ShieldCheck} title="Seguranca dos conectores" description="Pontos que precisam ficar prontos antes de ligar dados reais em producao." />
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <ToggleRow
              icon={KeyRound}
              label="Exigir secret no webhook BLiP"
              description="Usa o header x-atendebi-webhook-secret quando estiver habilitado."
              checked={webhookSecretRequired}
              onToggle={onToggleSecret}
            />
            <ToggleRow
              icon={Database}
              label="Salvar evento bruto"
              description="Payload original fica em raw_events por tenant para auditoria."
              checked
              locked
            />
            <ToggleRow
              icon={ServerCog}
              label="Segredos somente no backend"
              description="Tokens GLPI, BLiP e Graph ficam no .env/cofre, nunca no browser."
              checked
              locked
            />
            <ToggleRow
              icon={LockKeyhole}
              label="Escopo por tenant"
              description="Cada sincronismo usa tenant_id e nao mistura dados de empresas."
              checked
              locked
            />
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-info/30 bg-info/10 p-5 shadow-panel">
        <SectionTitle
          icon={Layers3}
          title="Como configurar agora"
          description="GLPI e o caminho mais rapido para testar dados reais; Teams/PABX depende de permissao no Microsoft Graph."
        />
        <div className="mt-5 grid gap-3 xl:grid-cols-3">
          <SetupChecklist
            title="BLiP"
            icon={PlugZap}
            items={[
              'Pedir acesso ao BLiP no trabalho.',
              'Cadastrar a Webhook URL exibida nesta tela.',
              'Definir BLIP_WEBHOOK_SECRET quando o ambiente exigir secret.',
            ]}
          />
          <SetupChecklist
            title="GLPI"
            icon={ServerCog}
            items={[
              'Habilitar API REST no GLPI.',
              'Gerar App Token e User Token de usuario tecnico.',
              'Preencher GLPI_BASE_URL, GLPI_APP_TOKEN e GLPI_USER_TOKEN no .env da API.',
            ]}
          />
          <SetupChecklist
            title="Teams Phone / PABX"
            icon={PhoneCall}
            items={[
              'Criar App Registration no Entra ID.',
              'Liberar CallRecords.Read.All e Reports.Read.All como Application.',
              'Conceder admin consent e preencher tenant, client id e client secret.',
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function IntegrationProviderCard({
  integration,
  copied,
  result,
  testing,
  syncing,
  onCopy,
  onTestIntegration,
  onSyncIntegration,
}: {
  integration: IntegrationSummary;
  copied: string | null;
  result?: IntegrationTestResult | IntegrationSyncResult;
  testing: boolean;
  syncing: boolean;
  onCopy: CopyHandler;
  onTestIntegration: (provider: IntegrationProvider) => void | Promise<void>;
  onSyncIntegration: (provider: IntegrationProvider) => void | Promise<void>;
}) {
  const Icon = providerIcon(integration.provider);
  const canSync = integration.provider !== 'BLIP';

  return (
    <article className="flex min-h-[430px] flex-col rounded-lg border border-border bg-secondary p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{integration.category}</p>
            <h3 className="mt-1 text-base font-semibold text-card-foreground">{integration.label}</h3>
          </div>
        </div>
        <IntegrationStatusBadge integration={integration} />
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">{integration.description}</p>

      <div className="mt-4 grid gap-2">
        <SmallConfigRow label="Nome" value={integration.name} />
        <SmallConfigRow label="Eventos brutos" value={`${integration.rawEvents} raw_events`} />
        <SmallConfigRow label="Ultimo evento" value={formatNullableDate(integration.lastEventAt)} />
        {integration.provider === 'BLIP' && integration.webhookUrl ? (
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Webhook URL</p>
            <code className="mt-1 block break-all text-xs font-semibold text-card-foreground">{integration.webhookUrl}</code>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Configuracao</p>
        <div className="mt-2 grid gap-2">
          {Object.entries(integration.settingsPreview).slice(0, 4).map(([key, value]) => (
            <SmallConfigRow key={key} label={prettyKey(key)} value={formatPreviewValue(value)} />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {integration.capabilities.slice(0, 6).map((capability) => (
          <span key={capability} className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground">
            {capability}
          </span>
        ))}
      </div>

      {integration.missingSettings.length ? (
        <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <p className="text-xs leading-5 text-muted-foreground">
              Falta configurar: <span className="font-semibold text-card-foreground">{integration.missingSettings.join(', ')}</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-success/30 bg-success/10 p-3">
          <div className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <p className="text-xs leading-5 text-muted-foreground">{integration.nextAction}</p>
          </div>
        </div>
      )}

      {result ? <IntegrationResultBox result={result} /> : null}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {integration.provider === 'BLIP' && integration.webhookUrl ? (
          <Button variant="outline" size="sm" type="button" onClick={() => onCopy('webhook', integration.webhookUrl ?? '')}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            {copied === 'webhook' ? 'Copiado' : 'Copiar URL'}
          </Button>
        ) : null}
        <Button size="sm" type="button" onClick={() => onTestIntegration(integration.provider)} disabled={testing}>
          <TestTube2 className="h-4 w-4" aria-hidden="true" />
          {testing ? 'Testando' : 'Testar'}
        </Button>
        {canSync ? (
          <Button variant="outline" size="sm" type="button" onClick={() => onSyncIntegration(integration.provider)} disabled={syncing}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {syncing ? 'Sincronizando' : integration.provider === 'GLPI' ? 'Sincronizar' : 'Preparar sync'}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function IntegrationStatusBadge({ integration }: { integration: IntegrationSummary }) {
  const styles = {
    connected: 'border-success/30 bg-success/10 text-success',
    ready: 'border-info/30 bg-info/10 text-info',
    pending: 'border-warning/30 bg-warning/10 text-warning',
  }[integration.status];

  return <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${styles}`}>{integration.statusLabel}</span>;
}

function IntegrationResultBox({ result }: { result: IntegrationTestResult | IntegrationSyncResult }) {
  const ok = 'ok' in result ? result.ok : result.accepted;

  return (
    <div className={`mt-4 rounded-md border p-3 ${ok ? 'border-success/30 bg-success/10' : 'border-warning/30 bg-warning/10'}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{'checkedAt' in result ? 'Resultado do teste' : 'Resultado do sync'}</p>
      <p className="mt-2 text-sm leading-6 text-card-foreground">{result.message}</p>
    </div>
  );
}

function SmallConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="break-all text-right text-xs font-semibold text-card-foreground">{value}</span>
    </div>
  );
}

function SetupChecklist({ title, icon: Icon, items }: { title: string; icon: LucideIcon; items: string[] }) {
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="font-semibold text-card-foreground">{title}</p>
      </div>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function providerIcon(provider: IntegrationProvider) {
  if (provider === 'GLPI') {
    return ServerCog;
  }

  if (provider === 'TEAMS_PHONE') {
    return PhoneCall;
  }

  return PlugZap;
}

function formatNullableDate(value: string | null) {
  if (!value) {
    return 'Sem evento';
  }

  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatPreviewValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Nao';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  return 'Configurado';
}

function prettyKey(value: string) {
  const labels: Record<string, string> = {
    mode: 'Modo',
    sourceRetentionDays: 'Retencao origem',
    atendebiRetentionDays: 'Retencao AtendeBI',
    baseUrl: 'Base URL',
    apiPath: 'API path',
    authMethod: 'Autenticacao',
    syncStrategy: 'Sincronismo',
    syncEnabled: 'Sync ativo',
    tenantId: 'Tenant ID',
    clientId: 'Client ID',
    permissions: 'Permissoes',
  };

  return labels[value] ?? value;
}

export function SecurityTab({
  structuredAudit,
  maskSensitiveData,
  settings,
  onToggleAudit,
  onToggleMask,
}: {
  structuredAudit: boolean;
  maskSensitiveData: boolean;
  settings?: SettingsOverview;
  onToggleAudit: () => void;
  onToggleMask: () => void;
}) {
  const security = settings?.security;

  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-lg border border-border bg-card p-5 shadow-panel">
        <SectionTitle
          icon={ShieldCheck}
          title="Seguranca e autenticacao"
          description="Camada atual mockada, preparada para Microsoft Entra ID e validacao de token na API."
        />
        <div className="mt-5 grid gap-3">
          <ConfigField label="Login atual" value={security?.authMode ?? 'Mock local com usuario Daniel Fernando'} />
          <ConfigField label="Futuro provedor" value="Microsoft Entra ID / OAuth2 / OIDC" />
          <ConfigField label="API" value={security?.tokenValidation ?? 'Validara token e roles antes de retornar dados do tenant'} />
          <ConfigField label="Chaves BLiP" value={security?.blipTokenInFrontend ? 'Revisar: chave exposta' : 'Sempre no backend ou cofre de segredo, nunca no frontend'} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-panel">
        <SectionTitle icon={SlidersHorizontal} title="Controles ativos" description="Opcoes mockadas que representam politicas reais do tenant." />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <ToggleRow
            icon={FileClock}
            label="Logs de auditoria estruturados"
            description="Registra acoes administrativas e acessos criticos por tenant."
            checked={structuredAudit}
            onToggle={onToggleAudit}
          />
          <ToggleRow
            icon={EyeOff}
            label="Mascarar dados sensiveis"
            description="Prepara exibicao com minimizacao de telefone, documento e identificadores."
            checked={maskSensitiveData}
            onToggle={onToggleMask}
          />
          <ToggleRow icon={LockKeyhole} label="Escopo por tenant" description="Todas as consultas devem manter filtro por tenant_id." checked locked />
          <ToggleRow icon={KeyRound} label="Rotacao de segredo" description="Secret do webhook sera rotacionavel em etapa de backend." checked locked />
        </div>
      </section>
    </div>
  );
}

export function ProfilesTab({ settings }: { settings?: SettingsOverview }) {
  const users = settings?.users.length ? settings.users.map(mapApiUser) : [];
  const roles = settings?.roles.length ? settings.roles : [];

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-5 shadow-panel">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <SectionTitle
            icon={UserCog}
            title="Usuarios"
            description="Base mockada para evoluir depois para cadastro real, convites e sincronismo com Entra ID."
          />
          <Button variant="outline" type="button">
            <UsersRound className="h-4 w-4" aria-hidden="true" />
            Convidar usuario mockado
          </Button>
        </div>
        <div className="mt-5">
          <DataTable
            data={users}
            columns={userColumns}
            getSearchValue={(row) => `${row.name} ${row.email} ${row.role} ${row.area} ${row.status}`}
            searchPlaceholder="Buscar usuario, email, perfil ou area"
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-border bg-card p-5 shadow-panel">
          <SectionTitle icon={UsersRound} title="Perfis previstos" description="Perfis usados para permissoes, dashboards e recortes futuros." />
          <div className="mt-5 space-y-3">
            {roles.map((role) => (
              <article key={role.role} className="rounded-lg border border-border bg-secondary p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-card-foreground">{role.label}</p>
                    <p className="mt-1 text-xs font-medium text-primary">{role.role}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{role.description}</p>
                  </div>
                  <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                    {role.users}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-panel">
          <SectionTitle icon={LockKeyhole} title="Matriz de permissao" description="Mapa inicial para evitar acesso indevido entre areas." />
          <div className="mt-5">
            <DataTable
              data={permissionRows}
              columns={permissionColumns}
              getSearchValue={(row) => Object.values(row).join(' ')}
              searchPlaceholder="Buscar modulo ou perfil"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

export function RetentionTab({
  retentionMonths,
  retentionDays,
  estimatedStorage,
  settings,
  onChangeRetention,
}: {
  retentionMonths: string;
  retentionDays: number;
  estimatedStorage: number;
  settings?: SettingsOverview;
  onChangeRetention: (value: string) => void;
}) {
  const retention = settings?.retention;
  const groups = settings?.groups.length
    ? settings.groups.map((group) => ({
        id: group.id,
        name: group.name,
        tickets: group.tickets,
        openTickets: group.openTickets,
        highRiskTickets: 0,
        averageRating: null as number | null,
        channels: group.channels,
        queues: ['API real'],
      }))
    : [];

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-info/30 bg-info/10 p-5 shadow-panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <SectionTitle
            icon={Archive}
            title="Retencao historica"
            description="O AtendeBI guarda historico proprio para BI e auditoria, mesmo quando a plataforma de origem mantem dados por menos tempo."
          />
          <label className="min-w-56 text-xs font-medium text-muted-foreground">
            Politica do tenant
            <select
              value={retentionMonths}
              onChange={(event) => onChangeRetention(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            >
              <option value="12">12 meses</option>
              <option value="24">24 meses</option>
              <option value="36">36 meses</option>
              <option value="60">60 meses</option>
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <HealthCard
            icon={Database}
            label="Retencao origem"
            value={`${retention?.sourceRetentionDays ?? 0} dias`}
            detail="Referencia da origem configurada"
            tone="warning"
          />
          <HealthCard
            icon={Archive}
            label="AtendeBI"
            value={`${retention?.retentionDays ?? retentionDays} dias`}
            detail={retention?.retentionPolicy ?? 'Historico proprio por tenant'}
            tone="success"
          />
          <HealthCard
            icon={FileClock}
            label="Uso estimado"
            value={`${retention?.estimatedStorageGb ?? estimatedStorage} GB`}
            detail="Simulacao mensal acumulada"
            tone="info"
          />
          <HealthCard icon={RefreshCw} label="Backup" value="Diario" detail="Politica futura por ambiente" tone="neutral" />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-panel">
        <SectionTitle icon={Layers3} title="Grupos e canais" description="Usados para organizar historico quando houver milhares de conversas por dia." />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {groups.slice(0, 8).map((group) => (
            <article key={group.id} className="rounded-lg border border-border bg-secondary p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-card-foreground">{group.name}</p>
                  <p className="text-xs text-muted-foreground">{group.queues.join(', ')}</p>
                </div>
                <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                  {group.tickets}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>{group.openTickets} abertos</span>
                <span className="text-right">{group.highRiskTickets} risco alto</span>
                <span>{group.averageRating === null ? 'API real' : `Nota ${group.averageRating.toFixed(1).replace('.', ',')}`}</span>
                <span className="text-right">{group.channels.length} canais</span>
              </div>
            </article>
          ))}
          {groups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary p-5 text-sm leading-6 text-muted-foreground xl:col-span-4">
              Nenhum grupo foi criado ainda. Eles aparecerao conforme GLPI, Teams ou BLiP enviarem tickets e canais reais.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function LgpdTab({
  aiConsentRequired,
  maskSensitiveData,
  settings,
  onToggleAiConsent,
  onToggleMask,
}: {
  aiConsentRequired: boolean;
  maskSensitiveData: boolean;
  settings?: SettingsOverview;
  onToggleAiConsent: () => void;
  onToggleMask: () => void;
}) {
  const lgpd = settings?.lgpd;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <section className="rounded-lg border border-border bg-card p-5 shadow-panel">
        <SectionTitle icon={ClipboardCheck} title="LGPD operacional" description="Controles que precisam existir antes de producao em cliente real." />
        <div className="mt-5 space-y-3">
          <ComplianceRow title="Finalidade" description={lgpd?.purpose ?? 'BI, auditoria, qualidade e inteligencia de atendimento.'} status="Configurado" />
          <ComplianceRow
            title="Minimizacao"
            description="Coletar somente dados necessarios para historico e indicadores."
            status={lgpd?.dataMinimization ? 'Configurado' : 'Pendente backend'}
          />
          <ComplianceRow title="Direito do titular" description="Preparar busca, exportacao e anonimizacao por contato." status="Planejado" />
          <ComplianceRow title="Auditoria" description="Registrar quem acessou configuracoes, conversas e exports." status="Configurado" />
          <ComplianceRow title="Retencao" description="Politica por tenant com prazo configuravel." status="Configurado" />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-panel">
        <SectionTitle icon={EyeOff} title="Privacidade e IA futura" description="IA ainda nao executa no MVP, mas a configuracao ja deixa as regras claras." />
        <div className="mt-5 grid gap-3">
          <ToggleRow
            icon={EyeOff}
            label="Mascarar dados sensiveis"
            description="Telefone e identificadores podem ser exibidos de forma reduzida para perfis restritos."
            checked={maskSensitiveData}
            onToggle={onToggleMask}
          />
          <ToggleRow
            icon={ShieldCheck}
            label="Exigir consentimento para IA"
            description="Analises futuras devem respeitar politica do tenant e base legal definida."
            checked={aiConsentRequired}
            onToggle={onToggleAiConsent}
          />
          <ToggleRow icon={Database} label="Nao treinar modelo com dados do cliente" description="Politica esperada para ambiente corporativo." checked locked />
        </div>

        <div className="mt-5 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="font-semibold text-card-foreground">Antes de producao</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Definir contrato de retencao, politica de mascaramento por perfil, fluxo de exclusao/anonimizacao e trilha de auditoria de exportacoes.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function mapApiUser(user: SettingsOverview['users'][number]): MockUserRow {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    area: user.area,
    status: user.status === 'ACTIVE' ? 'Ativo' : user.status === 'INVITED' ? 'Convidado' : 'Bloqueado',
    lastAccess: user.lastAccess,
  };
}
