import type { DashboardOverview } from '@/lib/mock-dashboard';
import type { ConversationMessagesResponse, TicketHistoryResponse } from '@/lib/mock-conversation-history';

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
