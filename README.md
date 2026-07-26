# Solis Plataformas

Monorepo da plataforma de recarga de veículos elétricos Solis. O aplicativo Expo existente foi preservado e agora se integra a um backend NestJS em monólito modular, com PostgreSQL/PostGIS, Prisma e Redis.

## Arquitetura

- `apps/mobile-driver`: aplicativo Expo/React Native do motorista, com modos de API `mock` e `api`.
- `apps/backend`: API NestJS versionada em `/v1`, organizada por módulos de domínio.
- `packages/database`: schema, migrações, seed e cliente Prisma compartilhado.
- `docker-compose.yml`: PostGIS, Redis, backend e Mailpit.
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
- Mailpit: `http://localhost:8025`
- PostgreSQL/PostGIS: `localhost:5432`
- Redis: `localhost:6379`
- OCPP 1.6J WebSocket: `ws://localhost:9000/ocpp/{chargePointIdentity}` com subprotocolo `ocpp1.6`

O seed de demonstração só é executado quando `SEED_DEMO_DATA=true`. No Compose, ele cria `marina.souza@example.com` com a senha definida em `DEMO_USER_PASSWORD`.

## Endpoints iniciais

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `GET /v1/users/me`
- `GET /v1/users/me/vehicles`
- `GET /v1/stations/nearby`
- `GET /v1/stations/:id`
- `POST /v1/charging-sessions/validate-qr`
- `POST /v1/charging-sessions`
- `GET /v1/charging-sessions/active`
- `GET /v1/charging-sessions/:id`
- `POST /v1/charging-sessions/:id/start`
- `POST /v1/charging-sessions/:id/stop`
- `GET /v1/charging-sessions/:id/metrics`

O QR em JSON carrega a hierarquia completa. Deep links carregam somente `connectorId`; o backend resolve connector, EVSE, charge point e estação e rejeita hierarquias divergentes.

## Banco de dados

    pnpm db:generate
    pnpm db:migrate
    set SEED_DEMO_DATA=true
    pnpm db:seed

A migração habilita PostGIS, mantém latitude/longitude para interoperabilidade e cria uma coluna `geography(Point, 4326)` com índice GiST para busca por proximidade. Consulte `packages/database/README.md` para decisões e limitações geoespaciais.

## Qualidade

    pnpm lint
    pnpm typecheck
    pnpm test -- --coverage
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

## Limitacoes atuais

- O adaptador cobre o recorte minimo solicitado de OCPP 1.6J, nao e uma implementacao completa nem certificada pela Open Charge Alliance.
- TLS/mTLS deve terminar em proxy ou load balancer na producao; o Compose local expoe WebSocket sem TLS.
- Conexoes e comandos pendentes OCPP residem em memoria de uma instancia. Escala horizontal exigira ownership distribuido e roteamento de comandos por broker ou Redis.
- Start local autonomo sem `ChargingSession` previamente correlacionada e perfis como Smart Charging, Firmware Management e Diagnostics nao fazem parte deste recorte.
- Respostas OCPP repetidas sao persistidas, mas ainda nao existe politica automatica de retencao para `ocpp_messages`.
- O simulador mantem estado em memoria e reinicia limpo.
- Socket.IO usa memoria do processo; escala horizontal exigira adapter Redis ou broker.
- A tarifa calcula energia, ativacao e tempo total como estacionamento simplificado; regras fiscais e meios de pagamento reais ainda nao foram integrados.
- O identificador de pagamento `account-default` e apenas um contrato temporario.
- Outbox e persistida, mas a entrega a um broker futuro ainda nao possui worker.
