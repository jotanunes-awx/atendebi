export const ATENDEBI_ROLES = [
  'ATENDEBI_ADMIN',
  'ATENDEBI_DIRETORIA',
  'ATENDEBI_GESTOR',
  'ATENDEBI_QUALIDADE',
  'ATENDEBI_COMERCIAL',
  'ATENDEBI_ATENDENTE',
] as const;

export type AtendeBIRole = (typeof ATENDEBI_ROLES)[number];

export type DashboardMetric = {
  label: string;
  value: string;
  trend: string;
  tone: 'neutral' | 'good' | 'warning' | 'danger';
};

export type DashboardOverview = {
  period: string;
  metrics: {
    totalTickets: number;
    openTickets: number;
    averageFirstResponseMinutes: number;
    averageRating: number;
    botFallbackRate: number;
    complaints: number;
    salesOpportunities: number;
  };
};
