'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Lightbulb,
  MessageCircle,
  ShoppingCart,
  Star,
  TicketCheck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardShell } from '@/components/dashboard-shell';
import { MetricCard } from '@/components/metric-card';
import {
  agentPerformance,
  conversations,
  dashboardMetrics,
  hourlyTicketVolume,
  improvementSuggestions,
  qualitySignals,
  qualitySummary,
  queueAttentionData,
  recurringTopics,
  resolutionFunnel,
  type MetricIconKey,
} from '@/lib/mock-dashboard';

const qualitySignalStyles = {
  danger: 'border-rose-100 bg-rose-50',
  warning: 'border-amber-100 bg-amber-50',
  neutral: 'border-zinc-100 bg-zinc-50',
};

const metricIcons = {
  tickets: TicketCheck,
  clock: Clock3,
  star: Star,
  alert: AlertTriangle,
  message: MessageCircle,
  sale: ShoppingCart,
} satisfies Record<MetricIconKey, typeof TicketCheck>;

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Nota media ${rating} de 5`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < Math.round(rating);

        return (
          <Star
            key={index}
            className="h-6 w-6 text-amber-500"
            fill={filled ? '#f59e0b' : 'none'}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

export default function Home() {
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  return (
    <DashboardShell>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {dashboardMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} icon={metricIcons[metric.icon]} />
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-lg border border-border bg-white p-4 shadow-panel">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-normal text-zinc-950">Volume por hora</h2>
              <p className="text-sm text-zinc-500">Atendimentos iniciados no dia</p>
            </div>
          </div>
          <div className="h-72 w-full">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={hourlyTicketVolume} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="tickets" stroke="#0f766e" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full rounded-md bg-zinc-100" />
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-white p-4 shadow-panel">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-normal text-zinc-950">Filas em atencao</h2>
            <p className="text-sm text-zinc-500">Abertos e espera media</p>
          </div>
          <div className="h-72 w-full">
            {chartsReady ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={queueAttentionData} layout="vertical" margin={{ left: 12, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={78} />
                  <Tooltip />
                  <Bar dataKey="abertos" fill="#b45309" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full rounded-md bg-zinc-100" />
            )}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-lg border border-border bg-white shadow-panel">
        <div className="grid gap-5 p-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-normal text-zinc-950">Qualidade por estrelas</h2>
                <p className="text-sm text-zinc-600">{qualitySummary.totalRated} avaliacoes recebidas no periodo</p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-white">
                <Star className="h-5 w-5 text-amber-500" fill="#f59e0b" aria-hidden="true" />
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-semibold tracking-normal text-zinc-950">
                    {String(qualitySummary.averageRating).replace('.', ',')}
                  </span>
                  <span className="text-sm font-medium text-zinc-600">de 5</span>
                </div>
                <div className="mt-3">
                  <RatingStars rating={qualitySummary.averageRating} />
                </div>
              </div>
              <div className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-700">
                {qualitySummary.aiConfidence}% de confianca nos sinais analisados
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {qualitySignals.map((signal) => (
                <div key={signal.label} className={`rounded-md border p-3 ${qualitySignalStyles[signal.tone]}`}>
                  <p className="text-xs font-medium uppercase text-zinc-500">{signal.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950">{signal.value}</p>
                  <p className="mt-1 text-xs text-zinc-500">{signal.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-normal text-zinc-950">Risco operacional</h2>
                  <p className="text-sm text-zinc-500">Casos que merecem revisao</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-rose-600" aria-hidden="true" />
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-md bg-rose-50 px-3 py-2">
                  <span className="text-sm font-medium text-zinc-700">Nota baixa sem contato posterior</span>
                  <span className="text-sm font-semibold text-rose-700">7</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md bg-amber-50 px-3 py-2">
                  <span className="text-sm font-medium text-zinc-700">Cliente pediu humano 3x</span>
                  <span className="text-sm font-semibold text-amber-700">9</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2">
                  <span className="text-sm font-medium text-zinc-700">Conversa fechada sem tag</span>
                  <span className="text-sm font-semibold text-zinc-700">18</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-normal text-zinc-950">Melhorias sugeridas por IA</h2>
                  <p className="text-sm text-zinc-600">Fila de ideias para auditoria e gestao</p>
                </div>
                <BrainCircuit className="h-5 w-5 text-teal-700" aria-hidden="true" />
              </div>
              <ul className="mt-4 space-y-3">
                {improvementSuggestions.map((suggestion) => (
                  <li key={suggestion} className="flex gap-3 rounded-md border border-teal-100 bg-white p-3">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
                    <span className="text-sm text-zinc-700">{suggestion}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center gap-2 text-sm font-medium text-teal-800">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Sugestoes prontas para validacao da qualidade
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="rounded-lg border border-border bg-white p-4 shadow-panel">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-normal text-zinc-950">Atendentes</h2>
            <p className="text-sm text-zinc-500">Produtividade e resolucao</p>
          </div>
          <div className="space-y-3">
            {agentPerformance.map((agent) => (
              <div key={agent.name} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-zinc-950">{agent.name}</p>
                    <p className="text-sm text-zinc-500">{agent.queue}</p>
                  </div>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-sm font-semibold text-emerald-700">
                    {agent.rating.toString().replace('.', ',')}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-zinc-600">
                  <span>{agent.tickets} tickets</span>
                  <span>{agent.resolutionRate}% resolucao</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-100">
                  <div className="h-2 rounded-full bg-teal-700" style={{ width: `${agent.resolutionRate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-white p-4 shadow-panel">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-normal text-zinc-950">Assuntos recorrentes</h2>
            <p className="text-sm text-zinc-500">Temas mais citados nas conversas</p>
          </div>
          <div className="space-y-3">
            {recurringTopics.map((topic) => (
              <div key={topic.label}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-zinc-700">{topic.label}</span>
                  <span className="text-zinc-500">{topic.count}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-100">
                  <div className="h-2 rounded-full bg-amber-600" style={{ width: `${topic.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-white p-4 shadow-panel">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-normal text-zinc-950">Funil de resolucao</h2>
            <p className="text-sm text-zinc-500">Caminho dos atendimentos</p>
          </div>
          <div className="space-y-3">
            {resolutionFunnel.map((step) => (
              <div key={step.label} className="rounded-md bg-zinc-50 px-3 py-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-zinc-700">{step.label}</span>
                  <span className="font-semibold text-zinc-950">{step.value}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white">
                  <div className="h-2 rounded-full bg-zinc-800" style={{ width: `${step.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-lg border border-border bg-white shadow-panel">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold tracking-normal text-zinc-950">Conversas recentes</h2>
          <p className="text-sm text-zinc-500">Ultimos atendimentos com sinais operacionais</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Ticket</th>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Fila</th>
                <th className="px-4 py-3 font-semibold">Atendente</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Sinal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {conversations.map((conversation) => (
                <tr key={conversation.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-950">{conversation.id}</td>
                  <td className="px-4 py-3 text-zinc-700">{conversation.customer}</td>
                  <td className="px-4 py-3 text-zinc-700">{conversation.queue}</td>
                  <td className="px-4 py-3 text-zinc-700">{conversation.agent}</td>
                  <td className="px-4 py-3 text-zinc-700">{conversation.status}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700">
                      {conversation.signal}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
