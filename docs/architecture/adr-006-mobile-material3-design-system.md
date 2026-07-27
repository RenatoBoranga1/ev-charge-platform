# ADR 006 — Design system Material 3 do mobile

- Status: aceito
- Data: 2026-07-24

## Contexto

O aplicativo já possuía componentes `App*`, tema claro/escuro pelo sistema e
componentes de domínio em produção. Substituir essa camada criaria migração
ampla, risco visual e quebra desnecessária de contratos.

## Decisão

Evoluir a arquitetura existente por composição:

1. introduzir tokens MD3 semânticos, sem dependência do domínio;
2. fazer o `ThemeProvider` resolver preferências persistidas e sementes de cor;
3. publicar uma API de componentes em `src/design-system`;
4. manter os componentes `App*` como adapters compatíveis;
5. manter Expo Router como infraestrutura de navegação;
6. instalar `FeedbackProvider` uma única vez no composition root;
7. validar componentes no catálogo protegido por `__DEV__`.

## Consequências

- Telas antigas recebem as novas cores sem migração total.
- Telas novas podem importar uma API pública e consistente.
- O tema pode ser trocado em runtime e permanece entre sessões.
- Material 3 é implementado sem adicionar uma biblioteca visual ou acoplar o
  produto a um fornecedor.
- Animações avançadas e transições compartilhadas permanecem para a Fase 2,
  quando Reanimated for introduzido de forma deliberada.
