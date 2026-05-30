# AtendeBI

AtendeBI e uma plataforma de inteligencia para atendimento conversacional. O objetivo do produto e coletar dados do BLiP, organizar em banco proprio e entregar visoes de BI, auditoria, qualidade, historico de conversas e gestao operacional.

Nesta primeira base, o Fluig fica fora do nucleo do produto. A aplicacao principal e composta por:

- `apps/api`: API NestJS com Prisma, Swagger, webhook BLiP e fila BullMQ.
- `apps/web`: frontend Next.js com layout inicial do dashboard.
- `packages/shared`: tipos compartilhados entre API e frontend.
- `docker-compose.yml`: PostgreSQL e Redis para desenvolvimento local.

## Requisitos

- Node.js 22 ou superior
- npm 10 ou superior
- Docker Desktop

## Como rodar localmente

1. Instale as dependencias:

```bash
npm install
```

2. Suba PostgreSQL e Redis:

```bash
docker compose up -d
```

3. Copie os arquivos de ambiente:

```bash
copy .env.example .env
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.example apps\web\.env.local
```

4. Gere o client Prisma e aplique as migrations:

```bash
npm run db:generate
npm run db:migrate
```

5. Rode API e frontend:

```bash
npm run dev
```

## Enderecos locais

- Frontend: http://localhost:3000
- API: http://localhost:3333
- Swagger/OpenAPI: http://localhost:3333/docs
- Healthcheck: http://localhost:3333/health

## Endpoints iniciais

- `GET /health`
- `POST /webhooks/blip/:tenantKey`
- `GET /dashboard/overview`
- `GET /tickets`
- `GET /tickets/:id`
- `GET /conversations/:ticketId/messages`
- `GET /queues`
- `GET /agents`

## Permissoes no MVP

A autenticacao real com Microsoft Entra ID ainda sera acoplada em fase futura. No MVP local, a API usa headers mockados para simular usuario, tenant e papeis:

```bash
curl http://localhost:3333/dashboard/overview ^
  -H "x-tenant-id: local-tenant" ^
  -H "x-user-id: local-user" ^
  -H "x-roles: ATENDEBI_ADMIN"
```

Perfis previstos:

- `ATENDEBI_ADMIN`
- `ATENDEBI_DIRETORIA`
- `ATENDEBI_GESTOR`
- `ATENDEBI_QUALIDADE`
- `ATENDEBI_COMERCIAL`
- `ATENDEBI_ATENDENTE`

Regras iniciais:

- Dashboard: admin, diretoria, gestor, qualidade e comercial.
- Tickets e historico de conversas: todos os perfis, incluindo atendente.
- Filas e atendentes: admin, diretoria, gestor e qualidade.
- Healthcheck e webhook BLiP nao usam essas permissoes mockadas.

## Decisoes importantes do MVP

- O frontend nunca chama a API do BLiP diretamente.
- Tokens e chaves do BLiP ficam somente no backend.
- Webhooks do BLiP sao salvos em `raw_events` com JSON bruto.
- O webhook responde rapido e envia processamento para fila.
- O banco ja nasce multitenant, com `tenant_id` nas tabelas principais.
- Autenticacao real via Microsoft Entra ID sera acoplada depois; por enquanto existe um guard mockado para preparar os endpoints protegidos.
- O modulo de IA fica previsto no banco, mas nao e executado no webhook nem no MVP inicial.

## Proximos passos sugeridos

1. Conectar autenticacao real com Microsoft Entra ID.
2. Implementar normalizacao dos eventos BLiP em tickets, mensagens, contatos, filas e atendentes.
3. Trocar dados mockados do frontend por chamadas reais usando TanStack Query.
4. Adicionar testes automatizados para webhook, idempotencia e permissoes.
