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
