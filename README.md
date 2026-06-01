# AtendeBI

AtendeBI e uma plataforma de inteligencia para atendimento conversacional e operacional. O objetivo do produto e coletar dados de origens como BLiP, GLPI e Teams Phone/PABX, organizar em banco proprio e entregar visoes de BI, auditoria, qualidade, historico de conversas, chamados e filas.

Nesta primeira base, o Fluig fica fora do nucleo do produto. A aplicacao principal e composta por:

- `apps/api`: API NestJS com Prisma, Swagger, webhook BLiP e fila BullMQ.
- `apps/web`: frontend Next.js com dashboard, drill-downs, historico, bot, vendas e configuracoes.
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
npm run db:seed
```

O seed cria o tenant `local-tenant`, o usuario admin mockado, roles e configuracoes de integracao. Por padrao ele nao cria tickets ficticios. As telas ficam vazias ate voce sincronizar uma origem real, como GLPI, Teams/PABX ou BLiP.

Para uma apresentacao sem integracao real, habilite dados demo antes do seed:

```env
ATENDEBI_DEMO_DATA=true
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

## Acesso por IP em servidor de teste

Quando o Next.js roda em modo desenvolvimento e o acesso vem por outro host/IP, configure o IP do servidor em `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://192.168.79.63:3333
NEXT_ALLOWED_DEV_ORIGINS=192.168.79.63
```

Depois reinicie o frontend:

```bash
npm run dev -w @atendebi/web -- --hostname 0.0.0.0 --port 3001
```

## Endpoints principais do MVP

- `GET /health`
- `POST /webhooks/blip/:tenantKey`
- `GET /dashboard/overview`
- `GET /dashboard/drilldown?type=Atendimentos`
- `GET /tickets`
- `GET /tickets/:id`
- `GET /conversations/:ticketId/messages`
- `GET /queues`
- `GET /queues/:id`
- `GET /agents`
- `GET /agents/:id`
- `GET /quality/overview`
- `GET /bot/overview`
- `GET /sales/overview`
- `GET /settings/overview`
- `GET /integrations`
- `GET /integrations/:provider`
- `POST /integrations/:provider/test`
- `POST /integrations/:provider/sync`

Providers aceitos em `/integrations/:provider`:

- `BLIP`
- `GLPI`
- `TEAMS_PHONE`

## Permissoes no MVP

A autenticacao real com Microsoft Entra ID ainda sera acoplada em fase futura. No MVP local, a API usa headers mockados para simular usuario, tenant e papeis:

```bash
curl http://localhost:3333/dashboard/overview ^
  -H "x-tenant-id: local-tenant" ^
  -H "x-user-id: local-user" ^
  -H "x-roles: ATENDEBI_ADMIN"
```

Exemplos uteis depois do seed:

```bash
curl http://localhost:3333/tickets ^
  -H "x-tenant-id: local-tenant" ^
  -H "x-roles: ATENDEBI_ADMIN"

curl http://localhost:3333/conversations/ID_DO_TICKET/messages ^
  -H "x-tenant-id: local-tenant" ^
  -H "x-roles: ATENDEBI_ADMIN"

curl http://localhost:3333/quality/overview ^
  -H "x-tenant-id: local-tenant" ^
  -H "x-roles: ATENDEBI_ADMIN"

curl http://localhost:3333/settings/overview ^
  -H "x-tenant-id: local-tenant" ^
  -H "x-roles: ATENDEBI_ADMIN"

curl http://localhost:3333/integrations ^
  -H "x-tenant-id: local-tenant" ^
  -H "x-roles: ATENDEBI_ADMIN"

curl -X POST http://localhost:3333/integrations/GLPI/test ^
  -H "x-tenant-id: local-tenant" ^
  -H "x-roles: ATENDEBI_ADMIN"

curl -X POST http://localhost:3333/integrations/TEAMS_PHONE/test ^
  -H "x-tenant-id: local-tenant" ^
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
- O worker tenta normalizar `Contact`, `Ticket` e `Message` a partir do evento recebido.
- O webhook tem validacao opcional de secret via header `x-atendebi-webhook-secret`.
- O banco ja nasce multitenant, com `tenant_id` nas tabelas principais.
- O AtendeBI guarda historico proprio em PostgreSQL para BI e auditoria, sem depender da retencao curta da plataforma origem.
- Autenticacao real via Microsoft Entra ID sera acoplada depois; por enquanto existe um guard mockado para preparar os endpoints protegidos.
- O modulo de IA fica previsto no banco, mas nao e executado no webhook nem no MVP inicial.

## Webhook BLiP no MVP local

Por padrao, o ambiente local permite testar webhook sem secret:

```env
WEBHOOK_SECRET_REQUIRED=false
BLIP_WEBHOOK_SECRET=change-me
```

Para simular uma configuracao mais segura, altere para:

```env
WEBHOOK_SECRET_REQUIRED=true
BLIP_WEBHOOK_SECRET=um-segredo-forte
```

Exemplo de evento BLiP mockado sem secret:

```bash
curl -X POST http://localhost:3333/webhooks/blip/local-tenant ^
  -H "Content-Type: application/json" ^
  -d "{\"id\":\"evt-local-001\",\"type\":\"text/plain\",\"from\":\"551199990001@wa.gw.msging.net\",\"to\":\"bot@msging.net\",\"content\":\"Quero cancelar porque o bot nao resolveu.\",\"queue\":{\"name\":\"Retencao\"},\"agent\":{\"name\":\"Ana Lima\"},\"contact\":{\"name\":\"Cliente Teste\",\"phone\":\"+55 11 99990-0001\"}}"
```

Exemplo com secret habilitado:

```bash
curl -X POST http://localhost:3333/webhooks/blip/local-tenant ^
  -H "Content-Type: application/json" ^
  -H "x-atendebi-webhook-secret: um-segredo-forte" ^
  -d "{\"id\":\"evt-local-002\",\"type\":\"text/plain\",\"from\":\"551199990002@wa.gw.msging.net\",\"content\":\"Preciso da segunda via do boleto.\",\"queue\":{\"name\":\"Financeiro\"}}"
```

Depois de enviar, consulte:

```bash
curl "http://localhost:3333/tickets?search=Cliente%20Teste" ^
  -H "x-tenant-id: local-tenant" ^
  -H "x-roles: ATENDEBI_ADMIN"
```

## Integracoes GLPI e Teams/PABX

GLPI e o caminho mais simples para testar dados reais agora, porque normalmente basta habilitar a API REST e gerar tokens de aplicacao/usuario. Configure no `.env` da API:

```env
GLPI_BASE_URL=https://glpi.suaempresa.com
GLPI_APP_TOKEN=seu-app-token
GLPI_USER_TOKEN=seu-user-token
GLPI_SYNC_ENABLED=false
GLPI_SYNC_LIMIT=50
```

Depois rode:

```bash
npm run db:seed
curl -X POST http://localhost:3333/integrations/GLPI/test ^
  -H "x-tenant-id: local-tenant" ^
  -H "x-roles: ATENDEBI_ADMIN"

curl -X POST http://localhost:3333/integrations/GLPI/sync ^
  -H "x-tenant-id: local-tenant" ^
  -H "x-roles: ATENDEBI_ADMIN"
```

Teams Phone/PABX depende de uma App Registration no Microsoft Entra ID, permissao de administrador e Microsoft Graph:

```env
TEAMS_TENANT_ID=00000000-0000-0000-0000-000000000000
TEAMS_CLIENT_ID=00000000-0000-0000-0000-000000000000
TEAMS_CLIENT_SECRET=seu-client-secret
TEAMS_SYNC_ENABLED=false
TEAMS_GRAPH_SCOPES=https://graph.microsoft.com/.default
```

Permissoes Graph previstas para o piloto:

- `CallRecords.Read.All`
- `Reports.Read.All`

No MVP, `/integrations/GLPI/test` valida a conexao real via `initSession`. `/integrations/GLPI/sync` busca chamados no GLPI, salva `raw_events` e normaliza dados para `contacts`, `queues`, `agents`, `tickets`, `messages` e tags. O conector Teams/PABX ainda fica preparado em modo dry-run ate ligarmos Microsoft Graph.

## Status do MVP local

O MVP local esta considerado fechado quando:

- Docker sobe PostgreSQL e Redis.
- Migrations e seed rodam.
- API abre em `http://localhost:3333`.
- Swagger abre em `http://localhost:3333/docs`.
- Frontend abre em `http://localhost:3000`.
- Dashboard e paginas internas consomem a API real, sem preencher tickets ficticios por padrao.
- `/bot`, `/vendas` e `/configuracoes` existem.
- Webhook salva `raw_events`, enfileira e normaliza dados basicos.
- Configuracoes leem `/settings/overview`.
- Typecheck e build passam.

## Proximos passos para piloto

1. Conectar autenticacao real com Microsoft Entra ID.
2. Expor a API local via tunnel HTTPS ou publicar ambiente de homologacao.
3. Configurar webhook real no BLiP apontando para `/webhooks/blip/:tenantKey`.
4. Refinar o conector GLPI com busca incremental, entidades, tecnicos reais e anexos/historico completo.
5. Conectar Teams Phone via Microsoft Graph Call Records e relatarios de chamadas.
6. Capturar payloads reais e ajustar normalizacao fina dos conectores.
7. Usar API do BLiP somente no backend para backfill/historico, quando necessario.
8. Adicionar testes automatizados para webhook, idempotencia e permissoes.
