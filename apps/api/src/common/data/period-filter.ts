/**
 * Filtro de periodo compartilhado entre dashboard, qualidade, bot e vendas,
 * para que todas as telas falem a mesma lingua de recorte temporal.
 */

const DAYS_BY_PERIOD: Record<string, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12m': 365,
};

const PERIOD_LABELS: Record<string, string> = {
  active: 'Chamados ativos',
  '24h': 'Ultimas 24 horas',
  '7d': 'Ultimos 7 dias',
  '30d': 'Ultimos 30 dias',
  '90d': 'Ultimos 90 dias',
  '12m': 'Ultimos 12 meses',
  all: 'Todo o historico salvo',
};

export function normalizePeriod(period: string | undefined, fallback: string) {
  return period && PERIOD_LABELS[period] ? period : fallback;
}

export function periodLabel(period?: string) {
  return PERIOD_LABELS[period ?? 'active'] ?? PERIOD_LABELS.active;
}

/** Data minima de abertura para o periodo, ou null quando o periodo nao recorta por data. */
export function periodStartDate(period?: string): Date | null {
  const days = period ? DAYS_BY_PERIOD[period] : undefined;

  return days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;
}

export function matchesTicketPeriod(ticket: { openedAt: string; status: string }, period?: string) {
  if (!period || period === 'all') {
    return true;
  }

  if (period === 'active') {
    return ticket.status === 'OPEN' || ticket.status === 'PENDING';
  }

  const since = periodStartDate(period);

  if (!since) {
    return true;
  }

  return new Date(ticket.openedAt).getTime() >= since.getTime();
}
