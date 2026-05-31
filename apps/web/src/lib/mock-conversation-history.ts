export type TicketHistoryItem = {
  id: string;
  internalId?: string;
  customerName: string;
  customerContact: string;
  queue: string;
  agent: string;
  status: 'OPEN' | 'PENDING' | 'CLOSED' | 'CANCELED';
  resolutionStatus: string;
  rating: number;
  channel: string;
  group: string;
  subject: string;
  signal: string;
  sentiment: 'positivo' | 'neutro' | 'negativo';
  risk: 'baixo' | 'medio' | 'alto';
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

export type ConversationMessage = {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND' | 'SYSTEM';
  senderName: string;
  senderRole: string;
  content: string;
  sentAt: string;
  contentType: string;
};

export type ConversationMessagesResponse = {
  ticketId: string;
  summary: Pick<
    TicketHistoryItem,
    | 'customerName'
    | 'queue'
    | 'agent'
    | 'status'
    | 'resolutionStatus'
    | 'rating'
    | 'sentiment'
    | 'risk'
    | 'tags'
    | 'summary'
  >;
  data: ConversationMessage[];
};

export type TicketHistoryResponse = {
  data: TicketHistoryItem[];
  meta?: {
    total: number;
    page?: number;
    pageSize?: number;
    type?: string;
  };
};

export const mockConversationTickets: TicketHistoryItem[] = [
  {
    id: 'ticket-1001',
    customerName: 'Marina Costa',
    customerContact: '+55 11 98888-1001',
    queue: 'Suporte',
    agent: 'Ana Lima',
    status: 'OPEN',
    resolutionStatus: 'Em andamento',
    rating: 5,
    channel: 'WhatsApp',
    group: 'Suporte Nivel 1',
    subject: 'Entrega atrasada',
    signal: 'Entrega',
    sentiment: 'neutro',
    risk: 'baixo',
    openedAt: '2026-05-29T11:15:00.000Z',
    lastMessageAt: '2026-05-29T11:28:00.000Z',
    firstResponseMinutes: 1,
    waitMinutes: 13,
    tags: ['Entrega', 'Pedido', 'Suporte'],
    summary: 'Cliente pediu atualizacao de entrega e recebeu prazo atualizado do atendente.',
    isComplaint: false,
    isOpportunity: false,
    botFallback: false,
    unresolved: false,
  },
  {
    id: 'ticket-1002',
    customerName: 'Joao Pereira',
    customerContact: '+55 21 97777-1002',
    queue: 'Financeiro',
    agent: 'Carlos Souza',
    status: 'PENDING',
    resolutionStatus: 'Nao solucionado',
    rating: 2,
    channel: 'WhatsApp',
    group: 'Financeiro Critico',
    subject: 'Segunda via de boleto',
    signal: 'Nota baixa',
    sentiment: 'negativo',
    risk: 'alto',
    openedAt: '2026-05-29T12:40:00.000Z',
    lastMessageAt: '2026-05-29T13:05:00.000Z',
    firstResponseMinutes: 15,
    waitMinutes: 25,
    tags: ['Financeiro', 'Boleto', 'Risco'],
    summary: 'Cliente nao recebeu a segunda via no primeiro atendimento e demonstrou insatisfacao.',
    isComplaint: true,
    isOpportunity: false,
    botFallback: true,
    unresolved: true,
  },
  {
    id: 'ticket-1003',
    customerName: 'Patricia Nunes',
    customerContact: '+55 31 96666-1003',
    queue: 'Comercial',
    agent: 'Beatriz Rocha',
    status: 'CLOSED',
    resolutionStatus: 'Resolvido',
    rating: 5,
    channel: 'WhatsApp',
    group: 'JotaVendas 1',
    subject: 'Negociacao comercial',
    signal: 'Venda',
    sentiment: 'positivo',
    risk: 'baixo',
    openedAt: '2026-05-29T14:08:00.000Z',
    lastMessageAt: '2026-05-29T14:35:00.000Z',
    firstResponseMinutes: 4,
    waitMinutes: 27,
    tags: ['Comercial', 'Venda', 'Proposta'],
    summary: 'Cliente pediu condicoes comerciais e aceitou receber uma proposta formal.',
    isComplaint: false,
    isOpportunity: true,
    botFallback: false,
    unresolved: false,
  },
  {
    id: 'ticket-1004',
    customerName: 'Rafael Martins',
    customerContact: '+55 41 95555-1004',
    queue: 'Retencao',
    agent: 'Ana Lima',
    status: 'OPEN',
    resolutionStatus: 'Risco de reclamacao',
    rating: 1,
    channel: 'WhatsApp',
    group: 'Retencao VIP',
    subject: 'Cancelamento',
    signal: 'Risco',
    sentiment: 'negativo',
    risk: 'alto',
    openedAt: '2026-05-29T15:22:00.000Z',
    lastMessageAt: '2026-05-29T15:48:00.000Z',
    firstResponseMinutes: 9,
    waitMinutes: 26,
    tags: ['Cancelamento', 'Retencao', 'Reclamacao'],
    summary: 'Cliente pediu cancelamento apos demora no retorno e deve ser priorizado pela qualidade.',
    isComplaint: true,
    isOpportunity: false,
    botFallback: true,
    unresolved: true,
  },
];

export const mockConversationMessages: Record<string, ConversationMessagesResponse> = {
  'ticket-1001': {
    ticketId: 'ticket-1001',
    summary: pickSummary(mockConversationTickets[0]),
    data: [
      {
        id: 'msg-1001-1',
        direction: 'INBOUND',
        senderName: 'Marina Costa',
        senderRole: 'Cliente',
        content: 'Bom dia, preciso acompanhar meu pedido. A entrega deveria ter chegado ontem.',
        sentAt: '2026-05-29T11:16:00.000Z',
        contentType: 'text/plain',
      },
      {
        id: 'msg-1001-2',
        direction: 'SYSTEM',
        senderName: 'Bot AtendeBI',
        senderRole: 'Bot',
        content: 'Identifiquei que o assunto e entrega. Vou transferir para Suporte.',
        sentAt: '2026-05-29T11:16:12.000Z',
        contentType: 'text/plain',
      },
      {
        id: 'msg-1001-3',
        direction: 'OUTBOUND',
        senderName: 'Ana Lima',
        senderRole: 'Atendente',
        content: 'Claro, Marina. Vou verificar o status agora e te passo uma previsao atualizada.',
        sentAt: '2026-05-29T11:17:00.000Z',
        contentType: 'text/plain',
      },
      {
        id: 'msg-1001-4',
        direction: 'OUTBOUND',
        senderName: 'Ana Lima',
        senderRole: 'Atendente',
        content: 'O pedido saiu para rota hoje e a transportadora informou entrega ate 18h.',
        sentAt: '2026-05-29T11:28:00.000Z',
        contentType: 'text/plain',
      },
    ],
  },
  'ticket-1002': {
    ticketId: 'ticket-1002',
    summary: pickSummary(mockConversationTickets[1]),
    data: [
      {
        id: 'msg-1002-1',
        direction: 'INBOUND',
        senderName: 'Joao Pereira',
        senderRole: 'Cliente',
        content: 'Estou tentando pegar a segunda via do boleto e o bot nao resolve.',
        sentAt: '2026-05-29T12:40:00.000Z',
        contentType: 'text/plain',
      },
      {
        id: 'msg-1002-2',
        direction: 'SYSTEM',
        senderName: 'Bot AtendeBI',
        senderRole: 'Bot',
        content: 'Cliente solicitou humano apos tres tentativas no bot.',
        sentAt: '2026-05-29T12:42:00.000Z',
        contentType: 'text/plain',
      },
      {
        id: 'msg-1002-3',
        direction: 'OUTBOUND',
        senderName: 'Carlos Souza',
        senderRole: 'Atendente',
        content: 'Joao, vou localizar seu cadastro para gerar a segunda via.',
        sentAt: '2026-05-29T12:55:00.000Z',
        contentType: 'text/plain',
      },
      {
        id: 'msg-1002-4',
        direction: 'INBOUND',
        senderName: 'Joao Pereira',
        senderRole: 'Cliente',
        content: 'Ja mandei os dados antes. Estou esperando ha muito tempo.',
        sentAt: '2026-05-29T13:05:00.000Z',
        contentType: 'text/plain',
      },
    ],
  },
  'ticket-1003': {
    ticketId: 'ticket-1003',
    summary: pickSummary(mockConversationTickets[2]),
    data: [
      {
        id: 'msg-1003-1',
        direction: 'INBOUND',
        senderName: 'Patricia Nunes',
        senderRole: 'Cliente',
        content: 'Tenho interesse no plano para 20 usuarios. Voces conseguem proposta?',
        sentAt: '2026-05-29T14:08:00.000Z',
        contentType: 'text/plain',
      },
      {
        id: 'msg-1003-2',
        direction: 'OUTBOUND',
        senderName: 'Beatriz Rocha',
        senderRole: 'Atendente',
        content: 'Consigo sim, Patricia. Vou confirmar alguns dados e envio a proposta ainda hoje.',
        sentAt: '2026-05-29T14:12:00.000Z',
        contentType: 'text/plain',
      },
      {
        id: 'msg-1003-3',
        direction: 'INBOUND',
        senderName: 'Patricia Nunes',
        senderRole: 'Cliente',
        content: 'Perfeito. Pode enviar por e-mail tambem.',
        sentAt: '2026-05-29T14:35:00.000Z',
        contentType: 'text/plain',
      },
    ],
  },
  'ticket-1004': {
    ticketId: 'ticket-1004',
    summary: pickSummary(mockConversationTickets[3]),
    data: [
      {
        id: 'msg-1004-1',
        direction: 'INBOUND',
        senderName: 'Rafael Martins',
        senderRole: 'Cliente',
        content: 'Quero cancelar. Ja tentei resolver duas vezes e ninguem retornou.',
        sentAt: '2026-05-29T15:22:00.000Z',
        contentType: 'text/plain',
      },
      {
        id: 'msg-1004-2',
        direction: 'SYSTEM',
        senderName: 'Bot AtendeBI',
        senderRole: 'Bot',
        content: 'Sinal de reclamacao detectado: cancelamento e reincidencia.',
        sentAt: '2026-05-29T15:22:20.000Z',
        contentType: 'text/plain',
      },
      {
        id: 'msg-1004-3',
        direction: 'OUTBOUND',
        senderName: 'Ana Lima',
        senderRole: 'Atendente',
        content: 'Rafael, entendo sua frustracao. Vou assumir seu caso e verificar o historico completo.',
        sentAt: '2026-05-29T15:31:00.000Z',
        contentType: 'text/plain',
      },
      {
        id: 'msg-1004-4',
        direction: 'INBOUND',
        senderName: 'Rafael Martins',
        senderRole: 'Cliente',
        content: 'Preciso de uma resposta objetiva hoje.',
        sentAt: '2026-05-29T15:48:00.000Z',
        contentType: 'text/plain',
      },
    ],
  },
};

function pickSummary(ticket: TicketHistoryItem): ConversationMessagesResponse['summary'] {
  return {
    customerName: ticket.customerName,
    queue: ticket.queue,
    agent: ticket.agent,
    status: ticket.status,
    resolutionStatus: ticket.resolutionStatus,
    rating: ticket.rating,
    sentiment: ticket.sentiment,
    risk: ticket.risk,
    tags: ticket.tags,
    summary: ticket.summary,
  };
}
