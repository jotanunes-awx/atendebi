import { DashboardShell } from '@/components/dashboard-shell';
import { qualitySignals, qualitySummary, improvementSuggestions } from '@/lib/mock-dashboard';

export default function QualidadePage() {
  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-white p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-zinc-950">Qualidade</h2>
          <p className="mt-2 text-sm text-zinc-500">Painel de qualidade com avaliacao, sinais e sugestões.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.75fr_0.95fr]">
          <div className="rounded-3xl border border-border bg-white p-6 shadow-panel">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Nota media</p>
            <p className="mt-4 text-5xl font-semibold text-zinc-950">{String(qualitySummary.averageRating).replace('.', ',')}</p>
            <p className="mt-2 text-sm text-zinc-500">{qualitySummary.totalRated} avaliacoes no periodo</p>
            <div className="mt-6 rounded-3xl bg-zinc-50 p-5 text-sm text-zinc-700">
              Confiança da análise de IA: <strong className="text-zinc-950">{qualitySummary.aiConfidence}%</strong>
            </div>
          </div>

          <div className="grid gap-4">
            {qualitySignals.map((signal) => (
              <div key={signal.label} className="rounded-3xl border border-border bg-white p-5 shadow-panel">
                <p className="text-sm font-medium text-zinc-500">{signal.label}</p>
                <p className="mt-3 text-3xl font-semibold text-zinc-950">{signal.value}</p>
                <p className="mt-2 text-sm text-zinc-500">{signal.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-white p-6 shadow-panel">
          <h3 className="text-lg font-semibold text-zinc-950">Sugestões de melhoria</h3>
          <ul className="mt-4 space-y-3 text-sm text-zinc-600">
            {improvementSuggestions.map((suggestion) => (
              <li key={suggestion} className="rounded-2xl bg-zinc-50 px-4 py-3">
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </DashboardShell>
  );
}
