'use client';

import { Bell, Copy, Database, KeyRound, PlugZap, ShieldCheck, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { Button } from '@/components/ui/button';
import { demoIntegrationStatus } from '@/lib/demo-data';
import { useAuth } from '@/lib/auth';

const roles = [
  'ATENDEBI_ADMIN',
  'ATENDEBI_DIRETORIA',
  'ATENDEBI_GESTOR',
  'ATENDEBI_QUALIDADE',
  'ATENDEBI_COMERCIAL',
  'ATENDEBI_ATENDENTE',
];

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);

  async function copyValue(label: string, value: string) {
    await navigator.clipboard?.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 shadow-panel">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Administracao</p>
          <h2 className="mt-3 text-2xl font-semibold text-card-foreground">Configuracoes</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Esta tela ainda usa configuracoes mockadas, mas ja mostra o que um cliente corporativo espera configurar: tenant, integracao, seguranca, perfis, retencao e LGPD.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-lg border border-border bg-card p-5 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-card-foreground">Tenant atual</h3>
                <p className="text-sm text-muted-foreground">Ambiente conectado ao usuario logado.</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="mt-5 grid gap-3 text-sm">
              <ConfigRow label="Empresa" value={user?.tenant ?? demoIntegrationStatus.tenant} />
              <ConfigRow label="Usuario" value={user?.name ?? 'Daniel Fernando'} />
              <ConfigRow label="E-mail" value={user?.email ?? 'daniel.fernando@jotanunes.com'} />
              <ConfigRow label="Perfil" value={user?.role ?? 'ATENDEBI_ADMIN'} />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-card-foreground">Integracao BLiP</h3>
                <p className="text-sm text-muted-foreground">Status e endpoint para recebimento dos eventos.</p>
              </div>
              <PlugZap className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
              <ConfigRow label="Provider" value={demoIntegrationStatus.provider} />
              <ConfigRow label="Nome" value={demoIntegrationStatus.name} />
              <ConfigRow label="Status" value={demoIntegrationStatus.status} tone="success" />
              <ConfigRow label="Ultima sync" value={new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(demoIntegrationStatus.lastSyncAt))} />
            </div>
            <div className="mt-5 rounded-md border border-border bg-secondary p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Webhook URL</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <code className="break-all text-sm text-card-foreground">{demoIntegrationStatus.webhookUrl}</code>
                <Button variant="outline" type="button" onClick={() => copyValue('webhook', demoIntegrationStatus.webhookUrl)}>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {copied === 'webhook' ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <ConfigPanel
            icon={KeyRound}
            title="Seguranca"
            description="Mock atual preparado para Entra ID."
            rows={[
              ['Login', 'Microsoft Entra ID futuro'],
              ['Sessao local', 'localStorage'],
              ['Webhook secret', 'Opcional no ambiente local'],
              ['Frontend', 'Sem token BLiP exposto'],
            ]}
          />
          <ConfigPanel
            icon={UsersRound}
            title="Usuarios e perfis"
            description="Perfis previstos para controle de permissao."
            rows={roles.map((role) => [role.replace('ATENDEBI_', ''), role])}
          />
          <ConfigPanel
            icon={Database}
            title="LGPD e retencao"
            description="Politicas esperadas para produto SaaS."
            rows={[
              ['Retencao', `${demoIntegrationStatus.retentionDays} dias`],
              ['Auditoria', 'audit_logs por tenant'],
              ['Dados sensiveis', 'Minimizacao e mascaramento futuro'],
              ['IA prevista', demoIntegrationStatus.aiEstimatedCost],
            ]}
          />
        </div>

        <section className="rounded-lg border border-warning/30 bg-warning/10 p-5 shadow-panel">
          <div className="flex gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-card-foreground">Avisos para proximas etapas</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Ainda falta tela funcional para cadastrar usuarios, editar integracao e testar secret do webhook. Por enquanto esta pagina deixa a experiencia do produto clara e preparada para backend real.
              </p>
            </div>
          </div>
        </section>
      </section>
    </DashboardShell>
  );
}

function ConfigRow({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <div className="rounded-md border border-border bg-secondary px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={tone === 'success' ? 'mt-1 font-semibold text-success' : 'mt-1 font-semibold text-card-foreground'}>{value}</p>
    </div>
  );
}

function ConfigPanel({
  icon: Icon,
  title,
  description,
  rows,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  rows: string[][];
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>
      <div className="mt-5 space-y-2">
        {rows.map(([label, value]) => (
          <div key={`${label}-${value}`} className="flex items-center justify-between gap-3 rounded-md bg-secondary px-3 py-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium text-card-foreground">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
