# Aplicativo mobile Solis

Aplicativo do motorista para encontrar estações, planejar viagens e acompanhar recargas.

## Instalação

Na raiz do monorepo:

    pnpm install
    copy .env.example .env
    pnpm dev:mobile

Use Node.js 22.13 ou superior.

## Variáveis

- EXPO_PUBLIC_API_MODE: mock ou api. O valor padrão em desenvolvimento é mock.
- EXPO_PUBLIC_API_URL: base HTTP do API Gateway.
- EXPO_PUBLIC_WS_URL: endpoint de atualizações em tempo real.

Não existe fallback silencioso. Em modo api, falhas reais são exibidas.

## Plataformas

- Android: pressione a no terminal do Expo ou execute pnpm --filter @solis/mobile-driver android.
- iOS: pressione i no macOS com simulador instalado.
- Expo Go: leia o QR Code do terminal com uma versão compatível com o SDK.
- Development build: recomendado para validar notificações e comportamento nativo final.

Expo Go suporta câmera, localização e mapas em cenários comuns, mas notificações push remotas e algumas configurações nativas exigem development build. Emuladores não simulam todos os recursos de câmera e localização.

## Fluxo mock

O modo mock permite testar sem backend: estações, filtros, veículo, pagamento tokenizado, pré-autorização, início, telemetria, encerramento e resumo.

Use o código manual SOLIS-001-A ou o deep link solis://charge/connectors/connector-001.

## Qualidade

    pnpm --filter @solis/mobile-driver lint
    pnpm --filter @solis/mobile-driver typecheck
    pnpm --filter @solis/mobile-driver test
    pnpm --filter @solis/mobile-driver build
