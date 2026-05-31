import type { ConversationMessage } from '@/lib/mock-conversation-history';

export type DemoTicketStatus = 'OPEN' | 'PENDING' | 'CLOSED' | 'CANCELED';
export type DemoSentiment = 'positivo' | 'neutro' | 'negativo';
export type DemoRisk = 'baixo' | 'medio' | 'alto';
export type DemoChannel = 'WhatsApp' | 'Webchat' | 'Instagram' | 'Facebook' | 'Email';

export type DemoTicket = {
  id: string;
  customerName: string;
  customerContact: string;
  queue: string;
  agent: string;
  status: DemoTicketStatus;
  resolutionStatus: string;
  rating: number;
  channel: DemoChannel;
  group: string;
  subject: string;
  signal: string;
  sentiment: DemoSentiment;
  risk: DemoRisk;
  openedAt: string;
  lastMessageAt: string;
  firstResponseMinutes: number;
  waitMinutes: number;
  tags: string[];
  summary: string;
  isComplaint: boolean;
  isOpportunity: boolean;
  botFallback: boolean;
  unresolved: boolean;
};

export type DemoQueueMetric = {
  id: string;
  name: string;
  openTickets: number;
  averageWaitMinutes: number;
  averageRating: number;
  riskTickets: number;
  owner: string;
};

export type DemoAgentMetric = {
  id: string;
  name: string;
  queue: string;
  ticketsHandled: number;
  openTickets: number;
  averageRating: number;
  resolutionRate: number;
  firstResponseMinutes: number;
  complaints: number;
};

type QueueSeed = {
  name: string;
  openTickets: number;
  averageWaitMinutes: number;
  owner: string;
  subjects: string[];
};

const queueSeeds: QueueSeed[] = [
  {
    name: 'Suporte',
    openTickets: 18,
    averageWaitMinutes: 7.2,
    owner: 'Ana Lima',
    subjects: ['Entrega atrasada', 'Troca de produto', 'Suporte tecnico', 'Pedido sem atualizacao'],
  },
  {
    name: 'Comercial',
    openTickets: 11,
    averageWaitMinutes: 4.1,
    owner: 'Beatriz Rocha',
    subjects: ['Proposta comercial', 'Plano para equipe', 'Negociacao', 'Condicoes de pagamento'],
  },
  {
    name: 'Financeiro',
    openTickets: 13,
    averageWaitMinutes: 9.8,
    owner: 'Carlos Souza',
    subjects: ['Segunda via de boleto', 'Boleto vencido', 'Pagamento nao identificado', 'Renegociacao'],
  },
  {
    name: 'Retencao',
    openTickets: 7,
    averageWaitMinutes: 5.6,
    owner: 'Rafael Martins',
    subjects: ['Cancelamento', 'Insatisfacao recorrente', 'Pedido de retorno', 'Reclamacao'],
  },
  {
    name: 'Pos-venda',
    openTickets: 5,
    averageWaitMinutes: 3.9,
    owner: 'Juliana Santos',
    subjects: ['Entrega concluida', 'Garantia', 'Acompanhamento', 'Pesquisa de satisfacao'],
  },
];

const agents = ['Ana Lima', 'Carlos Souza', 'Beatriz Rocha', 'Rafael Martins', 'Juliana Santos'];
const channels: DemoChannel[] = ['WhatsApp', 'Webchat', 'Instagram', 'Facebook', 'Email'];
const salesGroups = ['JotaVendas 1', 'JotaVendas 2', 'JotaVendas 3'];

function resolveGroup(queue: string, index: number) {
  if (queue === 'Comercial') {
    return salesGroups[index % salesGroups.length];
  }

  if (queue === 'Financeiro') {
    return index % 2 === 0 ? 'Financeiro Critico' : 'Financeiro Rotina';
  }

  if (queue === 'Retencao') {
    return 'Retencao VIP';
  }

  if (queue === 'Pos-venda') {
    return 'Pos-venda Digital';
  }

  return index % 2 === 0 ? 'Suporte Nivel 1' : 'Suporte Nivel 2';
}
const customers = [
  ['Marina Costa', '+55 11 98888-1001'],
  ['Joao Pereira', '+55 21 97777-1002'],
  ['Patricia Nunes', '+55 31 96666-1003'],
  ['Rafael Martins', '+55 41 95555-1004'],
  ['Camila Torres', '+55 11 94444-1005'],
  ['Eduardo Almeida', '+55 81 93333-1006'],
  ['Fernanda Lima', '+55 71 92222-1007'],
  ['Gustavo Rocha', '+55 85 91111-1008'],
  ['Helena Duarte', '+55 27 90000-1009'],
  ['Igor Batista', '+55 62 98888-1010'],
  ['Larissa Melo', '+55 48 97777-1011'],
  ['Marcelo Ribeiro', '+55 51 96666-1012'],
  ['Natalia Freitas', '+55 61 95555-1013'],
  ['Otavio Silveira', '+55 19 94444-1014'],
  ['Priscila Araujo', '+55 34 93333-1015'],
  ['Renato Lopes', '+55 98 92222-1016'],
  ['Sabrina Vieira', '+55 84 91111-1017'],
  ['Thiago Moreira', '+55 31 90000-1018'],
  ['Vanessa Ramos', '+55 21 98888-1019'],
  ['William Castro', '+55 47 97777-1020'],
] as const;

const tagBySubject: Record<string, string[]> = {
  'Entrega atrasada': ['entrega', 'reclamacao', 'risco'],
  'Troca de produto': ['suporte', 'entrega'],
  'Suporte tecnico': ['suporte'],
  'Pedido sem atualizacao': ['entrega', 'suporte'],
  'Proposta comercial': ['venda', 'proposta'],
  'Plano para equipe': ['venda', 'proposta'],
  Negociacao: ['venda'],
  'Condicoes de pagamento': ['venda', 'proposta'],
  'Segunda via de boleto': ['boleto', 'suporte'],
  'Boleto vencido': ['boleto', 'financeiro'],
  'Pagamento nao identificado': ['boleto', 'reclamacao'],
  Renegociacao: ['boleto', 'risco'],
  Cancelamento: ['cancelamento', 'reclamacao', 'risco'],
  'Insatisfacao recorrente': ['reclamacao', 'risco'],
  'Pedido de retorno': ['reclamacao'],
  Reclamacao: ['reclamacao', 'risco'],
  'Entrega concluida': ['entrega'],
  Garantia: ['suporte'],
  Acompanhamento: ['suporte'],
  'Pesquisa de satisfacao': ['suporte'],
};

function buildTickets() {
  const tickets: DemoTicket[] = [];
  let index = 1;

  for (const queue of queueSeeds) {
    for (let queueIndex = 0; queueIndex < queue.openTickets; queueIndex += 1) {
      const customer = customers[(index - 1) % customers.length];
      const subject = queue.subjects[queueIndex % queue.subjects.length];
      const agent = queue.name === 'Comercial' ? 'Beatriz Rocha' : queue.owner;
      const hour = 8 + (index % 11);
      const minute = (index * 7) % 55;
      const openedAt = `2026-05-30T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
      const firstResponseMinutes = queue.averageWaitMinutes + (queueIndex % 4) - 1;
      const waitMinutes = Math.max(2, Math.round(queue.averageWaitMinutes + (queueIndex % 5)));
      const complaint = tagBySubject[subject]?.includes('reclamacao') ?? false;
      const opportunity = tagBySubject[subject]?.includes('venda') ?? false;
      const botFallback = queueIndex % 5 === 0 || subject.includes('boleto') || subject.includes('Cancelamento');
      const unresolved = complaint || queueIndex % 6 === 0;
      const rating = complaint ? (queueIndex % 2 === 0 ? 1 : 2) : opportunity ? 5 : queueIndex % 4 === 0 ? 3 : 4;
      const risk: DemoRisk = complaint || waitMinutes >= 10 ? 'alto' : waitMinutes >= 7 ? 'medio' : 'baixo';
      const sentiment: DemoSentiment = rating <= 2 ? 'negativo' : rating >= 5 ? 'positivo' : 'neutro';
      const status: DemoTicketStatus = queueIndex % 5 === 0 ? 'PENDING' : 'OPEN';

      tickets.push({
        id: `ticket-demo-${String(index).padStart(3, '0')}`,
        customerName: customer[0],
        customerContact: customer[1],
        queue: queue.name,
        agent,
        status,
        resolutionStatus: unresolved ? 'Nao solucionado' : 'Em andamento',
        rating,
        channel: channels[index % channels.length],
        group: resolveGroup(queue.name, queueIndex),
        subject,
        signal: opportunity ? 'Venda' : complaint ? 'Reclamacao' : botFallback ? 'Bot' : 'Operacao',
        sentiment,
        risk,
        openedAt,
        lastMessageAt: `2026-05-30T${String(hour).padStart(2, '0')}:${String(Math.min(minute + waitMinutes, 59)).padStart(2, '0')}:00.000Z`,
        firstResponseMinutes,
        waitMinutes,
        tags: tagBySubject[subject] ?? ['suporte'],
        summary: buildTicketSummary(customer[0], subject, queue.name, risk),
        isComplaint: complaint,
        isOpportunity: opportunity,
        botFallback,
        unresolved,
      });

      index += 1;
    }
  }

  for (let closedIndex = 0; closedIndex < 18; closedIndex += 1) {
    const customer = customers[(index - 1) % customers.length];
    const queue = queueSeeds[closedIndex % queueSeeds.length];
    const subject = queue.subjects[closedIndex % queue.subjects.length];
    const opportunity = tagBySubject[subject]?.includes('venda') ?? false;

    tickets.push({
      id: `ticket-demo-${String(index).padStart(3, '0')}`,
      customerName: customer[0],
      customerContact: customer[1],
      queue: queue.name,
      agent: agents[closedIndex % agents.length],
      status: closedIndex % 9 === 0 ? 'CANCELED' : 'CLOSED',
      resolutionStatus: closedIndex % 9 === 0 ? 'Cancelado' : 'Resolvido',
      rating: opportunity ? 5 : closedIndex % 7 === 0 ? 2 : 4,
      channel: channels[closedIndex % channels.length],
      group: resolveGroup(queue.name, closedIndex),
      subject,
      signal: opportunity ? 'Venda' : 'Resolucao',
      sentiment: opportunity ? 'positivo' : closedIndex % 7 === 0 ? 'negativo' : 'neutro',
      risk: closedIndex % 7 === 0 ? 'alto' : 'baixo',
      openedAt: `2026-05-29T${String(8 + (closedIndex % 10)).padStart(2, '0')}:15:00.000Z`,
      lastMessageAt: `2026-05-29T${String(8 + (closedIndex % 10)).padStart(2, '0')}:48:00.000Z`,
      firstResponseMinutes: 4 + (closedIndex % 5),
      waitMinutes: 3 + (closedIndex % 7),
      tags: tagBySubject[subject] ?? ['suporte'],
      summary: buildTicketSummary(customer[0], subject, queue.name, closedIndex % 7 === 0 ? 'alto' : 'baixo'),
      isComplaint: closedIndex % 7 === 0,
      isOpportunity: opportunity,
      botFallback: closedIndex % 6 === 0,
      unresolved: closedIndex % 9 === 0,
    });

    index += 1;
  }

  return tickets;
}

function buildTicketSummary(customerName: string, subject: string, queue: string, risk: DemoRisk) {
  const riskText =
    risk === 'alto'
      ? 'Caso pede prioridade por risco de insatisfacao.'
      : risk === 'medio'
        ? 'Caso precisa acompanhamento para evitar atraso.'
        : 'Caso dentro do comportamento esperado.';

  return `${customerName} entrou em contato sobre ${subject.toLowerCase()} na fila ${queue}. ${riskText}`;
}

export const demoTickets = buildTickets();

export const demoQueueMetrics: DemoQueueMetric[] = queueSeeds.map((queue, index) => {
  const queueTickets = demoTickets.filter((ticket) => ticket.queue === queue.name);
  const openTickets = queueTickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING');
  const ratings = queueTickets.map((ticket) => ticket.rating);

  return {
    id: `queue-${index + 1}`,
    name: queue.name,
    openTickets: openTickets.length,
    averageWaitMinutes: queue.averageWaitMinutes,
    averageRating: average(ratings),
    riskTickets: queueTickets.filter((ticket) => ticket.risk === 'alto').length,
    owner: queue.owner,
  };
});

export const demoAgentMetrics: DemoAgentMetric[] = agents.map((agent, index) => {
  const agentTickets = demoTickets.filter((ticket) => ticket.agent === agent);
  const resolved = agentTickets.filter((ticket) => ticket.resolutionStatus === 'Resolvido').length;

  return {
    id: `agent-${index + 1}`,
    name: agent,
    queue: agentTickets[0]?.queue ?? 'Operacao',
    ticketsHandled: agentTickets.length,
    openTickets: agentTickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING').length,
    averageRating: average(agentTickets.map((ticket) => ticket.rating)),
    resolutionRate: Math.round((resolved / Math.max(agentTickets.length, 1)) * 100),
    firstResponseMinutes: average(agentTickets.map((ticket) => ticket.firstResponseMinutes)),
    complaints: agentTickets.filter((ticket) => ticket.isComplaint).length,
  };
});

export const demoOperationalRisks = [
  {
    label: 'Nota baixa sem contato posterior',
    count: demoTickets.filter((ticket) => ticket.rating <= 2).length,
    tickets: demoTickets.filter((ticket) => ticket.rating <= 2),
  },
  {
    label: 'Cliente pediu humano 3x',
    count: demoTickets.filter((ticket) => ticket.botFallback).length,
    tickets: demoTickets.filter((ticket) => ticket.botFallback),
  },
  {
    label: 'Conversa fechada sem solucao',
    count: demoTickets.filter((ticket) => ticket.unresolved).length,
    tickets: demoTickets.filter((ticket) => ticket.unresolved),
  },
];

export const demoQualityReasons = [
  { label: 'Demora no retorno', count: 18, risk: 'alto' as DemoRisk },
  { label: 'Bot nao entendeu boleto', count: 13, risk: 'medio' as DemoRisk },
  { label: 'Entrega sem previsao clara', count: 11, risk: 'medio' as DemoRisk },
  { label: 'Cancelamento por reincidencia', count: 7, risk: 'alto' as DemoRisk },
];

export const demoIntegrationStatus = {
  provider: 'BLiP',
  name: 'BLiP Demo',
  status: 'Conectado',
  lastSyncAt: '2026-05-30T18:42:00.000Z',
  webhookUrl: 'http://localhost:3333/webhooks/blip/local-tenant',
  tenant: 'Jotanunes',
  sourceRetentionDays: 90,
  retentionDays: 730,
  retentionPolicy: '24 meses em banco proprio por tenant',
  aiEstimatedCost: 'R$ 420,00/mes',
};

export const demoConversationGroups = Array.from(new Set(demoTickets.map((ticket) => ticket.group))).map((group) => {
  const tickets = demoTickets.filter((ticket) => ticket.group === group);

  return {
    id: group.toLowerCase().replace(/\s+/g, '-'),
    name: group,
    tickets: tickets.length,
    openTickets: tickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING').length,
    highRiskTickets: tickets.filter((ticket) => ticket.risk === 'alto').length,
    averageRating: average(tickets.map((ticket) => ticket.rating)),
    channels: Array.from(new Set(tickets.map((ticket) => ticket.channel))),
    queues: Array.from(new Set(tickets.map((ticket) => ticket.queue))),
  };
});

export const demoChannelGroups = channels.map((channel) => {
  const tickets = demoTickets.filter((ticket) => ticket.channel === channel);

  return {
    id: channel.toLowerCase(),
    name: channel,
    tickets: tickets.length,
    openTickets: tickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING').length,
    highRiskTickets: tickets.filter((ticket) => ticket.risk === 'alto').length,
    averageRating: average(tickets.map((ticket) => ticket.rating)),
  };
});

export function getTicketsByQueue(queue: string) {
  return demoTickets.filter((ticket) => ticket.queue === queue);
}

export function getTicketsByAgent(agent: string) {
  return demoTickets.filter((ticket) => ticket.agent === agent);
}

export function getTicketsByGroup(group: string) {
  return demoTickets.filter((ticket) => ticket.group === group);
}

export function getTicketsByChannel(channel: string) {
  return demoTickets.filter((ticket) => ticket.channel === channel);
}

export function getTicketsByHour(hourLabel: string) {
  const hour = Number(hourLabel.replace('h', ''));

  return demoTickets.filter((ticket) => new Date(ticket.openedAt).getUTCHours() === hour);
}

export function getDashboardTickets(type: string) {
  switch (type) {
    case 'Atendimentos':
      return demoTickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'PENDING');
    case 'Tempo medio':
      return demoTickets.filter((ticket) => ticket.firstResponseMinutes >= 7);
    case 'Nota media':
      return demoTickets.filter((ticket) => ticket.rating > 0);
    case 'Reclamacoes':
      return demoTickets.filter((ticket) => ticket.isComplaint);
    case 'Fallback do bot':
      return demoTickets.filter((ticket) => ticket.botFallback);
    case 'Oportunidades':
      return demoTickets.filter((ticket) => ticket.isOpportunity);
    default:
      return demoTickets;
  }
}

export function getDemoMessages(ticket: DemoTicket): ConversationMessage[] {
  return [
    {
      id: `${ticket.id}-msg-1`,
      direction: 'INBOUND',
      senderName: ticket.customerName,
      senderRole: 'Cliente',
      content: `Oi, preciso de ajuda com ${ticket.subject.toLowerCase()}.`,
      sentAt: ticket.openedAt,
      contentType: 'text/plain',
    },
    {
      id: `${ticket.id}-msg-2`,
      direction: 'SYSTEM',
      senderName: 'Bot AtendeBI',
      senderRole: 'Bot',
      content: ticket.botFallback
        ? 'Bot nao resolveu o tema e transferiu para atendimento humano.'
        : 'Bot classificou o assunto e direcionou para a fila correta.',
      sentAt: addMinutes(ticket.openedAt, 1),
      contentType: 'text/plain',
    },
    {
      id: `${ticket.id}-msg-3`,
      direction: 'OUTBOUND',
      senderName: ticket.agent,
      senderRole: 'Atendente',
      content: `Estou assumindo seu atendimento. Vou verificar o historico e tratar ${ticket.subject.toLowerCase()}.`,
      sentAt: addMinutes(ticket.openedAt, ticket.firstResponseMinutes),
      contentType: 'text/plain',
    },
    {
      id: `${ticket.id}-msg-4`,
      direction: ticket.risk === 'alto' ? 'INBOUND' : 'OUTBOUND',
      senderName: ticket.risk === 'alto' ? ticket.customerName : ticket.agent,
      senderRole: ticket.risk === 'alto' ? 'Cliente' : 'Atendente',
      content:
        ticket.risk === 'alto'
          ? 'Preciso de uma resposta objetiva, porque ja tentei resolver antes.'
          : 'O caso foi atualizado e deixei o proximo passo registrado.',
      sentAt: ticket.lastMessageAt,
      contentType: 'text/plain',
    },
  ];
}

export function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function addMinutes(value: string, minutes: number) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + minutes);

  return date.toISOString();
}
