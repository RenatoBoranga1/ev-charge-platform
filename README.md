# Solis Plataformas

Monorepo da plataforma de recarga de veículos elétricos Solis. O aplicativo Expo existente foi preservado e agora se integra a um backend NestJS em monólito modular, com PostgreSQL/PostGIS, Prisma e Redis.

## Arquitetura

- `apps/mobile-driver`: aplicativo Expo/React Native do motorista, com modos de API `mock` e `api`.
- `apps/admin-web`: portal React/Vite para operadores, com sessão segura, RBAC tenant-scoped e identidade Solis.
- `apps/backend`: API NestJS versionada em `/v1`, organizada por módulos de domínio.
- `packages/database`: schema, migrações, seed e cliente Prisma compartilhado.
- `packages/admin-contracts`: papéis, permissões e contratos administrativos neutros.
- `packages/design-tokens`: tokens Solis compartilhados entre web e mobile.
- `docker-compose.yml`: PostGIS, Redis, backend, simulador, portal administrativo e Mailpit.
- `.github/workflows/ci.yml`: lint, typecheck, testes com cobertura e build.

O backend permanece um único deploy. As fronteiras modulares, o contrato `OutboxPublisher` e a tabela `outbox_events` preservam o caminho para extração futura sem introduzir Kafka nesta fase.

## Requisitos

- Node.js 22.13 ou superior.
- pnpm 10.15.1.
- Docker Desktop para o ambiente integrado.
- Expo Go compatível ou development build do Expo para o mobile.

## Instalação

    pnpm install --frozen-lockfile
    copy .env.example .env

## Mobile

Para trabalhar com os dados locais do aplicativo:

    set EXPO_PUBLIC_API_MODE=mock
    pnpm dev:mobile

Para consumir o backend real, configure explicitamente:

    set EXPO_PUBLIC_API_MODE=api
    set EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
    pnpm dev:mobile

Use `localhost` no simulador iOS e o IP da máquina em dispositivo físico. O modo `api` nunca recua silenciosamente para `mock`; erros de configuração ou rede são exibidos.

Tokens de acesso e refresh são armazenados com Expo SecureStore. Rotas internas exigem sessão, a rota de catálogo de componentes só existe em desenvolvimento e credenciais de demonstração só são exibidas pela interface no modo `mock`.

## Ambiente integrado

Suba toda a infraestrutura e a API:

    docker compose up --build -d

O container do backend aguarda PostGIS e Redis, aplica as migrações, executa o seed idempotente e inicia a API.

- Health check: `http://localhost:8000/health`
- Swagger: `http://localhost:8000/docs`
- Portal administrativo: `http://localhost:4173`
- Mailpit: `http://localhost:8025`
- PostgreSQL/PostGIS: `localhost:5432`
- Redis: `localhost:6379`
- OCPP 1.6J WebSocket: `ws://localhost:9000/ocpp/{chargePointIdentity}` com subprotocolo `ocpp1.6`

O seed de demonstração só é executado quando `SEED_DEMO_DATA=true`. No Compose, ele cria `marina.souza@example.com` com a senha definida em `DEMO_USER_PASSWORD` e o operador `admin@solis.local` com `DEMO_ADMIN_PASSWORD`.

## Endpoints iniciais

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `GET /v1/users/me`
- `PATCH /v1/users/me`
- `DELETE /v1/users/me`
- `GET /v1/users/me/vehicles`
- `POST /v1/users/me/vehicles`
- `GET /v1/users/me/vehicles/:id`
- `PATCH /v1/users/me/vehicles/:id`
- `DELETE /v1/users/me/vehicles/:id`
- `POST /v1/users/me/vehicles/:id/default`
- `POST /v1/users/me/vehicles/:id/duplicate`
- `GET /v1/users/me/dashboard`
- `GET /v1/users/me/charging-sessions`
- `GET /v1/users/me/charging-sessions/:id`
- `GET /v1/users/me/charging-sessions/:id/timeline`
- `GET /v1/users/me/charging-sessions/:id/metrics`
- `GET /v1/stations/nearby`
- `GET /v1/stations/:id`
- `POST /v1/charging-sessions/validate-qr`
- `POST /v1/charging-sessions`
- `GET /v1/charging-sessions/active`
- `GET /v1/charging-sessions/:id`
- `POST /v1/charging-sessions/:id/start`
- `POST /v1/charging-sessions/:id/stop`
- `GET /v1/charging-sessions/:id/metrics`
- `GET /v1/users/me/wallet`
- `GET /v1/users/me/wallet/transactions`
- `POST /v1/users/me/wallet/top-ups`
- `GET /v1/users/me/wallet/top-ups/:id`
- `POST /v1/users/me/wallet/top-ups/:id/cancel`
- `GET /v1/users/me/payments`
- `GET /v1/users/me/payments/:id`
- `POST /v1/users/me/payments/:id/cancel`
- `GET /v1/users/me/payment-methods`
- `POST /v1/users/me/payment-methods`
- `PATCH /v1/users/me/payment-methods/:id/default`
- `DELETE /v1/users/me/payment-methods/:id`
- `GET|PUT|DELETE /v1/users/me/wallet/auto-recharge`
- `GET /v1/users/me/charging-sessions/:id/receipt`
- `POST /v1/webhooks/payments/:provider`

Perfil e garagem usam optimistic locking por `recordVersion`, soft delete,
auditoria e Outbox. O PostgreSQL garante um único veículo principal ativo por
usuário. Consulte `docs/architecture/adr-008-profile-and-smart-garage.md` e
`docs/mobile/profile-and-garage.md`.

Dashboard e histórico usam agregações no backend, paginação por cursor assinado,
filtros e ordenação no PostgreSQL, timeline segura e métricas com downsampling.
Valores monetários permanecem `Decimal` e são serializados como string com
moeda. Economia e CO₂ retornam `null` e ficam ocultos enquanto não houver
metodologia confiável. Consulte
`docs/architecture/adr-009-dashboard-and-charging-history.md` e
`docs/mobile/dashboard-and-charging-history.md`.

A identidade do produto separa **Solar Soluções** (empresa) de **Solis**
(produto) por uma configuração central de marca. Os nove arquivos oficiais
foram incorporados sem alterações de pixels e estão catalogados em
`docs/brand/brand-assets.md`, com origem, dimensões, hashes SHA-256 e finalidade
de cada variante. A ordem textual fornecida divergia do conteúdo visual dos
arquivos; por isso, a classificação foi feita pelo conteúdo e registrada
explicitamente.

Os ativos oficiais agora alimentam o ícone do aplicativo, splash screen,
adaptive icon, ícone monocromático, favicon e marcas exibidas no aplicativo.
A paleta foi extraída objetivamente do símbolo oficial limpo e está documentada
em `docs/brand/color-palette.md` e `docs/brand/palette-extraction.json`. Ela
ainda não foi homologada por um manual de marca com códigos oficiais. A
homologação nativa em APK e dispositivo físico também permanece pendente; por
isso, o PR da fase continua em draft. Consulte
`docs/architecture/adr-010-solar-solucoes-brand-system.md` e
`docs/mobile/solar-solucoes-branding.md`.

O QR em JSON carrega a hierarquia completa. Deep links carregam somente `connectorId`; o backend resolve connector, EVSE, charge point e estação e rejeita hierarquias divergentes.

## Portal administrativo

O portal B2B é servido separadamente do mobile. O access token administrativo
permanece somente em memória; o refresh rotativo usa cookie HttpOnly e proteção
CSRF. Papéis e permissões são derivados do `OperatorMembership` ativo no tenant,
e toda autorização é repetida no backend.

    pnpm --filter @solis/admin-web dev
    pnpm --filter @solis/admin-web test -- --coverage
    pnpm --filter @solis/admin-web e2e
    pnpm e2e:admin

Os endpoints usam `/v1/admin`, incluindo autenticação, dashboard, mapa, estações,
hierarquia de recarga, tarifas versionadas, sessões, comandos remotos,
motoristas, pagamentos/estornos, conciliação, operadores, auditoria e CSV. O
Swagger em `/docs` contém o contrato executável.

A arquitetura, papéis, procedimentos e ameaças estão documentados em
`docs/architecture/adr-011-admin-operations-portal.md`, `docs/admin` e
`docs/security/admin-portal-threat-model.md`. O PR permanece draft enquanto as
limitações registradas no ADR-011 não forem eliminadas ou formalmente aceitas.

## Banco de dados

    pnpm db:generate
    pnpm db:migrate
    set SEED_DEMO_DATA=true
    pnpm db:seed

A migração habilita PostGIS, mantém latitude/longitude para interoperabilidade e cria uma coluna `geography(Point, 4326)` com índice GiST para busca por proximidade. Consulte `packages/database/README.md` para decisões e limitações geoespaciais.

## Qualidade

    pnpm lint
    pnpm typecheck
    pnpm test -- -- --coverage
    pnpm build

A cobertura mínima inicial é 80% para statements, 70% para branches, 75% para functions e 80% para lines.

Mais detalhes do cliente estão em `apps/mobile-driver/README.md` e `docs/mobile`.

## Vertical slice de recarga

O novo workspace `apps/charger-simulator` executa um simulador HTTP sem OCPP, isolado do monolito pelo contrato `ChargerGateway`.

A sessao percorre `PENDING -> AUTHORIZED -> STARTING -> CHARGING -> STOPPING -> COMPLETED`. `FAILED` e `CANCELLED` sao estados terminais alternativos. O backend valida cada transicao, usa `version` para optimistic locking, grava auditoria e Outbox na mesma transacao e exige `Idempotency-Key` em create, start e stop.

O banco possui indice unico parcial para impedir duas sessoes ativas no mesmo conector. Meter values atualizam energia, potencia, duracao, custo e bateria estimada. O snapshot da tarifa preserva o preco contratado mesmo que a tarifa vigente mude.

O realtime usa Socket.IO no namespace `/charging`, com JWT no handshake. O cliente assina `charging:subscribe`, recebe imediatamente o estado atual e depois eventos `charging:metrics`. Em perda de conexao, o mobile reconecta e tambem recupera o snapshot por `GET /metrics`; isso nao ativa fallback para mock.

O simulador registra conectores, aceita start/stop idempotentes, publica MeterValues e suporta os cenarios `normal`, `fail-after-3` e `disconnect-after-3` por `SIMULATOR_SCENARIO`. Para executar o fluxo integrado:

    docker compose up --build -d
    pnpm e2e:charging

O E2E autentica o usuario seed, lista estacoes e veiculos, cria a sessao, comprova o bloqueio concorrente, repete start/stop com a mesma chave, consulta metricas e valida o resumo final.

## Adaptador OCPP 1.6J

O modulo `apps/backend/src/ocpp` adiciona um servidor WebSocket OCPP 1.6J ao mesmo monolito, em uma porta separada da API HTTP. `RoutingChargerGateway` consulta o protocolo do charge point e delega para `SimulatorChargerGateway` ou `Ocpp16ChargerGateway`; assim, o dominio de recarga continua dependendo apenas da porta generica `ChargerGateway` e o simulador HTTP permanece disponivel.

O recorte implementa `BootNotification`, `Heartbeat`, `StatusNotification`, `Authorize`, `StartTransaction`, `MeterValues`, `StopTransaction`, `RemoteStartTransaction` e `RemoteStopTransaction`. CALL, CALLRESULT e CALLERROR usam `uniqueId`, timeout e cache persistente de respostas para repeticoes. Identidade, conexao, `lastSeenAt`, transacao OCPP e mensagens correlacionadas sao persistidas; tokens efemeros ficam somente como SHA-256 e a senha Basic do seed como hash Argon2.

O seed registra `SOLIS-OCPP-001` com senha definida por `OCPP_DEMO_PASSWORD`. Para validar o fluxo completo:

    docker compose up --build -d
    pnpm e2e:ocpp

O E2E OCPP conecta com `ocpp1.6`, executa boot/heartbeat/status, recebe start remoto, autoriza e inicia a transacao, envia medidores, recebe stop remoto e conclui a mesma `ChargingSession`. A decisao e os limites estao em `docs/architecture/ocpp-16-adapter.md`.

## Carteira e pagamentos

A carteira Solis usa ledger de partidas dobradas, valores `bigint` em unidades
mínimas, transações PostgreSQL `SERIALIZABLE`, locks, optimistic locking e
idempotência vinculada ao payload. Um trigger impede lançamentos
desbalanceados e lançamentos contabilizados são imutáveis.

O adaptador atual é `MockPaymentGateway` e só opera com `PAYMENTS_MODE=mock`.
Pix credita saldo exclusivamente após webhook HMAC confirmado; duplicação,
concorrência, timeout e repetição com payload divergente são tratadas sem
duplicar crédito. A recarga de sessão reserva saldo, captura o custo final,
libera o excedente e emite recibo seguro. Recarga automática exige consentimento
explícito, lock Redis e cooldown.

Para executar o fluxo financeiro completo:

    docker compose up --build -d
    pnpm e2e:payments

O E2E valida criação concorrente, idempotência, webhook duplicado, crédito
único, extrato, recibo e consentimento. Consulte
`docs/architecture/payments-wallet-phase5.md` para invariantes, endpoints e
limitações.

## Limitacoes atuais

- O portal administrativo ainda não expõe CRUD visual completo de charge
  points/EVSEs/conectores, restauração de estação, resolução manual de
  conciliação ou ciclo completo de convites.
- O realtime administrativo usa polling controlado; Socket.IO continua sendo
  usado apenas no fluxo de recarga existente.
- Somente Remote Start e Remote Stop são executáveis pelo portal; os demais
  comandos permanecem bloqueados até suporte comprovado no adaptador.
- O adaptador cobre o recorte minimo solicitado de OCPP 1.6J, nao e uma implementacao completa nem certificada pela Open Charge Alliance.
- TLS/mTLS deve terminar em proxy ou load balancer na producao; o Compose local expoe WebSocket sem TLS.
- Conexoes e comandos pendentes OCPP residem em memoria de uma instancia. Escala horizontal exigira ownership distribuido e roteamento de comandos por broker ou Redis.
- Start local autonomo sem `ChargingSession` previamente correlacionada e perfis como Smart Charging, Firmware Management e Diagnostics nao fazem parte deste recorte.
- Respostas OCPP repetidas sao persistidas, mas ainda nao existe politica automatica de retencao para `ocpp_messages`.
- O simulador mantem estado em memoria e reinicia limpo.
- Socket.IO usa memoria do processo; escala horizontal exigira adapter Redis ou broker.
- A tarifa calcula energia, ativacao e tempo total como estacionamento simplificado; regras fiscais ainda nao foram integradas.
- O provedor financeiro atual e mock; Pix e cartão reais dependem de homologacao e de um novo adaptador `PaymentGateway`.
- Outbox e persistida, mas a entrega a um broker futuro ainda nao possui worker.
