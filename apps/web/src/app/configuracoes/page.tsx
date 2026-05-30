import { DashboardShell } from '@/components/dashboard-shell';

export default function ConfiguracoesPage() {
  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-card-foreground">Configurações</h2>
          <p className="mt-2 text-sm text-muted-foreground">Ajustes do dashboard e dados do ambiente.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-panel">
            <h3 className="text-base font-semibold text-card-foreground">Ambiente</h3>
            <p className="mt-2 text-sm text-muted-foreground">Dados usados pelo frontend em modo local.</p>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>
                <span className="font-semibold text-card-foreground">API:</span> http://localhost:3333
              </p>
              <p>
                <span className="font-semibold text-card-foreground">Tenant:</span> local-tenant
              </p>
              <p>
                <span className="font-semibold text-card-foreground">Permissão:</span> ATENDEBI_ADMIN
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 shadow-panel">
            <h3 className="text-base font-semibold text-card-foreground">Status do frontend</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Essas configurações são apenas um mock para uso local e demonstram os endpoints disponiveis.
            </p>
            <div className="mt-4 rounded-3xl bg-secondary p-4 text-sm text-muted-foreground">
              <p>Use o arquivo <span className="font-semibold text-card-foreground">apps/web/.env.local</span> para personalizar a URL da API.</p>
            </div>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
