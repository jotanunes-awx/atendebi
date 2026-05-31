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
import { demoIntegrationStatus } from '@/lib/demo-data';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const tabs: Array<{ id: ConfigTab; label: string; icon: LucideIcon }> = [
  { id: 'integracao', label: 'Integracao BLiP', icon: PlugZap },
  { id: 'seguranca', label: 'Seguranca', icon: ShieldCheck },
  { id: 'perfis', label: 'Usuarios e perfis', icon: UsersRound },
  { id: 'retencao', label: 'Retencao', icon: Archive },
  { id: 'lgpd', label: 'LGPD', icon: ClipboardCheck },
];

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ConfigTab>('integracao');
  const [copied, setCopied] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok'>('idle');
  const [saved, setSaved] = useState(false);
  const [webhookSecretRequired, setWebhookSecretRequired] = useState(true);
  const [structuredAudit, setStructuredAudit] = useState(true);
  const [maskSensitiveData, setMaskSensitiveData] = useState(true);
  const [aiConsentRequired, setAiConsentRequired] = useState(true);
  const [retentionMonths, setRetentionMonths] = useState('24');

  const tenantName = user?.tenant ?? demoIntegrationStatus.tenant;
  const retentionDays = Number(retentionMonths) * 30;
  const estimatedStorage = useMemo(() => Math.round((retentionDays / 30) * 4.8), [retentionDays]);

  async function copyValue(label: string, value: string) {
    await navigator.clipboard?.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1500);
  }

  function testWebhook() {
    setTestStatus('testing');
    window.setTimeout(() => setTestStatus('ok'), 900);
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
                Centro de controle do tenant, integracao BLiP, webhook, retencao historica, seguranca, perfis e LGPD.
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

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <HealthCard icon={ShieldCheck} label="Tenant" value={tenantName} detail="local-tenant ativo" tone="success" />
            <HealthCard icon={PlugZap} label="BLiP" value={demoIntegrationStatus.status} detail="Eventos recebidos por webhook" tone="success" />
            <HealthCard icon={Archive} label="Historico" value={`${retentionMonths} meses`} detail="Banco proprio do AtendeBI" tone="info" />
            <HealthCard icon={LockKeyhole} label="Seguranca" value="Mock Entra ID" detail="Token BLiP fora do frontend" tone="warning" />
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
            testStatus={testStatus}
            webhookSecretRequired={webhookSecretRequired}
            onCopy={copyValue}
            onTestWebhook={testWebhook}
            onToggleSecret={() => setWebhookSecretRequired((value) => !value)}
          />
        ) : null}

        {activeTab === 'seguranca' ? (
          <SecurityTab
            structuredAudit={structuredAudit}
            maskSensitiveData={maskSensitiveData}
            onToggleAudit={() => setStructuredAudit((value) => !value)}
            onToggleMask={() => setMaskSensitiveData((value) => !value)}
          />
        ) : null}

        {activeTab === 'perfis' ? <ProfilesTab /> : null}

        {activeTab === 'retencao' ? (
          <RetentionTab
            retentionMonths={retentionMonths}
            retentionDays={retentionDays}
            estimatedStorage={estimatedStorage}
            onChangeRetention={setRetentionMonths}
          />
        ) : null}

        {activeTab === 'lgpd' ? (
          <LgpdTab
            aiConsentRequired={aiConsentRequired}
            maskSensitiveData={maskSensitiveData}
            onToggleAiConsent={() => setAiConsentRequired((value) => !value)}
            onToggleMask={() => setMaskSensitiveData((value) => !value)}
          />
        ) : null}
      </section>
    </DashboardShell>
  );
}
