'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardShell } from '@/components/dashboard-shell';
import { getQueues, type QueueItem } from '@/lib/api-client';

export default function FilasPage() {
  const queuesQuery = useQuery({
    queryKey: ['queues'],
    queryFn: getQueues,
  });

  const queues = queuesQuery.data?.data ?? [] as QueueItem[];

  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-white p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-zinc-950">Filas</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Monitoramento de filas com tickets abertos e tempo de espera medio.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {queues.length > 0 ? (
            queues.map((queue) => (
              <div key={queue.id} className="rounded-3xl border border-border bg-white p-5 shadow-panel">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">{queue.name}</p>
                <p className="mt-3 text-3xl font-semibold text-zinc-950">{queue.openTickets}</p>
                <p className="mt-1 text-sm text-zinc-500">Tickets abertos</p>
                <div className="mt-4 rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                  Espera media de <span className="font-semibold text-zinc-950">{queue.averageWaitMinutes} min</span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-border bg-white p-6 text-sm text-zinc-600 shadow-panel">
              {queuesQuery.isFetching ? 'Carregando filas...' : 'Nao foi possivel carregar as filas.'}
            </div>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
