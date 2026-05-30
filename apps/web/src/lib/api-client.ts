import type { DashboardOverview } from '@/lib/mock-dashboard';
import type { ConversationMessagesResponse, TicketHistoryResponse, TicketHistoryItem } from '@/lib/mock-conversation-history';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const response = await fetch(`${apiBaseUrl}/dashboard/overview`, {
    headers: {
      'x-tenant-id': 'local-tenant',
      'x-roles': 'ATENDEBI_ADMIN',
    },
  });

  if (!response.ok) {
    throw new Error(`Dashboard API returned ${response.status}`);
  }

  return response.json() as Promise<DashboardOverview>;
}

export async function getTickets(): Promise<TicketHistoryResponse> {
  const response = await fetch(`${apiBaseUrl}/tickets`, {
    headers: {
      'x-tenant-id': 'local-tenant',
      'x-roles': 'ATENDEBI_ADMIN',
    },
  });

  if (!response.ok) {
    throw new Error(`Tickets API returned ${response.status}`);
  }

  return response.json() as Promise<TicketHistoryResponse>;
}

export async function getConversationMessages(ticketId: string): Promise<ConversationMessagesResponse> {
  const response = await fetch(`${apiBaseUrl}/conversations/${ticketId}/messages`, {
    headers: {
      'x-tenant-id': 'local-tenant',
      'x-roles': 'ATENDEBI_ADMIN',
    },
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
    headers: {
      'x-tenant-id': 'local-tenant',
      'x-roles': 'ATENDEBI_ADMIN',
    },
  });

  if (!response.ok) {
    throw new Error(`Queues API returned ${response.status}`);
  }

  return response.json() as Promise<ApiListResponse<QueueItem>>;
}

export async function getAgents(): Promise<ApiListResponse<AgentItem>> {
  const response = await fetch(`${apiBaseUrl}/agents`, {
    headers: {
      'x-tenant-id': 'local-tenant',
      'x-roles': 'ATENDEBI_ADMIN',
    },
  });

  if (!response.ok) {
    throw new Error(`Agents API returned ${response.status}`);
  }

  return response.json() as Promise<ApiListResponse<AgentItem>>;
}
