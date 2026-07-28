# Dashboard e histórico de recargas

## Objetivo

A Fase 4 transforma sessões já persistidas em um dashboard do motorista,
histórico paginado, detalhes, timeline e métricas. Não cria cobrança nem altera
o fluxo de recarga, OCPP, mapa, autenticação, perfil ou garagem.

## Rotas mobile

- `/(tabs)/dashboard`: dashboard autenticado;
- `/(tabs)/history`: histórico com filtros e carregamento incremental;
- `/(tabs)/history/[sessionId]`: detalhes carregados sob demanda;
- `/(tabs)/profile/charging-history`: atalho legado, agora usando o contrato
  paginado.

A aba inicial exibe o dashboard. Histórico e planejamento de viagem permanecem
rotas ocultas no tab bar para não aumentar a quantidade de destinos primários.

## Componentes

Dashboard:

- `DashboardScreen`, `DashboardHeader`, `DashboardGreeting`;
- `DashboardPeriodSelector`, `PrimaryVehicleSummary`;
- cards de sessões, energia, duração e custo confiável;
- `LastChargingSessionCard`, `FavoriteStationCard`, `QuickActions`;
- skeleton, vazio e erro com retry.

Histórico:

- `ChargingHistoryScreen`, `ChargingHistoryList`, `ChargingHistoryItem`;
- filtros de período, veículo, estação/busca, status e conector;
- toggles de custo, falha e conclusão;
- ordenação completa;
- skeleton, vazio, erro, retry, pull-to-refresh e estado desatualizado.

Detalhes:

- `ChargingSessionDetailsScreen`;
- `ChargingSessionTimeline`;
- `ChargingSessionEnergyChart` com resumo acessível.

## DTOs

`DashboardData` contém `period`, `summary`, `lastSession`,
`mostUsedStation`, `mostUsedConnector` e `primaryVehicle`.

`ChargingHistoryPage` contém:

```text
items: ChargingHistoryItem[]
pageInfo:
  endCursor: string | null
  hasNextPage: boolean
```

Custos usam `{ amount: string, currency: string }`. Campos opcionais sem fonte
confiável são `null`; não são substituídos por zero.

## Filtros e ordenação

Filtros enviados ao backend:

- `from`, `to`, `timezone`;
- `vehicleId`, `stationId`, `status`, `connectorType`;
- `search`, `withCost`, `failuresOnly`, `completedOnly`;
- `limit`, `cursor`.

Sorts: `RECENT`, `OLDEST`, `ENERGY_DESC`, `ENERGY_ASC`,
`DURATION_DESC`, `DURATION_ASC`, `COST_DESC` e `COST_ASC`.

O status usa a union existente: `pending`, `authorized`, `starting`,
`charging`, `stopping`, `completed`, `failed` e `cancelled`. O adaptador REST
converte apenas a representação HTTP para o enum do backend.

## Períodos e timezone

Há presets de mês atual, 7 dias e 30 dias. O período personalizado valida:

- formato de data;
- início anterior ou igual ao fim;
- fim não futuro;
- máximo de 366 dias.

Datas são enviadas em ISO-8601 e acompanhadas pelo timezone IANA do dispositivo.
O backend é a fonte autoritativa para agregações.

## Cache e rede

As chaves são:

- `dashboardKeys.all(userId)` e `detail(userId, query)`;
- `chargingHistoryKeys.all(userId)` e `list(userId, filters)`;
- `chargingSessionKeys` por usuário, sessão e recurso.

`useInfiniteQuery` recebe o cursor do último pageInfo. O `AbortSignal` da query é
encaminhado ao `fetch`. Retry é limitado, e falha em modo `api` aparece na tela;
não existe fallback para `mock`.

Ao concluir uma sessão, `invalidateChargingHistory` invalida somente:

- dashboard do usuário;
- listas de histórico do usuário;
- detalhe da sessão concluída.

Consultas de mapa, perfil e garagem não são invalidadas.

## Estados de interface

- carregamento inicial com skeleton;
- vazio para período sem sessões;
- ausência de veículo principal;
- erro com retry;
- pull-to-refresh;
- aviso de dados possivelmente desatualizados após falha com cache;
- spinner de página seguinte;
- fallback textual quando não existem métricas suficientes.

Conflitos de autenticação continuam sendo tratados pelo cliente REST e pelo
`AuthProvider` existentes.

## Acessibilidade

Cards do histórico têm label com estação, data, energia, status e moeda quando
presente. Status aparece por texto e não apenas por cor. Estados de erro usam
role `alert`; ações mantêm tamanho mínimo do Design System. O gráfico usa role
`image`, descrição de quantidade de pontos, potência média/máxima e fallback
textual.

Validação manual de TalkBack/VoiceOver, escala máxima de fonte e foco em
dispositivo físico permanece necessária antes de homologação nativa.

## Métricas e gráfico

O mobile solicita no máximo 60 pontos por padrão. O backend limita a 120 e faz
downsampling. Com menos de duas medições o gráfico não é inventado: a tela
explica que não há histórico suficiente.

Energia, duração, potência e custo chegam prontos. O mobile apenas formata
unidades, datas e moeda.

## Modos de API

`EXPO_PUBLIC_API_MODE=mock` usa dados determinísticos com os mesmos filtros,
sorts, cursor e DTOs. `EXPO_PUBLIC_API_MODE=api` usa os endpoints reais. Um erro
de rede ou configuração no modo real permanece erro.

## Testes

Mobile cobre:

- serialização de endpoints e cancelamento;
- mock, agregados, cursor, filtros, detalhes, timeline e métricas;
- períodos personalizados;
- isolamento e invalidação de cache;
- cards opcionais ocultos;
- retry e semântica acessível do item e gráfico.

Backend cobre unidade e PostgreSQL para período/timezone, cursor assinado,
agregados, vazio, ownership de veículo, paginação, filtros, sorts, custo,
detalhes, timeline, downsampling e isolamento por usuário/tenant.

## Troubleshooting

- Dashboard vazio em `mock`: selecione período que inclua julho de 2026 ou
  conclua uma sessão no fluxo.
- `INVALID_CURSOR`: descarte as páginas da query e refaça a primeira requisição;
  não reutilize cursor com outro sort.
- Métricas vazias: confirme que a sessão recebeu `MeterValues`.
- Custo ausente: confirme sessão concluída e snapshot com moeda válida. O app
  não cria preço quando a origem é insuficiente.
- Erro de timezone: envie um identificador IANA, como `America/Sao_Paulo`.
