# Solis Plataformas

Monorepo para uma plataforma de recarga de veículos elétricos. A primeira entrega funcional é o aplicativo mobile do motorista, criado com Expo, React Native, Expo Router e TypeScript estrito.

## Estado atual

- Aplicativo mobile navegável com dados mock explícitos.
- Fluxo de estações, planejamento de viagem, recarga simulada, veículos e perfil.
- Scanner real por Expo Camera e alternativa por código manual.
- Atualização periódica de uma sessão ativa por adapter de tempo real mock.
- Estrutura preparada para alternar entre API mock e REST/WebSocket reais.

## Requisitos

- Node.js 22.13 ou superior.
- pnpm 10.
- Expo Go compatível ou development build do Expo.

## Execução rápida

    pnpm install
    copy .env.example .env
    pnpm dev:mobile

No terminal do Expo, use a para Android, i para iOS em macOS, ou leia o QR Code no Expo Go.

## Qualidade

    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build

Consulte o guia em apps/mobile-driver/README.md e a documentação em docs/mobile.
