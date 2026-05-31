export type ConfigTab = 'integracao' | 'seguranca' | 'perfis' | 'retencao' | 'lgpd';

export type MockUserRow = {
  name: string;
  email: string;
  role: string;
  area: string;
  status: 'Ativo' | 'Convidado' | 'Bloqueado';
  lastAccess: string;
};

export type PermissionRow = {
  module: string;
  admin: string;
  diretoria: string;
  gestor: string;
  qualidade: string;
  comercial: string;
  atendente: string;
};

export const roleRows = [
  {
    role: 'ATENDEBI_ADMIN',
    label: 'Administrador',
    description: 'Configura tenant, integracoes, usuarios, seguranca e dados.',
    users: 1,
  },
  {
    role: 'ATENDEBI_DIRETORIA',
    label: 'Diretoria',
    description: 'Acompanha indicadores executivos, riscos e drill-down de auditoria.',
    users: 2,
  },
  {
    role: 'ATENDEBI_GESTOR',
    label: 'Gestor',
    description: 'Acompanha filas, atendentes, conversas e qualidade operacional.',
    users: 4,
  },
  {
    role: 'ATENDEBI_QUALIDADE',
    label: 'Qualidade',
    description: 'Audita notas baixas, reclamacoes, risco e historico de atendimento.',
    users: 3,
  },
  {
    role: 'ATENDEBI_COMERCIAL',
    label: 'Comercial',
    description: 'Visualiza oportunidades, propostas, leads e perdas comerciais.',
    users: 5,
  },
  {
    role: 'ATENDEBI_ATENDENTE',
    label: 'Atendente',
    description: 'Visualizacao restrita aos proprios atendimentos em etapa futura.',
    users: 18,
  },
];

export const userRows: MockUserRow[] = [
  {
    name: 'Daniel Fernando',
    email: 'daniel.fernando@jotanunes.com',
    role: 'ATENDEBI_ADMIN',
    area: 'TI / Infraestrutura',
    status: 'Ativo',
    lastAccess: 'Hoje, 10:42',
  },
  {
    name: 'Mariana Gomes',
    email: 'mariana.gomes@jotanunes.com',
    role: 'ATENDEBI_DIRETORIA',
    area: 'Diretoria',
    status: 'Ativo',
    lastAccess: 'Ontem, 17:10',
  },
  {
    name: 'Ana Lima',
    email: 'ana.lima@jotanunes.com',
    role: 'ATENDEBI_GESTOR',
    area: 'Atendimento',
    status: 'Ativo',
    lastAccess: 'Hoje, 09:18',
  },
  {
    name: 'Beatriz Rocha',
    email: 'beatriz.rocha@jotanunes.com',
    role: 'ATENDEBI_COMERCIAL',
    area: 'Comercial',
    status: 'Convidado',
    lastAccess: 'Convite pendente',
  },
  {
    name: 'Juliana Santos',
    email: 'juliana.santos@jotanunes.com',
    role: 'ATENDEBI_QUALIDADE',
    area: 'Qualidade',
    status: 'Ativo',
    lastAccess: 'Hoje, 08:55',
  },
];

export const permissionRows: PermissionRow[] = [
  {
    module: 'Dashboard executivo',
    admin: 'Total',
    diretoria: 'Total',
    gestor: 'Total',
    qualidade: 'Leitura',
    comercial: 'Parcial',
    atendente: 'Restrito',
  },
  {
    module: 'Historico de conversas',
    admin: 'Total',
    diretoria: 'Total',
    gestor: 'Total',
    qualidade: 'Total',
    comercial: 'Comercial',
    atendente: 'Proprio',
  },
  {
    module: 'Bot e qualidade',
    admin: 'Total',
    diretoria: 'Leitura',
    gestor: 'Total',
    qualidade: 'Total',
    comercial: 'Sem acesso',
    atendente: 'Sem acesso',
  },
  {
    module: 'Configuracoes',
    admin: 'Total',
    diretoria: 'Leitura',
    gestor: 'Sem acesso',
    qualidade: 'Sem acesso',
    comercial: 'Sem acesso',
    atendente: 'Sem acesso',
  },
];
