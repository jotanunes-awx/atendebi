'use client';

import {
  Archive,
  ClipboardCheck,
  Copy,
  LockKeyhole,
  PlugZap,
  Save,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { Button } from '@/components/ui/button';
import { HealthCard } from '@/features/settings/settings-components';
import type { ConfigTab } from '@/features/settings/settings-data';
import {
  IntegrationTab,
  LgpdTab,
  ProfilesTab,
  RetentionTab,
  SecurityTab,
} from '@/features/settings/settings-tabs';
import { useAuth } from '@/lib/auth';
import {
  getSettingsOverview,
  syncIntegration,
  testIntegration,
  type IntegrationProvider,
  type IntegrationSyncResult,
  type IntegrationTestResult,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';

const tabs: Array<{ id: ConfigTab; label: string; icon: LucideIcon }> = [
  { id: 'integracao', label: 'Integracoes', icon: PlugZap },
  { id: 'seguranca', label: 'Seguranca', icon: ShieldCheck },
  { id: 'perfis', label: 'Usuarios e perfis', icon: UsersRound },
  { id: 'retencao', label: 'Retencao', icon: Archive },
  { id: 'lgpd', label: 'LGPD', icon: ClipboardCheck },
];

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ConfigTab>('integracao');
  const [copied, setCopied] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<IntegrationProvider | null>(null);
  const [syncingProvider, setSyncingProvider] = useState<IntegrationProvider | null>(null);
  const [integrationResults, setIntegrationResults] = useState<Record<string, IntegrationTestResult | IntegrationSyncResult>>({});
  const [saved, setSaved] = useState(false);
  const [webhookSecretRequired, setWebhookSecretRequired] = useState(true);
  const [structuredAudit, setStructuredAudit] = useState(true);
  const [maskSensitiveData, setMaskSensitiveData] = useState(true);
  const [aiConsentRequired, setAiConsentRequired] = useState(true);
  const [retentionMonths, setRetentionMonths] = useState('24');
  const settingsQuery = useQuery({
    queryKey: ['settings-overview'],
    queryFn: getSettingsOverview,
  });

  const settings = settingsQuery.data;
  const tenantName = settings?.tenant?.name ?? user?.tenant ?? 'Tenant nao carregado';
  const integrations = settings?.integrations ?? [];
  const blipIntegration = integrations.find((integration) => integration.provider === 'BLIP');
  const glpiIntegration = integrations.find((integration) => integration.provider === 'GLPI');
  const teamsIntegration = integrations.find((integration) => integration.provider === 'TEAMS_PHONE');
  const retentionDays = Number(retentionMonths) * 30;
  const estimatedStorage = useMemo(() => Math.round((retentionDays / 30) * 4.8), [retentionDays]);

  async function copyValue(label: string, value: string) {
    await navigator.clipboard?.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1500);
  }

  async function handleTestIntegration(provider: IntegrationProvider) {
    try {
      setTestingProvider(provider);
      const result = await testIntegration(provider);
      setIntegrationResults((current) => ({ ...current, [provider]: result }));
    } catch (error) {
      setIntegrationResults((current) => ({
        ...current,
        [provider]: {
          provider,
          checkedAt: new Date().toISOString(),
          ok: false,
          status: 'api_error',
          message: error instanceof Error ? error.message : 'Nao foi possivel testar a integracao.',
          details: [],
        },
      }));
    } finally {
      setTestingProvider(null);
    }
  }

  async function handleSyncIntegration(provider: IntegrationProvider) {
    try {
      setSyncingProvider(provider);
      const result = await syncIntegration(provider);
      setIntegrationResults((current) => ({ ...current, [provider]: result }));
      await settingsQuery.refetch();
    } catch (error) {
      setIntegrationResults((current) => ({
        ...current,
        [provider]: {
          provider,
          accepted: false,
          status: 'api_error',
          message: error instanceof Error ? error.message : 'Nao foi possivel registrar o sync dry-run.',
        },
      }));
    } finally {
      setSyncingProvider(null);
    }
  }

  function saveSettings() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 shadow-panel">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Administracao</p>
              <h2 className="mt-3 text-2xl font-semibold text-card-foreground">Configuracoes</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Centro de controle do tenant, integracoes BLiP, GLPI e Teams/PABX, webhook, retencao historica, seguranca, perfis e LGPD.
              </p>
              <p className="mt-4 text-xs font-semibold text-primary">
                Fonte: {settingsQuery.isError ? 'API indisponivel' : settings ? 'Conectado a API real' : 'Carregando API'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" type="button" onClick={() => copyValue('tenant-key', 'local-tenant')}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                {copied === 'tenant-key' ? 'Tenant copiado' : 'Copiar tenant key'}
              </Button>
              <Button type="button" onClick={saveSettings}>
                <Save className="h-4 w-4" aria-hidden="true" />
                {saved ? 'Salvo' : 'Salvar mockado'}
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <HealthCard icon={ShieldCheck} label="Tenant" value={tenantName} detail="local-tenant ativo" tone="success" />
            <HealthCard
              icon={PlugZap}
              label="BLiP"
              value={blipIntegration?.statusLabel ?? settings?.integration?.status ?? 'Sem configuracao'}
              detail="Eventos recebidos por webhook"
              tone={blipIntegration?.configured === false ? 'warning' : 'success'}
            />
            <HealthCard
              icon={Archive}
              label="GLPI"
              value={glpiIntegration?.statusLabel ?? 'Pendente configuracao'}
              detail="Chamados, SLA e backlog"
              tone={glpiIntegration?.configured ? 'success' : 'warning'}
            />
            <HealthCard icon={Archive} label="Historico" value={settings?.retention?.retentionPolicy ?? `${retentionMonths} meses`} detail="Banco proprio do AtendeBI" tone="info" />
            <HealthCard
              icon={LockKeyhole}
              label="Teams/PABX"
              value={teamsIntegration?.statusLabel ?? 'Pendente configuracao'}
              detail="Graph Call Records"
              tone={teamsIntegration?.configured ? 'success' : 'warning'}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-2 shadow-panel">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(
                    'flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                    active && 'bg-primary/10 text-primary',
                  )}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'integracao' ? (
          <IntegrationTab
            copied={copied}
            webhookSecretRequired={settings?.integration?.webhookSecretRequired ?? webhookSecretRequired}
            settings={settings}
            testingProvider={testingProvider}
            syncingProvider={syncingProvider}
            integrationResults={integrationResults}
            onCopy={copyValue}
            onTestIntegration={handleTestIntegration}
            onSyncIntegration={handleSyncIntegration}
            onToggleSecret={() => setWebhookSecretRequired((value) => !value)}
          />
        ) : null}

        {activeTab === 'seguranca' ? (
          <SecurityTab
            structuredAudit={structuredAudit}
            maskSensitiveData={maskSensitiveData}
            settings={settings}
            onToggleAudit={() => setStructuredAudit((value) => !value)}
            onToggleMask={() => setMaskSensitiveData((value) => !value)}
          />
        ) : null}

        {activeTab === 'perfis' ? <ProfilesTab settings={settings} /> : null}

        {activeTab === 'retencao' ? (
          <RetentionTab
            retentionMonths={retentionMonths}
            retentionDays={retentionDays}
            estimatedStorage={estimatedStorage}
            settings={settings}
            onChangeRetention={setRetentionMonths}
          />
        ) : null}

        {activeTab === 'lgpd' ? (
          <LgpdTab
            aiConsentRequired={aiConsentRequired}
            maskSensitiveData={maskSensitiveData}
            settings={settings}
            onToggleAiConsent={() => setAiConsentRequired((value) => !value)}
            onToggleMask={() => setMaskSensitiveData((value) => !value)}
          />
        ) : null}
      </section>
    </DashboardShell>
  );
}
