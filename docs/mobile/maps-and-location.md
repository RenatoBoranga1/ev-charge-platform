# Mapas, localização e descoberta de estações

## Configuração

Copie `apps/mobile-driver/.env.example` para `.env` e selecione o ambiente:

```text
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_MAP_PROVIDER=platform
EXPO_PUBLIC_MAP_DEFAULT_LATITUDE=-23.55052
EXPO_PUBLIC_MAP_DEFAULT_LONGITUDE=-46.633308
GOOGLE_MAPS_ANDROID_API_KEY=
GOOGLE_MAPS_IOS_API_KEY=
```

`platform` usa Apple Maps no iOS e o provedor nativo do Android. `google`
força Google Maps também no iOS.

As chaves `GOOGLE_MAPS_*` são lidas somente pelo `app.config.ts` durante o
build nativo. O runtime recebe flags booleanas, nunca o valor da chave. Em
staging e produção uma chave obrigatória ausente desativa a visualização do
mapa e oferece a lista; em desenvolvimento/teste o mapa é permitido com aviso
explícito para facilitar Expo Go.

Chaves de mapa fazem parte do aplicativo compilado e não são segredos
criptográficos. Ainda assim, devem ficar fora do Git e ser restritas no Google
Cloud:

- Android: package name e certificados SHA-1 de debug/release;
- iOS: bundle identifier;
- habilitar somente os SDKs necessários;
- quotas, alertas e rotação por ambiente;
- usar secrets do CI/EAS para injeção no build.

## Comportamento de localização

- A permissão não aparece ao abrir a tela. Ela é solicitada somente em
  **Perto de mim** ou no botão de centralização.
- `not-requested`, `denied`, `blocked` e `granted` são estados distintos.
- Permissão aproximada é aceita e comunicada na interface.
- GPS desligado, timeout e falha nativa possuem mensagens e retry.
- Permissão bloqueada oferece atalho para as configurações do aparelho.
- O watch usa precisão balanceada, 50 m/15 s, e é removido no unmount.
- A última coordenada fica apenas em memória. Ela é enviada à API de estações
  para calcular proximidade, não é persistida pelo mobile nem registrada em
  logs.

Sem permissão ou GPS, a tela permanece útil usando a região padrão configurada.

## Descoberta

Mapa e lista consomem a mesma query React Query e a mesma pipeline:

1. origem atual ou região padrão;
2. validação de coordenadas;
3. distância Haversine;
4. filtros de disponibilidade, distância, conector, potência, corrente,
   preço, horário, estacionamento e operador;
5. busca sem distinção de acentos por nome, endereço, operador, conector ou
   código;
6. ordenação por distância, disponibilidade, potência, preço ou nome.

A busca tem limite de 120 caracteres e debounce de 250 ms. Requisições
anteriores recebem `AbortSignal`. A lista é virtualizada e o mapa agrupa
marcadores por grade de acordo com a região visível.

## Navegação externa

**Traçar rota** tenta:

- Android: `google.navigation:`;
- iOS: `maps://`;
- fallback: Google Maps web.

Coordenadas, nome e endereço são codificados. Cancelamento do usuário não é
tratado como erro; indisponibilidade gera feedback visível.

## Validação manual

No Android:

```text
pnpm --filter @solis/mobile-driver android
adb shell pm clear com.solis.platform
```

Validar:

1. primeira abertura sem prompt automático;
2. negar e depois conceder a permissão;
3. bloquear a permissão e abrir configurações;
4. desligar/ligar GPS;
5. busca com e sem acentos, limpeza e zero resultados;
6. filtros e ordenação preservados entre mapa/lista;
7. seleção de pin, cluster, card, detalhes e reserva;
8. rota externa e cancelamento;
9. offline com cache e primeira abertura offline;
10. tema claro/escuro, escala de fonte e leitor de tela.

Para dispositivo físico em modo API, use o IP da máquina em
`EXPO_PUBLIC_API_URL`. A validação de tiles em development build exige uma
chave restrita válida para a assinatura do APK instalado.

## Limitações

- Não há geocoding/autocomplete remoto nesta fase.
- O clustering em grade é suficiente para o volume atual, mas não substitui
  supercluster em catálogos de dezenas de milhares de pontos.
- Expo Go não prova a configuração da chave do binário de produção.
- Rotas são entregues ao aplicativo externo; ETA e navegação turn-by-turn não
  são calculados pela Solis.
