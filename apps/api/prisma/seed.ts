import {
  AiAnalysisStatus,
  IntegrationProvider,
  MessageDirection,
  PrismaClient,
  TenantStatus,
  TicketStatus,
  UserStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const roles = [
  'ATENDEBI_ADMIN',
  'ATENDEBI_DIRETORIA',
  'ATENDEBI_GESTOR',
  'ATENDEBI_QUALIDADE',
  'ATENDEBI_COMERCIAL',
  'ATENDEBI_ATENDENTE',
];

const queueSeeds = [
  {
    externalId: 'queue-financeiro',
    name: 'Financeiro',
    owner: 'Carlos Souza',
    averageWaitMinutes: 9,
    subjects: ['Segunda via de boleto', 'Boleto vencido', 'Pagamento nao identificado', 'Renegociacao'],
  },
  {
    externalId: 'queue-comercial',
    name: 'Comercial',
    owner: 'Beatriz Rocha',
    averageWaitMinutes: 4,
    subjects: ['Proposta comercial', 'Plano para equipe', 'Negociacao', 'Condicoes de pagamento'],
  },
  {
    externalId: 'queue-suporte',
    name: 'Suporte',
    owner: 'Ana Lima',
    averageWaitMinutes: 7,
    subjects: ['Entrega atrasada', 'Troca de produto', 'Suporte tecnico', 'Pedido sem atualizacao'],
  },
  {
    externalId: 'queue-retencao',
    name: 'Retencao',
    owner: 'Rafael Martins',
    averageWaitMinutes: 6,
    subjects: ['Cancelamento', 'Insatisfacao recorrente', 'Pedido de retorno', 'Reclamacao'],
  },
  {
    externalId: 'queue-pos-venda',
    name: 'Pos-venda',
    owner: 'Juliana Santos',
    averageWaitMinutes: 4,
    subjects: ['Entrega concluida', 'Garantia', 'Acompanhamento', 'Pesquisa de satisfacao'],
  },
];

const agentSeeds = [
  { externalId: 'agent-ana-lima', name: 'Ana Lima', email: 'ana.lima@jotanunes.com', queue: 'Suporte' },
  { externalId: 'agent-carlos-souza', name: 'Carlos Souza', email: 'carlos.souza@jotanunes.com', queue: 'Financeiro' },
  { externalId: 'agent-beatriz-rocha', name: 'Beatriz Rocha', email: 'beatriz.rocha@jotanunes.com', queue: 'Comercial' },
  { externalId: 'agent-rafael-martins', name: 'Rafael Martins', email: 'rafael.martins@jotanunes.com', queue: 'Retencao' },
  { externalId: 'agent-juliana-santos', name: 'Juliana Santos', email: 'juliana.santos@jotanunes.com', queue: 'Pos-venda' },
];

const contacts = [
  ['Marina Costa', '+55 11 98888-1001'],
  ['Joao Pereira', '+55 21 97777-1002'],
  ['Patricia Nunes', '+55 31 96666-1003'],
  ['Rafael Martins', '+55 41 95555-1004'],
  ['Camila Torres', '+55 11 94444-1005'],
  ['Eduardo Almeida', '+55 81 93333-1006'],
  ['Fernanda Lima', '+55 71 92222-1007'],
  ['Gustavo Rocha', '+55 85 91111-1008'],
  ['Helena Duarte', '+55 27 90000-1009'],
  ['Igor Batista', '+55 62 98888-1010'],
  ['Larissa Melo', '+55 48 97777-1011'],
  ['Marcelo Ribeiro', '+55 51 96666-1012'],
  ['Natalia Freitas', '+55 61 95555-1013'],
  ['Otavio Silveira', '+55 19 94444-1014'],
  ['Priscila Araujo', '+55 34 93333-1015'],
  ['Renato Lopes', '+55 98 92222-1016'],
  ['Sabrina Vieira', '+55 84 91111-1017'],
  ['Thiago Moreira', '+55 31 90000-1018'],
  ['Vanessa Ramos', '+55 21 98888-1019'],
  ['William Castro', '+55 47 97777-1020'],
] as const;

const tagColors: Record<string, string> = {
  Boleto: '#f59e0b',
  Reclamacao: '#ef4444',
  Venda: '#10b981',
  Entrega: '#3b82f6',
  Cancelamento: '#f43f5e',
  Proposta: '#14b8a6',
  Suporte: '#6366f1',
  Risco: '#e11d48',
};

const tagBySubject: Record<string, string[]> = {
  'Entrega atrasada': ['Entrega', 'Reclamacao', 'Risco'],
  'Troca de produto': ['Suporte', 'Entrega'],
  'Suporte tecnico': ['Suporte'],
  'Pedido sem atualizacao': ['Entrega', 'Suporte'],
  'Proposta comercial': ['Venda', 'Proposta'],
  'Plano para equipe': ['Venda', 'Proposta'],
  Negociacao: ['Venda'],
  'Condicoes de pagamento': ['Venda', 'Proposta'],
  'Segunda via de boleto': ['Boleto', 'Suporte'],
  'Boleto vencido': ['Boleto', 'Risco'],
  'Pagamento nao identificado': ['Boleto', 'Reclamacao'],
  Renegociacao: ['Boleto', 'Risco'],
  Cancelamento: ['Cancelamento', 'Reclamacao', 'Risco'],
  'Insatisfacao recorrente': ['Reclamacao', 'Risco'],
  'Pedido de retorno': ['Reclamacao'],
  Reclamacao: ['Reclamacao', 'Risco'],
  'Entrega concluida': ['Entrega'],
  Garantia: ['Suporte'],
  Acompanhamento: ['Suporte'],
  'Pesquisa de satisfacao': ['Suporte'],
};

const channels = ['WhatsApp', 'Webchat', 'Instagram', 'Facebook', 'Email'];
const salesGroups = ['JotaVendas 1', 'JotaVendas 2', 'JotaVendas 3'];

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { key: 'local-tenant' },
    update: {
      name: 'Jotanunes Demo',
      status: TenantStatus.ACTIVE,
    },
    create: {
      name: 'Jotanunes Demo',
      key: 'local-tenant',
      status: TenantStatus.ACTIVE,
    },
  });

  const roleRecords = await Promise.all(
    roles.map((role) =>
      prisma.role.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: role } },
        update: { description: `Perfil ${role} do AtendeBI` },
        create: {
          tenantId: tenant.id,
          name: role,
          description: `Perfil ${role} do AtendeBI`,
        },
      }),
    ),
  );

  const admin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'daniel.fernando@jotanunes.com',
      },
    },
    update: {
      name: 'Daniel Fernando',
      status: UserStatus.ACTIVE,
    },
    create: {
      tenantId: tenant.id,
      name: 'Daniel Fernando',
      email: 'daniel.fernando@jotanunes.com',
      status: UserStatus.ACTIVE,
    },
  });

  const adminRole = roleRecords.find((role) => role.name === 'ATENDEBI_ADMIN');
  if (adminRole) {
    await prisma.userRole.upsert({
      where: {
        tenantId_userId_roleId: {
          tenantId: tenant.id,
          userId: admin.id,
          roleId: adminRole.id,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        userId: admin.id,
        roleId: adminRole.id,
      },
    });
  }

  await prisma.integrationConfig.upsert({
    where: {
      tenantId_provider_name: {
        tenantId: tenant.id,
        provider: IntegrationProvider.BLIP,
        name: 'BLiP Demo',
      },
    },
    update: {
      tenantKey: 'local-tenant',
      isActive: true,
      settings: {
        mode: 'demo',
        webhookSecretRequired: false,
        sourceRetentionDays: 90,
        atendebiRetentionDays: 730,
      },
    },
    create: {
      tenantId: tenant.id,
      provider: IntegrationProvider.BLIP,
      name: 'BLiP Demo',
      tenantKey: 'local-tenant',
      isActive: true,
      settings: {
        mode: 'demo',
        webhookSecretRequired: false,
        sourceRetentionDays: 90,
        atendebiRetentionDays: 730,
      },
    },
  });

  await clearDemoOperationalData(tenant.id);

  const queues = await Promise.all(
    queueSeeds.map((queue) =>
      prisma.supportQueue.create({
        data: {
          tenantId: tenant.id,
          externalId: queue.externalId,
          name: queue.name,
          isActive: true,
        },
      }),
    ),
  );
  const queueByName = new Map(queues.map((queue) => [queue.name, queue]));

  const agents = await Promise.all(
    agentSeeds.map((agent) =>
      prisma.agent.create({
        data: {
          tenantId: tenant.id,
          externalId: agent.externalId,
          name: agent.name,
          email: agent.email,
          isActive: true,
        },
      }),
    ),
  );
  const agentByName = new Map(agents.map((agent) => [agent.name, agent]));

  const tags = await Promise.all(
    Object.entries(tagColors).map(([name, color]) =>
      prisma.tag.create({
        data: {
          tenantId: tenant.id,
          name,
          color,
        },
      }),
    ),
  );
  const tagByName = new Map(tags.map((tag) => [tag.name, tag]));

  const contactRecords = await Promise.all(
    contacts.map(([name, phone], index) =>
      prisma.contact.create({
        data: {
          tenantId: tenant.id,
          externalId: `contact-demo-${String(index + 1).padStart(3, '0')}`,
          name,
          phone,
          email: `${normalizeSlug(name)}@cliente-demo.com`,
          metadata: {
            source: 'seed',
            documentMasked: `***.${String(100 + index).padStart(3, '0')}.***-**`,
          },
        },
      }),
    ),
  );

  const tickets = await createTickets({
    tenantId: tenant.id,
    queueByName,
    agentByName,
    tagByName,
    contactRecords,
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: admin.id,
      action: 'seed.demo.completed',
      entityType: 'tenant',
      entityId: tenant.id,
      metadata: {
        tickets: tickets.length,
        contacts: contactRecords.length,
        queues: queues.length,
        agents: agents.length,
      },
    },
  });

  console.log(`Seed AtendeBI concluido: tenant=${tenant.key}, tickets=${tickets.length}`);
}

async function clearDemoOperationalData(tenantId: string) {
  await prisma.ticketTag.deleteMany({ where: { tenantId } });
  await prisma.aiAnalysis.deleteMany({ where: { tenantId } });
  await prisma.rating.deleteMany({ where: { tenantId } });
  await prisma.message.deleteMany({ where: { tenantId } });
  await prisma.ticket.deleteMany({ where: { tenantId } });
  await prisma.contact.deleteMany({ where: { tenantId } });
  await prisma.agent.deleteMany({ where: { tenantId } });
  await prisma.supportQueue.deleteMany({ where: { tenantId } });
  await prisma.tag.deleteMany({ where: { tenantId } });
  await prisma.auditLog.deleteMany({
    where: {
      tenantId,
      action: { startsWith: 'seed.demo' },
    },
  });
}

async function createTickets({
  tenantId,
  queueByName,
  agentByName,
  tagByName,
  contactRecords,
}: {
  tenantId: string;
  queueByName: Map<string, { id: string; name: string }>;
  agentByName: Map<string, { id: string; name: string }>;
  tagByName: Map<string, { id: string; name: string }>;
  contactRecords: Array<{ id: string; name: string | null; phone: string | null }>;
}) {
  const createdTickets = [];
  const baseDate = new Date('2026-05-30T08:00:00.000Z');

  for (let index = 0; index < 80; index += 1) {
    const queueSeed = queueSeeds[index % queueSeeds.length];
    const subject = queueSeed.subjects[index % queueSeed.subjects.length];
    const queue = queueByName.get(queueSeed.name);
    const agentSeed = agentSeeds.find((agent) => agent.queue === queueSeed.name) ?? agentSeeds[index % agentSeeds.length];
    const agent = agentByName.get(agentSeed.name);
    const contact = contactRecords[index % contactRecords.length];
    const openedAt = addMinutes(baseDate, index * 47);
    const waitMinutes = queueSeed.averageWaitMinutes + (index % 6);
    const firstResponseAt = addMinutes(openedAt, waitMinutes);
    const status = resolveTicketStatus(index);
    const closedAt = status === TicketStatus.CLOSED || status === TicketStatus.CANCELED ? addMinutes(openedAt, 45 + (index % 50)) : null;
    const tags = tagBySubject[subject] ?? ['Suporte'];
    const isComplaint = tags.includes('Reclamacao');
    const isOpportunity = tags.includes('Venda') || tags.includes('Proposta');
    const botFallback = index % 5 === 0 || subject.includes('boleto') || subject.includes('Cancelamento');
    const unresolved = status === TicketStatus.CANCELED || isComplaint || index % 9 === 0;
    const score = isComplaint ? (index % 2 === 0 ? 1 : 2) : isOpportunity ? 5 : index % 7 === 0 ? 3 : 4;
    const sentiment = score <= 2 ? 'negativo' : score >= 5 ? 'positivo' : 'neutro';
    const risk = isComplaint || unresolved || waitMinutes >= 10 ? 'alto' : waitMinutes >= 7 ? 'medio' : 'baixo';
    const group = resolveGroup(queueSeed.name, index);
    const externalId = `ticket-demo-${String(index + 1).padStart(3, '0')}`;
    const summary = buildTicketSummary(contact.name ?? 'Cliente', subject, queueSeed.name, risk);

    const ticket = await prisma.ticket.create({
      data: {
        tenantId,
        externalId,
        contactId: contact.id,
        queueId: queue?.id,
        agentId: agent?.id,
        status,
        channel: channels[index % channels.length],
        subject,
        openedAt,
        closedAt,
        firstResponseAt,
        metadata: {
          group,
          signal: isOpportunity ? 'Venda' : isComplaint ? 'Reclamacao' : botFallback ? 'Bot' : 'Operacao',
          sentiment,
          risk,
          resolutionStatus: unresolved ? 'Nao solucionado' : status === TicketStatus.CLOSED ? 'Resolvido' : 'Em andamento',
          waitMinutes,
          isComplaint,
          isOpportunity,
          botFallback,
          unresolved,
          source: 'seed',
        },
      },
    });

    await prisma.rating.create({
      data: {
        tenantId,
        ticketId: ticket.id,
        score,
        comment: score <= 2 ? 'Cliente demonstrou insatisfacao e pediu retorno objetivo.' : 'Avaliacao registrada no demo.',
        ratedAt: closedAt ?? addMinutes(openedAt, 60 + (index % 30)),
        metadata: { source: 'seed' },
      },
    });

    await prisma.message.createMany({
      data: buildMessages({
        tenantId,
        ticketId: ticket.id,
        contactId: contact.id,
        agentId: agent?.id,
        externalTicketId: externalId,
        customerName: contact.name ?? 'Cliente',
        agentName: agent?.name ?? 'Atendente',
        subject,
        openedAt,
        firstResponseAt,
        lastAt: closedAt ?? addMinutes(openedAt, 30 + (index % 20)),
        risk,
        botFallback,
      }),
      skipDuplicates: true,
    });

    for (const tagName of tags) {
      const tag = tagByName.get(tagName);

      if (tag) {
        await prisma.ticketTag.create({
          data: {
            tenantId,
            ticketId: ticket.id,
            tagId: tag.id,
          },
        });
      }
    }

    await prisma.aiAnalysis.create({
      data: {
        tenantId,
        ticketId: ticket.id,
        contactId: contact.id,
        status: AiAnalysisStatus.COMPLETED,
        topics: tags,
        sentiment,
        summary,
        riskFlags: {
          risk,
          isComplaint,
          isOpportunity,
          botFallback,
          unresolved,
          recommendedAction: buildRecommendedAction({ score, botFallback, isOpportunity, waitMinutes }),
        },
      },
    });

    createdTickets.push(ticket);
  }

  return createdTickets;
}

function buildMessages({
  tenantId,
  ticketId,
  contactId,
  agentId,
  externalTicketId,
  customerName,
  agentName,
  subject,
  openedAt,
  firstResponseAt,
  lastAt,
  risk,
  botFallback,
}: {
  tenantId: string;
  ticketId: string;
  contactId: string;
  agentId?: string;
  externalTicketId: string;
  customerName: string;
  agentName: string;
  subject: string;
  openedAt: Date;
  firstResponseAt: Date;
  lastAt: Date;
  risk: string;
  botFallback: boolean;
}) {
  const messages = [
    {
      tenantId,
      ticketId,
      contactId,
      externalId: `${externalTicketId}-msg-1`,
      direction: MessageDirection.INBOUND,
      senderName: customerName,
      content: `Oi, preciso de ajuda com ${subject.toLowerCase()}.`,
      contentType: 'text/plain',
      sentAt: openedAt,
      metadata: { senderRole: 'Cliente' },
    },
    {
      tenantId,
      ticketId,
      contactId,
      externalId: `${externalTicketId}-msg-2`,
      direction: MessageDirection.SYSTEM,
      senderName: 'Bot AtendeBI',
      content: botFallback
        ? 'Bot nao resolveu o tema e transferiu para atendimento humano.'
        : 'Bot classificou o assunto e direcionou para a fila correta.',
      contentType: 'text/plain',
      sentAt: addMinutes(openedAt, 1),
      metadata: { senderRole: 'Bot' },
    },
    {
      tenantId,
      ticketId,
      contactId,
      agentId,
      externalId: `${externalTicketId}-msg-3`,
      direction: MessageDirection.OUTBOUND,
      senderName: agentName,
      content: `Estou assumindo seu atendimento. Vou verificar o historico e tratar ${subject.toLowerCase()}.`,
      contentType: 'text/plain',
      sentAt: firstResponseAt,
      metadata: { senderRole: 'Atendente' },
    },
    {
      tenantId,
      ticketId,
      contactId,
      agentId: risk === 'alto' ? undefined : agentId,
      externalId: `${externalTicketId}-msg-4`,
      direction: risk === 'alto' ? MessageDirection.INBOUND : MessageDirection.OUTBOUND,
      senderName: risk === 'alto' ? customerName : agentName,
      content:
        risk === 'alto'
          ? 'Preciso de uma resposta objetiva, porque ja tentei resolver antes.'
          : 'O caso foi atualizado e deixei o proximo passo registrado.',
      contentType: 'text/plain',
      sentAt: lastAt,
      metadata: { senderRole: risk === 'alto' ? 'Cliente' : 'Atendente' },
    },
  ];

  return messages;
}

function resolveTicketStatus(index: number) {
  if (index % 19 === 0) {
    return TicketStatus.CANCELED;
  }

  if (index % 4 === 0) {
    return TicketStatus.CLOSED;
  }

  if (index % 5 === 0) {
    return TicketStatus.PENDING;
  }

  return TicketStatus.OPEN;
}

function resolveGroup(queue: string, index: number) {
  if (queue === 'Comercial') {
    return salesGroups[index % salesGroups.length];
  }

  if (queue === 'Financeiro') {
    return index % 2 === 0 ? 'Financeiro Critico' : 'Financeiro Rotina';
  }

  if (queue === 'Retencao') {
    return 'Retencao VIP';
  }

  if (queue === 'Pos-venda') {
    return 'Pos-venda Digital';
  }

  return index % 2 === 0 ? 'Suporte Nivel 1' : 'Suporte Nivel 2';
}

function buildTicketSummary(customerName: string, subject: string, queue: string, risk: string) {
  const riskText =
    risk === 'alto'
      ? 'Caso pede prioridade por risco de insatisfacao.'
      : risk === 'medio'
        ? 'Caso precisa acompanhamento para evitar atraso.'
        : 'Caso dentro do comportamento esperado.';

  return `${customerName} entrou em contato sobre ${subject.toLowerCase()} na fila ${queue}. ${riskText}`;
}

function buildRecommendedAction({
  score,
  botFallback,
  isOpportunity,
  waitMinutes,
}: {
  score: number;
  botFallback: boolean;
  isOpportunity: boolean;
  waitMinutes: number;
}) {
  if (score <= 2) {
    return 'Abrir revisao de qualidade, registrar causa provavel e acionar responsavel da fila.';
  }

  if (botFallback) {
    return 'Adicionar exemplo ao backlog do bot e revisar intencao que levou a transferencia.';
  }

  if (isOpportunity) {
    return 'Priorizar retorno comercial e acompanhar proposta para evitar perda por demora.';
  }

  if (waitMinutes >= 8) {
    return 'Criar alerta operacional para resposta acima de 8 minutos.';
  }

  return 'Manter acompanhamento padrao e usar como historico auditavel.';
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/(^\.|\.$)/g, '');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
