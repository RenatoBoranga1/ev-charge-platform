# ADR 007 — Mapa, localização e descoberta de estações no mobile

- Status: aceito
- Data: 2026-07-27

## Contexto

O aplicativo já possuía Expo Router, React Query, Zustand, contratos
`StationsApi`, os modos explícitos `mock`/`api` e uma primeira tela com
`react-native-maps`. A tela acessava `expo-location` diretamente, mantinha
busca apenas local e não tratava de forma uniforme permissão bloqueada, GPS
desligado, cancelamento, configuração do provedor ou grandes quantidades de
marcadores.

Substituir a arquitetura ou introduzir um serviço de mapas no domínio
acoplaria regras de produto a SDKs nativos e prejudicaria testes.

## Decisão

Evoluir a arquitetura existente por portas e funções puras:

1. `app.config.ts` injeta configuração nativa em build time. Chaves não são
   copiadas para `extra`; o runtime recebe apenas flags de disponibilidade.
2. `LocationService` encapsula Expo Location, estados de permissão, precisão,
   GPS, timeout, cancelamento e lifecycle do watch.
3. `StationsApi.getNearby` continua sendo a porta de dados e recebe origem e
   `AbortSignal`. Os adaptadores REST e mock preservam o mesmo contrato.
4. React Query mantém o estado remoto e cancela requisições obsoletas. Zustand
   mantém somente estado de interação compartilhado entre mapa e lista.
5. Busca, distância Haversine, filtros e ordenação são uma pipeline pura e
   determinística. Mapa e lista consomem exatamente sua mesma saída.
6. Clustering usa uma grade independente de `react-native-maps`; assim a regra
   é testável e pode ser trocada por supercluster sem afetar o domínio.
7. Navegação externa é uma capability isolada, com Google Navigation/Apple
   Maps e fallback web explícito.
8. Em staging/produção, configuração nativa ausente bloqueia o mapa e mantém a
   lista funcional. Desenvolvimento/teste permitem renderizar com aviso para
   suportar Expo Go.

## Consequências

- O domínio de estações não importa DTOs de Expo, Google ou Apple.
- Localização nunca é solicitada automaticamente; negar acesso preserva a
  descoberta pela região padrão.
- Watches e requests são cancelados ao desmontar ou substituir uma operação.
- Mapa/lista, busca, filtros, seleção e ordenação não divergem.
- O grid de clustering é deliberadamente simples; não é um índice geoespacial
  nem substitui o PostGIS do backend.
- Geocoding e autocomplete remoto permanecem fora desta fase. A busca atual
  opera sobre os resultados retornados por `GET /v1/stations/nearby`.

## Alternativas rejeitadas

- Acessar Expo Location diretamente na tela: mistura UI, permissão e lifecycle.
- Guardar a lista remota no Zustand: duplicaria cache e invalidação do React
  Query.
- Fazer fallback silencioso de API para mock: viola o contrato operacional.
- Colocar a chave nativa em variável `EXPO_PUBLIC_*`: expõe configuração no
  bundle JavaScript e dificulta restrições por aplicativo.
