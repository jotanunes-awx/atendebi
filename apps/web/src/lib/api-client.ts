import type { DashboardOverview } from '@/lib/mock-dashboard';

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
