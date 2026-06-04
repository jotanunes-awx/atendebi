import type { AtendeBIRole, AuthenticatedUser } from '@/lib/auth';
import type { DemoTicket } from '@/lib/demo-data';

export type ProviderScope = 'BLIP' | 'GLPI' | 'TEAMS_PHONE';
export type DashboardViewMode = 'executive' | 'service' | 'it' | 'commercial' | 'global';

export type UserExperience = {
  audienceLabel: string;
  shortDescription: string;
  allowedProviders: ProviderScope[];
  preferredView: DashboardViewMode;
  visibleNav: string[];
  plainLanguageFocus: string[];
};

const allProviders: ProviderScope[] = ['BLIP', 'GLPI', 'TEAMS_PHONE'];

const userExperienceByEmail: Record<string, UserExperience> = {
  'rebeca@jotanunes.com': {
    audienceLabel: 'Marketing e relacionamento',
    shortDescription: 'Visao simplificada de conversas digitais, campanhas, bot e telefonia.',
    allowedProviders: ['BLIP', 'TEAMS_PHONE'],
    preferredView: 'service',
    visibleNav: ['/', '/conversas', '/qualidade', '/bot', '/vendas', '/configuracoes'],
    plainLanguageFocus: ['clientes que precisam de retorno', 'bot que nao resolveu', 'ligacoes perdidas'],
  },
  'leonardo.francisco@jotanunes.com': {
    audienceLabel: 'Gestao de TI',
    shortDescription: 'Visao de chamados, filas, tecnicos e riscos operacionais do GLPI.',
    allowedProviders: ['GLPI'],
    preferredView: 'it',
    visibleNav: ['/', '/filas', '/atendentes', '/conversas', '/qualidade', '/configuracoes'],
    plainLanguageFocus: ['chamados abertos', 'equipes com backlog', 'usuarios esperando atendimento'],
  },
  'everton.teixeira@jotanunes.com': {
    audienceLabel: 'Diretoria financeira',
    shortDescription: 'Visao executiva de chamados, atendimento e riscos que afetam a operacao.',
    allowedProviders: ['GLPI', 'TEAMS_PHONE'],
    preferredView: 'executive',
    visibleNav: ['/', '/filas', '/atendentes', '/conversas', '/qualidade', '/configuracoes'],
    plainLanguageFocus: ['pendencias criticas', 'tempo de resposta', 'riscos por area'],
  },
};

const fallbackByRole: Record<AtendeBIRole, UserExperience> = {
  ATENDEBI_ADMIN: {
    audienceLabel: 'Administracao global',
    shortDescription: 'Acesso completo para configurar e validar todos os modulos do AtendeBI.',
    allowedProviders: allProviders,
    preferredView: 'global',
    visibleNav: ['/', '/filas', '/atendentes', '/conversas', '/qualidade', '/bot', '/vendas', '/configuracoes'],
    plainLanguageFocus: ['visao completa', 'integracoes', 'auditoria'],
  },
  ATENDEBI_DIRETORIA: {
    audienceLabel: 'Diretoria',
    shortDescription: 'Resumo executivo com foco em risco, qualidade e gargalos.',
    allowedProviders: allProviders,
    preferredView: 'executive',
    visibleNav: ['/', '/filas', '/atendentes', '/conversas', '/qualidade', '/configuracoes'],
    plainLanguageFocus: ['riscos', 'qualidade', 'volume por area'],
  },
  ATENDEBI_GESTOR: {
    audienceLabel: 'Gestao de atendimento',
    shortDescription: 'Acompanhamento de filas, equipes, conversas e qualidade do atendimento.',
    allowedProviders: allProviders,
    preferredView: 'service',
    visibleNav: ['/', '/filas', '/atendentes', '/conversas', '/qualidade', '/bot', '/configuracoes'],
    plainLanguageFocus: ['filas travadas', 'atendentes sobrecarregados', 'clientes aguardando'],
  },
  ATENDEBI_QUALIDADE: {
    audienceLabel: 'Qualidade',
    shortDescription: 'Foco em notas baixas, reclamacoes, conversas sensiveis e auditoria.',
    allowedProviders: ['BLIP', 'GLPI'],
    preferredView: 'service',
    visibleNav: ['/', '/conversas', '/qualidade', '/bot', '/configuracoes'],
    plainLanguageFocus: ['notas baixas', 'clientes insatisfeitos', 'conversas para auditar'],
  },
  ATENDEBI_COMERCIAL: {
    audienceLabel: 'Comercial',
    shortDescription: 'Conversas com oportunidade, propostas e atendimento digital.',
    allowedProviders: ['BLIP', 'TEAMS_PHONE'],
    preferredView: 'commercial',
    visibleNav: ['/', '/conversas', '/bot', '/vendas', '/configuracoes'],
    plainLanguageFocus: ['oportunidades', 'leads', 'perdas por demora'],
  },
  ATENDEBI_ATENDENTE: {
    audienceLabel: 'Atendimento',
    shortDescription: 'Visao focada nos atendimentos em andamento e no historico do cliente.',
    allowedProviders: ['BLIP'],
    preferredView: 'service',
    visibleNav: ['/', '/conversas', '/qualidade'],
    plainLanguageFocus: ['meus atendimentos', 'clientes esperando', 'proximos passos'],
  },
};

export const providerLabels: Record<ProviderScope, string> = {
  BLIP: 'Atendimento digital',
  GLPI: 'Chamados internos',
  TEAMS_PHONE: 'Telefonia',
};

export const providerShortLabels: Record<ProviderScope, string> = {
  BLIP: 'BLiP',
  GLPI: 'GLPI',
  TEAMS_PHONE: 'Teams Phone',
};

export const dashboardViewLabels: Record<DashboardViewMode, string> = {
  executive: 'Resumo para diretoria',
  service: 'Atendimento e experiencia',
  it: 'TI e chamados',
  commercial: 'Comercial e oportunidades',
  global: 'Visao completa',
};

export function getUserExperience(user: AuthenticatedUser | null): UserExperience {
  if (!user) {
    return fallbackByRole.ATENDEBI_ATENDENTE;
  }

  const email = user.email.toLowerCase();

  return userExperienceByEmail[email] ?? fallbackByRole[user.role] ?? fallbackByRole.ATENDEBI_ATENDENTE;
}

export function isProviderAllowed(provider: string | undefined, experience: UserExperience) {
  return experience.allowedProviders.includes(normalizeProvider(provider));
}

export function filterTicketsByExperience<T extends Pick<DemoTicket, 'provider' | 'channel' | 'tags'>>(
  tickets: T[],
  experience: UserExperience,
) {
  return tickets.filter((ticket) => isProviderAllowed(readTicketProvider(ticket), experience));
}

export function providerFilterValue(provider: ProviderScope | 'Todos', experience: UserExperience) {
  if (provider !== 'Todos') {
    return provider;
  }

  return experience.allowedProviders.join(',');
}

export function readTicketProvider(ticket: Pick<DemoTicket, 'provider' | 'channel' | 'tags'>) {
  return normalizeProvider(ticket.provider ?? ticket.channel ?? ticket.tags?.join(' '));
}

export function normalizeProvider(value?: string): ProviderScope {
  const normalized = (value ?? '').toUpperCase().replace(/[\s-]+/g, '_');

  if (normalized.includes('GLPI')) {
    return 'GLPI';
  }

  if (normalized.includes('TEAM')) {
    return 'TEAMS_PHONE';
  }

  return 'BLIP';
}
