'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardShell } from '@/components/dashboard-shell';
import { getAgents, type AgentItem } from '@/lib/api-client';

export default function AtendentesPage() {
  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: getAgents,
  });

  const agents = agentsQuery.data?.data ?? [] as AgentItem[];

  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-card-foreground">Atendentes</h2>
          <p className="mt-2 text-sm text-muted-foreground">Resumo de performance dos agentes no periodo.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.length > 0 ? (
            agents.map((agent) => (
              <article key={agent.id} className="rounded-3xl border border-border bg-card p-5 shadow-panel">
                <h3 className="text-lg font-semibold text-card-foreground">{agent.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">Fila: {agent.queue}</p>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <p>
                    Tickets: <span className="font-semibold text-card-foreground">{agent.ticketsHandled}</span>
                  </p>
                  <p>
                    Nota media: <span className="font-semibold text-card-foreground">{agent.averageRating.toFixed(1)}</span>
                  </p>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-panel">
              {agentsQuery.isFetching ? 'Carregando atendentes...' : 'Nao foi possivel carregar os atendentes.'}
            </div>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
