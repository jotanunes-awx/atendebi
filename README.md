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

## Rodar tudo com Docker em desenvolvimento

Para nao precisar abrir um terminal para API e outro para frontend, use o Compose de desenvolvimento. Ele sobe PostgreSQL, Redis, API NestJS e Web Next.js juntos.

1. Garanta que os arquivos `.env`, `apps/api/.env` e `apps/web/.env.local` existem.

2. Suba tudo:

```bash
npm run docker:dev
```

Ou em segundo plano:

```bash
npm run docker:dev:detached
```

3. Acompanhe os logs da API e do frontend:

```bash
npm run docker:logs
```

4. Rode o seed dentro do container da API:

```bash
npm run docker:seed
```

5. Pare os containers:

```bash
npm run docker:down
```

O modo Docker usa hot reload. Quando voce alterar arquivos em `apps/api/src` ou `apps/web/src`, API e frontend recompilam automaticamente.

### Alternativa recomendada para servidor Linux

Se o servidor apresentar erro do npm dentro do container, use o compose de servidor. Ele usa o `node_modules` instalado no proprio host Linux e evita rodar `npm install` dentro do Docker.

1. Instale dependencias e prepare o Prisma no host:

```bash
npm install
npm run db:generate
npm run db:deploy
```

2. Suba API e frontend em Docker:

```bash
npm run docker:server:detached
```

3. Acompanhe logs:

```bash
npm run docker:server:logs
```

4. Pare:

```bash
npm run docker:server:down
```

Esse modo tambem tem hot reload, mas depende da pasta `node_modules` local do servidor. A API nao roda `prisma generate` a cada subida do container; quando houver migration nova, rode `npm run db:generate` e `npm run db:deploy` antes de subir novamente.

No modo servidor, o frontend fica publicado por padrao em `3001` para evitar conflito com ferramentas que usam `3000`, como Flowise. O log do container ainda pode mostrar `--port 3000`; isso e a porta interna do Next.js dentro do Docker.

Para acessar por IP, deixe no `.env`:

```env
WEB_PORT=3001
NEXT_PUBLIC_API_URL=http://192.168.79.63:3333
NEXT_ALLOWED_DEV_ORIGINS=192.168.79.63
CORS_ORIGIN=http://192.168.79.63:3001,http://localhost:3001,http://localhost:3000
```

Depois suba novamente:

```bash
npm run docker:server:detached
```

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

## Autenticacao e permissoes

O AtendeBI suporta dois modos de autenticacao:

- `AUTH_MODE=mock`: padrao do MVP local. A API usa headers para simular usuario, tenant e papeis.
- `AUTH_MODE=entra`: a API valida `Authorization: Bearer <token>` emitido pelo Microsoft Entra ID.

No modo local/mock:

```bash
curl http://localhost:3333/dashboard/overview ^
  -H "x-tenant-id: local-tenant" ^
  -H "x-user-id: local-user" ^
  -H "x-roles: ATENDEBI_ADMIN"
```

Para habilitar Entra ID real no frontend e na API, configure:

```env
AUTH_MODE=entra
AUTH_TENANT_KEY=local-tenant
ENTRA_TENANT_ID=ID_DO_DIRETORIO_LOCATARIO
ENTRA_CLIENT_ID=ID_DO_APP_REGISTRATION_DO_FRONTEND
ENTRA_API_AUDIENCE=api://ID_OU_URI_DA_API
ENTRA_DEFAULT_ROLE=ATENDEBI_ADMIN

NEXT_PUBLIC_AUTH_MODE=entra
NEXT_PUBLIC_ENTRA_TENANT_ID=ID_DO_DIRETORIO_LOCATARIO
NEXT_PUBLIC_ENTRA_CLIENT_ID=ID_DO_APP_REGISTRATION_DO_FRONTEND
NEXT_PUBLIC_ENTRA_REDIRECT_URI=http://localhost:3000
NEXT_PUBLIC_ENTRA_API_SCOPE=api://ID_OU_URI_DA_API/access_as_user
NEXT_PUBLIC_ATENDEBI_TENANT_KEY=local-tenant
NEXT_PUBLIC_ATENDEBI_DEFAULT_ROLE=ATENDEBI_ADMIN
```

No Azure, o App Registration usado para login precisa ter uma Redirect URI do tipo SPA para a URL do frontend e a API precisa expor um scope, por exemplo `access_as_user`. Enquanto os app roles corporativos nao forem configurados, `ENTRA_DEFAULT_ROLE` permite manter o piloto andando com um perfil padrao.

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
- Healthcheck e webhook BLiP nao usam essas permissoes.

## Decisoes importantes do MVP

- O frontend nunca chama a API do BLiP diretamente.
- Tokens e chaves do BLiP ficam somente no backend.
- Webhooks do BLiP sao salvos em `raw_events` com JSON bruto.
- O webhook responde rapido e envia processamento para fila.
- O worker tenta normalizar `Contact`, `Ticket` e `Message` a partir do evento recebido.
- O webhook tem validacao opcional de secret via header `x-atendebi-webhook-secret`.
- O banco ja nasce multitenant, com `tenant_id` nas tabelas principais.
- O AtendeBI guarda historico proprio em PostgreSQL para BI e auditoria, sem depender da retencao curta da plataforma origem.
- A autenticacao Entra ID ja esta preparada em modo hibrido: mock para desenvolvimento e Bearer token real para homologacao.
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

## BLiP com key real

Com a key de acesso do BLiP, o AtendeBI fica com dois caminhos:

- Webhook: recebe eventos novos em tempo real e salva o JSON bruto em `raw_events`.
- Sync por API: usa a Commands API para puxar contatos e mensagens recentes para `contacts`, `tickets` e `messages`.

Importante: a key nunca deve ficar no frontend, no GitHub ou em prints. Coloque somente no `.env` da API no servidor.

Exemplo de configuracao no `.env` da API:

```env
BLIP_ENABLED=true
BLIP_SYNC_ENABLED=true
BLIP_BOT_KEY=cole-a-key-somente-no-servidor
BLIP_CONTRACT_ID=jotanunes
BLIP_HTTP_BASE_URL=https://jotanunes.http.msging.net
BLIP_SYNC_INCLUDE_ATTENDANTS=true
BLIP_SYNC_ATTENDANT_LIMIT=1000
BLIP_SYNC_CONTACT_LIMIT=200
BLIP_SYNC_THREAD_MESSAGES_PER_CONTACT=20
BLIP_SYNC_INCLUDE_LOGGED_MESSAGES=false
```

Se preferir, use `BLIP_HTTP_BASE_URL` diretamente. Se preencher apenas `BLIP_CONTRACT_ID`, a API monta `https://SEU_CONTRATO.http.msging.net/commands`.

Teste a conexao:

```bash
curl -X POST http://localhost:3333/integrations/BLIP/test \
  -H "x-tenant-id: local-tenant" \
  -H "x-roles: ATENDEBI_ADMIN"
```

Execute a carga inicial/backfill:

```bash
curl -X POST http://localhost:3333/integrations/BLIP/sync \
  -H "x-tenant-id: local-tenant" \
  -H "x-roles: ATENDEBI_ADMIN"
```

O retorno informa quantos atendentes, contatos e mensagens foram importados. Leads/clientes entram como `contacts`; corretores, atendentes e funcionarios do atendimento entram como `agents` quando o endpoint do BLiP Desk estiver disponivel para a key. Se algum endpoint de historico ou atendentes nao estiver liberado no contrato, o sync termina com aviso e mantem o que conseguiu importar. Para historico muito antigo, podemos criar uma etapa separada de importacao dos logs antigos do servidor legado.

## Integracoes GLPI e Teams/PABX

GLPI e o caminho mais simples para testar dados reais agora, porque normalmente basta habilitar a API REST e gerar tokens de aplicacao/usuario. Configure no `.env` da API:

```env
GLPI_BASE_URL=https://glpi.suaempresa.com
GLPI_APP_TOKEN=seu-app-token
GLPI_USER_TOKEN=seu-user-token
GLPI_SYNC_ENABLED=false
GLPI_SYNC_LIMIT=0
GLPI_SYNC_PAGE_SIZE=100
GLPI_SYNC_MAX_PAGES=1000
GLPI_SYNC_ACTIVE_ONLY=false
GLPI_SYNC_STATUSES=
GLPI_SYNC_DAYS=0
```

Por padrao o sincronismo percorre paginas da API do GLPI e tenta guardar todo o historico no banco do AtendeBI. `GLPI_SYNC_LIMIT=0` significa sem limite de quantidade; use um numero positivo apenas se quiser limitar um teste. O dashboard continua abrindo em `Ativos agora`, entao chamados antigos ficam disponiveis para busca/auditoria sem poluir a visao operacional. Se quiser sincronizar apenas chamados ativos, use `GLPI_SYNC_ACTIVE_ONLY=true` e informe `GLPI_SYNC_STATUSES=1,2,3,4,7`.

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
TEAMS_GRAPH_BASE_URL=https://graph.microsoft.com
TEAMS_GRAPH_PSTN_VERSION=beta
TEAMS_GRAPH_DIRECT_ROUTING_VERSION=v1.0
TEAMS_SYNC_DAYS=7
TEAMS_SYNC_MAX_PAGES=20
TEAMS_SYNC_INCLUDE_PSTN=true
TEAMS_SYNC_INCLUDE_DIRECT_ROUTING=true
```

Permissoes Graph previstas para o piloto:

- `CallRecords.Read.All`

Para configurar o Teams Phone/PABX, crie um App Registration no Microsoft Entra ID, gere um Client Secret, adicione a permissao **Application** `CallRecords.Read.All` em Microsoft Graph e clique em **Grant admin consent**. Depois rode:

```bash
curl -X POST http://localhost:3333/integrations/TEAMS_PHONE/test ^
  -H "x-tenant-id: local-tenant" ^
  -H "x-roles: ATENDEBI_ADMIN"

curl -X POST http://localhost:3333/integrations/TEAMS_PHONE/sync ^
  -H "x-tenant-id: local-tenant" ^
  -H "x-roles: ATENDEBI_ADMIN"
```

No MVP, `/integrations/GLPI/test` valida a conexao real via `initSession`. `/integrations/GLPI/sync` busca chamados no GLPI, salva `raw_events` e normaliza dados para `contacts`, `queues`, `agents`, `tickets`, `messages` e tags. Sempre que o GLPI permitir, o conector tambem tenta resolver nome do solicitante, tecnico, grupo, entidade e categoria para evitar telas com IDs soltos. `/integrations/TEAMS_PHONE/test` valida token e permissao no Microsoft Graph. `/integrations/TEAMS_PHONE/sync` busca logs PSTN e Direct Routing, salva `raw_events` e normaliza chamadas para contatos, filas, atendentes, tickets, mensagens e tags.

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

1. Configurar App Registration de login com scope `access_as_user` e app roles AtendeBI.
2. Expor a API local via tunnel HTTPS ou publicar ambiente de homologacao.
3. Configurar webhook real no BLiP apontando para `/webhooks/blip/:tenantKey`.
4. Refinar o conector GLPI com anexos, historico completo e sincronismo incremental agendado.
5. Refinar Teams Phone com filas reais, usuarios do Entra e reconciliacao com PABX.
6. Capturar payloads reais e ajustar normalizacao fina dos conectores.
7. Usar API do BLiP somente no backend para backfill/historico, quando necessario.
8. Adicionar testes automatizados para webhook, idempotencia e permissoes.
