# ADR-009 — Dashboard e histórico de recargas

- Status: aceito
- Data: 2026-07-28
- Escopo: Fase 4 do aplicativo do motorista

## Contexto

Sessões, medições, tarifas, veículos e estações já pertencem ao monólito
modular. O mobile precisava apresentar agregados e histórico sem transferir
regras de negócio, carregar todos os `MeterValue` ou conhecer payloads OCPP.

## Decisão

Foram criadas duas fronteiras no monólito:

- `DashboardModule`: consulta agregada por motorista, tenant, período e veículo;
- `ChargingHistoryModule`: listagem por cursor, detalhes seguros, timeline e
  métricas reduzidas.

O domínio existente de charging permanece responsável por criar e alterar
sessões. Os novos módulos são read models e não criam uma segunda máquina de
estados. Eles também não importam DTOs OCPP.

## Contratos HTTP

Todos exigem JWT:

- `GET /v1/users/me/dashboard`
- `GET /v1/users/me/charging-sessions`
- `GET /v1/users/me/charging-sessions/:id`
- `GET /v1/users/me/charging-sessions/:id/timeline`
- `GET /v1/users/me/charging-sessions/:id/metrics`

O dashboard recebe `from`, `to`, `timezone` e `vehicleId`. A listagem acrescenta
`status`, `stationId`, `connectorType`, `search`, `withCost`, `failuresOnly`,
`completedOnly`, `sort`, `cursor` e `limit`.

## Paginação e ordenação

A listagem usa keyset pagination. O cursor contém o valor da ordenação, o UUID
da sessão e o sort, codificados em Base64 URL e assinados com HMAC-SHA256. A
assinatura é comparada em tempo constante. Cursor alterado, malformado ou usado
com outro sort retorna `INVALID_CURSOR`. A assinatura usa
`HISTORY_CURSOR_SECRET`, obrigatoriamente diferente de `JWT_ACCESS_SECRET`.

A ordenação acontece no PostgreSQL por:

- data recente ou antiga;
- energia ascendente ou descendente;
- duração ascendente ou descendente;
- custo ascendente ou descendente.

O UUID é o desempate estável. O cliente nunca usa offset nem ordena a coleção
completa.

## Tempo, energia e potência

A duração usa `startedAt` e, em ordem, `completedAt`, `stoppedAt` ou um instante
`asOf` único capturado para toda a paginação quando a sessão ainda está aberta.
Exibição, ordenação e cursor usam o mesmo instante. Valores negativos são
limitados a zero. Uma sessão aberta não é apresentada como concluída.

A energia usa o valor consolidado não negativo de `ChargingSession.energyKwh`.
A máquina de estados de charging continua responsável por consolidá-lo a partir
de medidores monotônicos; este read model não recalcula nem corrige medidores.

Potência média e máxima são calculadas somente sobre `MeterValue.powerKw`
existentes. Sem amostras confiáveis, ambos os campos são `null`.

## Métricas e timeline

O endpoint de métricas executa downsampling no PostgreSQL, com no máximo 120
pontos por resposta. Retorna energia acumulada, potência e timestamp, além da
contagem original e retornada. O primeiro e o último `MeterValue` são sempre
preservados. Nenhum frame OCPP bruto é exposto.

A timeline deriva somente eventos seguros de auditoria da sessão e a primeira
medição. Ela pode conter criação, autorização, início, parada, conclusão,
cancelamento e falha. Eventos são ordenados por timestamp.

## Valores monetários e estimativas

Valores monetários permanecem `Decimal` no Prisma e são serializados como
string decimal junto da moeda obtida exclusivamente de `tariffSnapshot`; a
relação com a tarifa atual não participa do read model. Custo só é exposto para
sessão concluída, moeda ISO de três letras e valor não negativo.

Não existe metodologia aprovada nesta fase para economia ou CO₂ evitado. O
backend retorna `null` e o mobile omite os cards. Não há cálculo, fatura ou
arredondamento monetário no mobile.

## Timezone e períodos

Sem intervalo explícito, o dashboard usa o mês corrente no timezone IANA
informado. `from` e `to` são obrigatórios em conjunto, o início não pode superar
o fim e o intervalo máximo é 366 dias. Datas futuras são rejeitadas pelo
seletor mobile e o backend mantém a validação autoritativa do intervalo.

## Segurança

Todas as consultas contêm:

- `ChargingSession.userId = JWT.sub`;
- `Station.tenantId = JWT.tenantId`;
- `deletedAt IS NULL` para sessão e estação;
- verificação adicional de ownership do veículo filtrado.

A resposta exclui hashes, tokens, frames OCPP, stack traces, objetos
administrativos e dados de outros motoristas. Validação global e rate limiting
existentes permanecem ativos.

## Performance e índices

A migration `202607280001_dashboard_history_phase4` adiciona índices compostos
para os caminhos de cursor e filtros:

- `(user_id, started_at, id)`;
- `(user_id, status, started_at, id)`;
- `(user_id, vehicle_id, started_at, id)`;
- `(user_id, station_id, started_at, id)`;
- `(user_id, connector_id, started_at, id)`.

A primeira consulta seleciona somente IDs e sort value. Uma segunda consulta
Prisma carrega relações explícitas de uma única página, preservando a ordem e
evitando N+1 e `SELECT *`.

## Mobile e cache

React Query separa cache por usuário e inclui filtros nas chaves. A lista usa
`useInfiniteQuery`, `FlatList`, cursor, pull-to-refresh e cancelamento por
`AbortSignal`. Ao encerrar uma carga, somente dashboard, histórico e detalhes
daquela sessão são invalidados.

Os adaptadores `mock` e `api` implementam o mesmo contrato. O modo `api` não
recua para dados mock em falha.

## Consequências e limitações

- Agregações são calculadas sob demanda; materialized views poderão ser
  avaliadas quando volume e telemetria real justificarem.
