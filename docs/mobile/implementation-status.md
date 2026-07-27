# Estado da implementação mobile

## Funcional

- Tabs, stacks e deep links.
- Mapa nativo configurável, localização sob demanda, clusters, pins semânticos, busca, filtros, ordenação, mapa/lista sincronizados, rota externa e cartão selecionado.
- Detalhe e reserva mock.
- Planejador de viagem mock.
- Aviso persistente, câmera real, QR e código manual.
- Preparação, seleção, pré-autorização mock, início idempotente e timeout.
- Sessão realtime, encerramento e resumo financeiro.
- Lista, cadastro em etapas e edição de veículos.
- Perfil, pagamentos, Pix mock, histórico, reservas, cupons, cobrança, preferências e suporte.
## Qualidade validada

- Dependências compatíveis com Expo SDK 56.
- TypeScript estrito sem erros.
- ESLint sem erros ou avisos.
- 93 testes mobile unitários, de componente e de integração aprovados na Fase 2.
- Bundle Android de produção gerado pelo Metro.

- Autenticação mock e catálogo de componentes.

## Mock explícito

Pagamentos, pré-autorização, captura, estações, reservas, usuário, veículos, roteamento e realtime. Nenhuma credencial ou integração financeira real está presente.

## Próximas integrações

Push, geocoding/autocomplete, supercluster para volumes muito grandes e integrações reais de reserva/pagamento.
