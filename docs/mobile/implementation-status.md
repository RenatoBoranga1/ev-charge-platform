# Estado da implementação mobile

## Funcional

- Tabs, stacks e deep links.
- Mapa nativo, localização, busca local, marcadores acessíveis, filtros e cartão selecionado.
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
- 15 testes unitários, de componente e de integração aprovados.
- Bundle Android de produção gerado pelo Metro.

- Autenticação mock e catálogo de componentes.

## Mock explícito

Pagamentos, pré-autorização, captura, estações, reservas, usuário, veículos, roteamento e realtime. Nenhuma credencial ou integração financeira real está presente.

## Próximas integrações

API Gateway autenticado, WebSocket real, push, geocoding, clusterização de marcadores para grandes volumes e módulos backend de reserva/pagamento.
