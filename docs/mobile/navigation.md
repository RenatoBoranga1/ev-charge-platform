# Navegação mobile

O Expo Router organiza as rotas por domínio. O grupo (tabs) mantém cinco áreas persistentes: Estações, Viagens, Carregar, Veículos e Perfil.

Carregar ocupa o item central, com maior ênfase visual dentro da altura da própria barra, sem sobrepor conteúdo ou a área segura. Cada domínio possui seu próprio stack para preservar contexto e botão voltar.

## Deep links

O formato principal é:

    solis://charge/connectors/{connectorId}

O parser também aceita voltway://, conforme o contrato de compatibilidade solicitado, e JSON versionado. Dados do QR nunca são tratados como autorização; o adapter sempre chama o backend ou mock explicitamente configurado.

## Rotas auxiliares

Autenticação fica em (auth). Reserva fica fora das tabs para funcionar como fluxo modal. /dev/components é exclusiva de desenvolvimento.
