# Design system mobile Solis

## Direção

Solis combina verde esmeralda para energia sustentável, azul para confiança tecnológica e lima como acento pontual. A interface evita gradientes decorativos, preserva contraste e nunca depende somente de cor para informar status.

## Tokens

Os tokens ficam em apps/mobile-driver/src/theme/tokens.ts e cobrem cores, espaçamento, raios, tipografia e tamanhos mínimos de toque. Componentes consomem nomes semânticos como surface, text, primary e danger.

## Tema

O tema segue a preferência do sistema e possui variantes clara e escura. A cor de status é acompanhada por rótulo e ícone. Texto pode aumentar sem depender de alturas fixas.

## Componentes

- AppButton, AppIconButton e AppTextField: ações e entradas acessíveis.
- AppCard, AppModal e ConfirmationDialog: superfícies e decisões.
- LoadingState, EmptyState, ErrorState e PermissionState: estados completos.
- Componentes de domínio: estação, veículo, pagamento e métricas de recarga.

Áreas interativas usam no mínimo 44 pontos e possuem rótulo e dica para leitores de tela quando o texto visível não é suficiente. A rota /dev/components reúne o catálogo interno.
