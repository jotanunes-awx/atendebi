import type { DashboardOverview } from '@/lib/mock-dashboard';
import type { ConversationMessagesResponse, TicketHistoryResponse, TicketHistoryItem } from '@/lib/mock-conversation-history';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

const mockHeaders = {
  'x-tenant-id': 'local-tenant',
  'x-roles': 'ATENDEBI_ADMIN',
};

function toQueryString(filters?: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }

  const queryString = params.toString();

  return queryString ? `?${queryString}` : '';
}

export async function getDashboardOverview(filters?: Record<string, string | number | undefined>): Promise<DashboardOverview> {
  const response = await fetch(`${apiBaseUrl}/dashboard/overview${toQueryString(filters)}`, {
    headers: mockHeaders,
  });

  if (!response.ok) {
    throw new Error(`Dashboard API returned ${response.status}`);
  }

  return response.json() as Promise<DashboardOverview>;
}

export async function getDashboardDrilldown(type: string, filters?: Record<string, string | number | undefined>): Promise<TicketHistoryResponse> {
  const response = await fetch(`${apiBaseUrl}/dashboard/drilldown${toQueryString({ type, ...filters })}`, {
    headers: mockHeaders,
  });

  if (!response.ok) {
    throw new Error(`Dashboard drilldown API returned ${response.status}`);
  }

  return response.json() as Promise<TicketHistoryResponse>;
}

export async function getTickets(filters?: Record<string, string | number | undefined>): Promise<TicketHistoryResponse> {
  const response = await fetch(`${apiBaseUrl}/tickets${toQueryString(filters)}`, {
    headers: mockHeaders,
  });

  if (!response.ok) {
    throw new Error(`Tickets API returned ${response.status}`);
  }

  return response.json() as Promise<TicketHistoryResponse>;
}

export async function getTicket(id: string): Promise<TicketHistoryItem> {
  const response = await fetch(`${apiBaseUrl}/tickets/${id}`, {
    headers: mockHeaders,
  });

  if (!response.ok) {
    throw new Error(`Ticket API returned ${response.status}`);
  }

  return response.json() as Promise<TicketHistoryItem>;
}

export async function getConversationMessages(ticketId: string): Promise<ConversationMessagesResponse> {
  const response = await fetch(`${apiBaseUrl}/conversations/${ticketId}/messages`, {
    headers: mockHeaders,
  });

  if (!response.ok) {
    throw new Error(`Conversation API returned ${response.status}`);
  }

  return response.json() as Promise<ConversationMessagesResponse>;
}

export type QueueItem = {
  id: string;
  name: string;
  openTickets: number;
  averageWaitMinutes: number;
};

export type AgentItem = {
  id: string;
  name: string;
  queue: string;
  ticketsHandled: number;
  averageRating: number;
};

export type ApiListResponse<T> = {
  data: T[];
};

export async function getQueues(): Promise<ApiListResponse<QueueItem>> {
  const response = await fetch(`${apiBaseUrl}/queues`, {
    headers: mockHeaders,
  });

  if (!response.ok) {
    throw new Error(`Queues API returned ${response.status}`);
  }

  return response.json() as Promise<ApiListResponse<QueueItem>>;
}

export async function getQueue(id: string): Promise<QueueItem> {
  const response = await fetch(`${apiBaseUrl}/queues/${id}`, {
    headers: mockHeaders,
  });

  if (!response.ok) {
    throw new Error(`Queue API returned ${response.status}`);
  }

  return response.json() as Promise<QueueItem>;
}

export async function getAgents(): Promise<ApiListResponse<AgentItem>> {
  const response = await fetch(`${apiBaseUrl}/agents`, {
    headers: mockHeaders,
  });

  if (!response.ok) {
    throw new Error(`Agents API returned ${response.status}`);
  }

  return response.json() as Promise<ApiListResponse<AgentItem>>;
}

export async function getAgent(id: string): Promise<AgentItem> {
  const response = await fetch(`${apiBaseUrl}/agents/${id}`, {
    headers: mockHeaders,
  });

  if (!response.ok) {
    throw new Error(`Agent API returned ${response.status}`);
  }

  return response.json() as Promise<AgentItem>;
}

export async function getQualityOverview() {
  const response = await fetch(`${apiBaseUrl}/quality/overview`, {
    headers: mockHeaders,
  });

  if (!response.ok) {
    throw new Error(`Quality API returned ${response.status}`);
  }

  return response.json();
}

export async function getBotOverview() {
  const response = await fetch(`${apiBaseUrl}/bot/overview`, {
    headers: mockHeaders,
  });

  if (!response.ok) {
    throw new Error(`Bot API returned ${response.status}`);
  }

  return response.json();
}

export async function getSalesOverview() {
  const response = await fetch(`${apiBaseUrl}/sales/overview`, {
    headers: mockHeaders,
  });

  if (!response.ok) {
    throw new Error(`Sales API returned ${response.status}`);
  }

  return response.json();
}
