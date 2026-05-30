import { DashboardShell } from '@/components/dashboard-shell';
import { qualitySignals, qualitySummary, improvementSuggestions } from '@/lib/mock-dashboard';

export default function QualidadePage() {
  return (
    <DashboardShell>
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-card-foreground">Qualidade</h2>
          <p className="mt-2 text-sm text-muted-foreground">Painel de qualidade com avaliacao, sinais e sugestões.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.75fr_0.95fr]">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-panel">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Nota media</p>
            <p className="mt-4 text-5xl font-semibold text-card-foreground">{String(qualitySummary.averageRating).replace('.', ',')}</p>
            <p className="mt-2 text-sm text-muted-foreground">{qualitySummary.totalRated} avaliacoes no periodo</p>
            <div className="mt-6 rounded-3xl bg-secondary p-5 text-sm text-muted-foreground">
              Confiança da análise de IA: <strong className="text-card-foreground">{qualitySummary.aiConfidence}%</strong>
            </div>
          </div>

          <div className="grid gap-4">
            {qualitySignals.map((signal) => (
              <div key={signal.label} className="rounded-3xl border border-border bg-card p-5 shadow-panel">
                <p className="text-sm font-medium text-muted-foreground">{signal.label}</p>
                <p className="mt-3 text-3xl font-semibold text-card-foreground">{signal.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{signal.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-panel">
          <h3 className="text-lg font-semibold text-card-foreground">Sugestões de melhoria</h3>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            {improvementSuggestions.map((suggestion) => (
              <li key={suggestion} className="rounded-2xl bg-secondary px-4 py-3">
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </DashboardShell>
  );
}
