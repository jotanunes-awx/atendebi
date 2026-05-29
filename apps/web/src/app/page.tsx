'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Clock3,
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

const metrics = [
  {
    label: 'Atendimentos',
    value: '186',
    detail: '42 ainda abertos',
    tone: 'neutral' as const,
    icon: TicketCheck,
  },
  {
    label: 'Tempo medio',
    value: '6,4 min',
    detail: 'Primeira resposta',
    tone: 'good' as const,
    icon: Clock3,
  },
  {
    label: 'Nota media',
    value: '4,3',
    detail: 'Baseada nas avaliacoes',
    tone: 'good' as const,
    icon: Star,
  },
  {
    label: 'Reclamacoes',
    value: '9',
    detail: 'Prioridade para qualidade',
    tone: 'danger' as const,
    icon: AlertTriangle,
  },
  {
    label: 'Fallback do bot',
    value: '12,8%',
    detail: 'Conversas transferidas',
    tone: 'warning' as const,
    icon: MessageCircle,
  },
  {
    label: 'Oportunidades',
    value: '27',
    detail: 'Sinais comerciais',
    tone: 'neutral' as const,
    icon: ShoppingCart,
  },
];

const queueData = [
  { name: 'Suporte', abertos: 18, espera: 7.2 },
  { name: 'Comercial', abertos: 11, espera: 4.1 },
  { name: 'Financeiro', abertos: 13, espera: 9.8 },
  { name: 'Retencao', abertos: 7, espera: 5.6 },
];

const hourlyData = [
  { hour: '08h', tickets: 12 },
  { hour: '10h', tickets: 24 },
  { hour: '12h', tickets: 31 },
  { hour: '14h', tickets: 28 },
  { hour: '16h', tickets: 36 },
  { hour: '18h', tickets: 22 },
];

const conversations = [
  {
    id: 'ticket-1001',
    customer: 'Marina Costa',
    queue: 'Suporte',
    agent: 'Ana Lima',
    status: 'Aberto',
    signal: 'Entrega',
  },
  {
    id: 'ticket-1002',
    customer: 'Joao Pereira',
    queue: 'Financeiro',
    agent: 'Carlos Souza',
    status: 'Pendente',
    signal: 'Nota baixa',
  },
  {
    id: 'ticket-1003',
    customer: 'Patricia Nunes',
    queue: 'Comercial',
    agent: 'Beatriz Rocha',
    status: 'Fechado',
    signal: 'Venda',
  },
];

export default function Home() {
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  return (
    <DashboardShell>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
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
                <LineChart data={hourlyData} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
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
                <BarChart data={queueData} layout="vertical" margin={{ left: 12, right: 8, top: 8, bottom: 0 }}>
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
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold tracking-normal text-zinc-950">Conversas recentes</h2>
          <p className="text-sm text-zinc-500">Amostra mockada para validar o layout inicial</p>
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
