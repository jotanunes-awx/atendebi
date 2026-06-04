'use client';

import { getApiAuthHeaders } from '@/lib/auth';
import type { DashboardOverview } from '@/lib/mock-dashboard';
import type { ConversationMessagesResponse, TicketHistoryResponse, TicketHistoryItem } from '@/lib/mock-conversation-history';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

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

async function getRequestHeaders() {
  return getApiAuthHeaders();
}

export async function getDashboardOverview(filters?: Record<string, string | number | undefined>): Promise<DashboardOverview> {
  const response = await fetch(`${apiBaseUrl}/dashboard/overview${toQueryString(filters)}`, {
    headers: await getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Dashboard API returned ${response.status}`);
  }

  return response.json() as Promise<DashboardOverview>;
}

export async function getDashboardDrilldown(type: string, filters?: Record<string, string | number | undefined>): Promise<TicketHistoryResponse> {
  const response = await fetch(`${apiBaseUrl}/dashboard/drilldown${toQueryString({ type, ...filters })}`, {
    headers: await getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Dashboard drilldown API returned ${response.status}`);
  }

  return response.json() as Promise<TicketHistoryResponse>;
}

export async function getTickets(filters?: Record<string, string | number | undefined>): Promise<TicketHistoryResponse> {
  const response = await fetch(`${apiBaseUrl}/tickets${toQueryString(filters)}`, {
    headers: await getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Tickets API returned ${response.status}`);
  }

  return response.json() as Promise<TicketHistoryResponse>;
}

export async function getTicket(id: string): Promise<TicketHistoryItem> {
  const response = await fetch(`${apiBaseUrl}/tickets/${id}`, {
    headers: await getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Ticket API returned ${response.status}`);
  }

  return response.json() as Promise<TicketHistoryItem>;
}

export async function getConversationMessages(ticketId: string): Promise<ConversationMessagesResponse> {
  const response = await fetch(`${apiBaseUrl}/conversations/${ticketId}/messages`, {
    headers: await getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Conversation API returned ${response.status}`);
  }

  return response.json() as Promise<ConversationMessagesResponse>;
}

export type QueueItem = {
  id: string;
  internalId?: string;
  name: string;
  openTickets: number;
  averageWaitMinutes: number;
  averageRating: number;
  riskTickets: number;
  ticketsHandled: number;
  tickets?: TicketHistoryItem[];
  agents?: Array<{
    name: string;
    openTickets: number;
  }>;
};

export type AgentItem = {
  id: string;
  internalId?: string;
  name: string;
  email?: string | null;
  queue: string;
  ticketsHandled: number;
  openTickets: number;
  averageRating: number;
  resolutionRate: number;
  firstResponseMinutes: number;
  complaints: number;
  tickets?: TicketHistoryItem[];
};

export type ApiListResponse<T> = {
  data: T[];
};

export async function getQueues(): Promise<ApiListResponse<QueueItem>> {
  const response = await fetch(`${apiBaseUrl}/queues`, {
    headers: await getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Queues API returned ${response.status}`);
  }

  return response.json() as Promise<ApiListResponse<QueueItem>>;
}

export async function getQueue(id: string): Promise<QueueItem> {
  const response = await fetch(`${apiBaseUrl}/queues/${id}`, {
    headers: await getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Queue API returned ${response.status}`);
  }

  return response.json() as Promise<QueueItem>;
}

export async function getAgents(): Promise<ApiListResponse<AgentItem>> {
  const response = await fetch(`${apiBaseUrl}/agents`, {
    headers: await getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Agents API returned ${response.status}`);
  }

  return response.json() as Promise<ApiListResponse<AgentItem>>;
}

export async function getAgent(id: string): Promise<AgentItem> {
  const response = await fetch(`${apiBaseUrl}/agents/${id}`, {
    headers: await getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Agent API returned ${response.status}`);
  }

  return response.json() as Promise<AgentItem>;
}

export type QualityOverview = {
  averageRating: number;
  totalRated: number;
  lowRated: number;
  negativeSentiment: number;
  highRisk: number;
  unresolved: number;
  recurrentReasons: Array<{
    label: string;
    count: number;
  }>;
  recommendedActions: Array<{
    title: string;
    description: string;
    tickets: number;
  }>;
  tickets: TicketHistoryItem[];
};

export type BotOverview = {
  fallbackRate: number;
  humanRequests: number;
  abandonedFlows: number;
  misunderstoodQuestions: number;
  flows: Array<{
    name: string;
    total: number;
    fallback: number;
    fallbackRate: number;
  }>;
  failures: TicketHistoryItem[];
};

export type SalesOverview = {
  opportunities: number;
  leads: number;
  proposals: number;
  simulatedConversions: number;
  lostByDelay: number;
  tickets: TicketHistoryItem[];
};

export type IntegrationProvider = 'BLIP' | 'GLPI' | 'TEAMS_PHONE';

export type IntegrationSummary = {
  provider: IntegrationProvider;
  label: string;
  name: string;
  category: string;
  description: string;
  status: 'connected' | 'ready' | 'pending';
  statusLabel: string;
  configured: boolean;
  active: boolean;
  tenantKey?: string;
  webhookUrl?: string;
  rawEvents: number;
  lastEventAt: string | null;
  missingSettings: string[];
  requiredSettings: string[];
  nextAction: string;
  capabilities: string[];
  settingsPreview: Record<string, unknown>;
};

export type IntegrationTestResult = {
  provider: IntegrationProvider;
  checkedAt: string;
  ok: boolean;
  status: string;
  message: string;
  details: Array<{
    item: string;
    status: string;
  }>;
};

export type IntegrationSyncResult = {
  provider: IntegrationProvider;
  accepted: boolean;
  status: string;
  message: string;
  rawEventId?: string;
  imported?: number;
  skipped?: number;
  attendants?: number;
  contacts?: number;
  messages?: number;
  warnings?: string[];
  options?: Record<string, string | number | boolean>;
  batches?: Array<{
    source: string;
    rows: number;
  }>;
};

export type SettingsOverview = {
  source: 'api' | 'empty';
  tenant: {
    id: string;
    name: string;
    key: string;
    status: string;
  } | null;
  integration: {
    provider: string;
    name: string;
    status: string;
    tenantKey: string;
    webhookUrl: string;
    lastEventAt: string;
    rawEvents: number;
    webhookSecretRequired: boolean;
  } | null;
  integrations: IntegrationSummary[];
  security: {
    authMode: string;
    tokenValidation: string;
    structuredAudit: boolean;
    maskSensitiveData: boolean;
    blipTokenInFrontend: boolean;
  } | null;
  retention: {
    sourceRetentionDays: number;
    retentionDays: number;
    retentionPolicy: string;
    estimatedStorageGb: number;
  } | null;
  users: Array<{
    name: string;
    email: string;
    role: string;
    status: string;
    area: string;
    lastAccess: string;
  }>;
  roles: Array<{
    role: string;
    label: string;
    description: string;
    users: number;
  }>;
  groups: Array<{
    id: string;
    name: string;
    tickets: number;
    openTickets: number;
    channels: string[];
  }>;
  lgpd: {
    purpose: string;
    aiEnabled: boolean;
    aiConsentRequired: boolean;
    dataMinimization: boolean;
    auditLogs: boolean;
  } | null;
};

export async function getQualityOverview(): Promise<QualityOverview> {
  const response = await fetch(`${apiBaseUrl}/quality/overview`, {
    headers: await getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Quality API returned ${response.status}`);
  }

  return response.json();
}

export async function getBotOverview(): Promise<BotOverview> {
  const response = await fetch(`${apiBaseUrl}/bot/overview`, {
    headers: await getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Bot API returned ${response.status}`);
  }

  return response.json();
}

export async function getSalesOverview(): Promise<SalesOverview> {
  const response = await fetch(`${apiBaseUrl}/sales/overview`, {
    headers: await getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Sales API returned ${response.status}`);
  }

  return response.json();
}

export async function getSettingsOverview(): Promise<SettingsOverview> {
  const response = await fetch(`${apiBaseUrl}/settings/overview`, {
    headers: await getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Settings API returned ${response.status}`);
  }

  return response.json();
}

export async function getIntegrations(): Promise<ApiListResponse<IntegrationSummary>> {
  const response = await fetch(`${apiBaseUrl}/integrations`, {
    headers: await getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Integrations API returned ${response.status}`);
  }

  return response.json() as Promise<ApiListResponse<IntegrationSummary>>;
}

export async function testIntegration(provider: IntegrationProvider): Promise<IntegrationTestResult> {
  const response = await fetch(`${apiBaseUrl}/integrations/${provider}/test`, {
    method: 'POST',
    headers: await getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Integration test API returned ${response.status}`);
  }

  return response.json() as Promise<IntegrationTestResult>;
}

export async function syncIntegration(provider: IntegrationProvider): Promise<IntegrationSyncResult> {
  const response = await fetch(`${apiBaseUrl}/integrations/${provider}/sync`, {
    method: 'POST',
    headers: await getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Integration sync API returned ${response.status}`);
  }

  return response.json() as Promise<IntegrationSyncResult>;
}
