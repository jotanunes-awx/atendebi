'use client';

import { LifeBuoy, MessageSquareText, Phone, PhoneMissed, PhoneOutgoing, Timer } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import type { GlpiBacklogItem, ProviderSummary, TeamsPhoneStats } from '@/lib/mock-dashboard';

const providerStyles: Record<string, { icon: typeof Phone; accent: string }> = {
  BLIP: { icon: MessageSquareText, accent: 'bg-sky-500/15 text-sky-600 dark:text-sky-300' },
  GLPI: { icon: LifeBuoy, accent: 'bg-violet-500/15 text-violet-600 dark:text-violet-300' },
  TEAMS_PHONE: { icon: Phone, accent: 'bg-orange-500/15 text-orange-600 dark:text-orange-300' },
};

const saoPauloHourFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  hour12: false,
});

/** Mesma regra de hora usada pela API (fuso de Sao Paulo, formato HHh). */
export function saoPauloHourLabel(openedAt: string) {
  const formatted = saoPauloHourFormatter.format(new Date(openedAt)).padStart(2, '0');

  return `${formatted === '24' ? '00' : formatted}h`;
}

type OriginsSectionProps = {
  summaries: ProviderSummary[];
  teams: TeamsPhoneStats;
  glpiBacklog: GlpiBacklogItem[];
  chartsReady: boolean;
  isDark: boolean;
  activeProvider: string;
  onProviderClick: (provider: string) => void;
  onTeamsHourClick: (hour: string) => void;
  onGlpiCategoryClick: (category: string) => void;
};

export function OriginsSection({
  summaries,
  teams,
  glpiBacklog,
  chartsReady,
  isDark,
  activeProvider,
  onProviderClick,
  onTeamsHourClick,
  onGlpiCategoryClick,
}: OriginsSectionProps) {
  if (summaries.length === 0) {
    return null;
  }

  const showTeams = teams.totalCalls > 0;
  const showGlpi = glpiBacklog.length > 0;
  const maxGlpiOpen = Math.max(...glpiBacklog.map((item) => item.open), 1);

  return (
    <section className="mt-5 rounded-lg border border-border bg-card p-4 shadow-panel">
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-normal text-card-foreground">Origens dos dados</h2>
        <p className="text-sm text-muted-foreground">
          BLiP, GLPI e Teams Phone lado a lado. Toque em uma origem para filtrar todo o dashboard.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {summaries.map((summary) => {
          const style = providerStyles[summary.provider] ?? providerStyles.BLIP;
          const isActive = activeProvider === summary.provider;

          return (
            <button
              key={summary.provider}
              type="button"
              onClick={() => onProviderClick(summary.provider)}
              aria-pressed={isActive}
              className={cn(
                'rounded-lg border border-border bg-secondary p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive && 'border-primary/50 bg-primary/10 ring-1 ring-primary/40',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-md', style.accent)}>
                  <style.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-2xl font-semibold text-card-foreground">{summary.total}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-card-foreground">{summary.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{summary.detail}</p>
              <p className="mt-2 text-xs font-semibold text-primary">{isActive ? 'Filtrando · clique para limpar' : 'Filtrar por esta origem'}</p>
            </button>
          );
        })}
      </div>

      {showTeams || showGlpi ? (
        <div className={cn('mt-4 grid gap-4', showTeams && showGlpi && 'xl:grid-cols-2')}>
          {showTeams ? (
            <article className="rounded-lg border border-border bg-secondary p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground">Telefonia Teams por hora</h3>
                  <p className="text-xs text-muted-foreground">Clique em uma barra para abrir as chamadas daquele horario.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-card-foreground">
                    <PhoneOutgoing className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                    {teams.answered} atendidas
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-card-foreground">
                    <PhoneMissed className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                    {teams.missed} perdidas ({teams.missedRate}%)
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-card-foreground">
                    <Timer className="h-3.5 w-3.5 text-info" aria-hidden="true" />
                    media {String(teams.averageMinutes).replace('.', ',')} min
                  </span>
                </div>
              </div>
              <div className="h-56 w-full">
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height={224} minWidth={0}>
                    <BarChart
                      data={teams.hourly}
                      margin={{ left: -22, right: 4, top: 8, bottom: 0 }}
                      onClick={(state) => {
                        if (state && typeof state.activeLabel === 'string') {
                          onTeamsHourClick(state.activeLabel);
                        }
                      }}
                    >
                      <CartesianGrid stroke={isDark ? 'rgba(148, 163, 184, 0.25)' : '#e4e4e7'} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fill: isDark ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: isDark ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                      <Tooltip
                        cursor={{ fill: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.05)' }}
                        wrapperStyle={{ outline: 'none' }}
                        contentStyle={{
                          backgroundColor: isDark ? '#0f172a' : '#ffffff',
                          borderColor: isDark ? '#334155' : '#e2e8f0',
                          color: isDark ? '#f8fafc' : '#0f172a',
                        }}
                        labelStyle={{ color: isDark ? '#94a3b8' : '#475569' }}
                        formatter={(value, name) => [`${Number(value ?? 0)} chamadas`, name === 'atendidas' ? 'Atendidas' : 'Perdidas']}
                      />
                      <Bar dataKey="atendidas" stackId="calls" fill={isDark ? '#38bdf8' : '#0ea5e9'} radius={[0, 0, 0, 0]} cursor="pointer" />
                      <Bar dataKey="perdidas" stackId="calls" fill={isDark ? '#fb7185' : '#f43f5e'} radius={[4, 4, 0, 0]} cursor="pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full animate-pulse rounded-md bg-muted" />
                )}
              </div>
            </article>
          ) : null}

          {showGlpi ? (
            <article className="rounded-lg border border-border bg-secondary p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-card-foreground">Backlog GLPI por categoria</h3>
                <p className="text-xs text-muted-foreground">Chamados em aberto por tipo. Clique para auditar a categoria.</p>
              </div>
              <div className="max-h-56 space-y-2 overflow-auto pr-1">
                {glpiBacklog.map((item) => {
                  const width = Math.max((item.open / maxGlpiOpen) * 100, item.open > 0 ? 8 : 2);

                  return (
                    <button
                      key={item.category}
                      type="button"
                      onClick={() => onGlpiCategoryClick(item.category)}
                      className="w-full rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-medium text-card-foreground">{item.category}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          <span className="font-semibold text-card-foreground">{item.open}</span> abertos · {item.total} no recorte
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-[linear-gradient(90deg,#8b5cf6,#6366f1)]"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </article>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
