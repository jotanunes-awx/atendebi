import { DashboardShell } from '@/components/dashboard-shell';
import { conversations } from '@/lib/mock-dashboard';

export default function ConversasPage() {
  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-white p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-zinc-950">Conversas</h2>
          <p className="mt-2 text-sm text-zinc-500">Historico de tickets e conversas atendidas.</p>
        </div>

        <div className="space-y-4">
          {conversations.map((conversation) => (
            <div key={conversation.id} className="rounded-3xl border border-border bg-white p-5 shadow-panel">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-500">Ticket</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-950">{conversation.id}</p>
                </div>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">
                  {conversation.status}
                </span>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Cliente</p>
                  <p className="mt-1 text-sm text-zinc-950">{conversation.customer}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Fila</p>
                  <p className="mt-1 text-sm text-zinc-950">{conversation.queue}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Atendente</p>
                  <p className="mt-1 text-sm text-zinc-950">{conversation.agent}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
