import { DashboardShell } from '@/components/dashboard-shell';
import { conversations } from '@/lib/mock-dashboard';

export default function ConversasPage() {
  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-card-foreground">Conversas</h2>
          <p className="mt-2 text-sm text-muted-foreground">Historico de tickets e conversas atendidas.</p>
        </div>

        <div className="space-y-4">
          {conversations.map((conversation) => (
            <div key={conversation.id} className="rounded-3xl border border-border bg-card p-5 shadow-panel">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ticket</p>
                  <p className="mt-1 text-lg font-semibold text-card-foreground">{conversation.id}</p>
                </div>
                <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {conversation.status}
                </span>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cliente</p>
                  <p className="mt-1 text-sm text-card-foreground">{conversation.customer}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Fila</p>
                  <p className="mt-1 text-sm text-card-foreground">{conversation.queue}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Atendente</p>
                  <p className="mt-1 text-sm text-card-foreground">{conversation.agent}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
