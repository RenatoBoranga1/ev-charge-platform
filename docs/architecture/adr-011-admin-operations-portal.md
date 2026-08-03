# ADR-011 — Portal administrativo e operações de estações

- Status: aceito para implementação incremental
- Data: 2026-08-03
- Decisores: engenharia Solis

## Contexto

A Solis precisa expor a operação B2B sem misturar a experiência do motorista,
sem duplicar regras de recarga, OCPP ou pagamentos e sem abrir acesso entre
tenants. A autenticação mobile existente usa tokens no cliente, enquanto um
portal web pode proteger melhor a credencial duradoura com cookie HttpOnly.

## Decisão

Criamos `apps/admin-web` como aplicação React/Vite separada e mantemos o NestJS
como fonte de verdade. `AdminModule` é uma fachada de orquestração dentro do
monólito modular: ele consulta os mesmos modelos Prisma e delega ações críticas
a `ChargingService`, `RefundService`, reconciliação, auditoria e Outbox. Não há
um segundo serviço de domínio nem um microsserviço administrativo.

Os contratos neutros de plataforma ficam em `packages/admin-contracts` e os
tokens visuais em `packages/design-tokens`. Componentes React Native não são
importados no portal.

O fluxo administrativo usa:

- access token de 15 minutos somente em memória;
- refresh token rotativo em cookie HttpOnly, `Secure` em produção;
- cookie CSRF de dupla submissão para refresh;
- RBAC derivado de `OperatorMembership` e `OperatorRoleAssignment` do tenant;
- proteção do último `TENANT_ADMIN` em transação `SERIALIZABLE`;
- proibição de atribuir papéis com permissões superiores às do ator;
- auditoria com snapshots saneados e correlation ID;
- idempotência, auditoria e Outbox atômicas para comandos remotos;
- paginação por cursor e filtros executados no PostgreSQL.

O frontend usa TanStack Query para estado remoto, React Hook Form + Zod para
formulários e Zustand apenas para sessão efêmera e estado de interface. Ações
irreversíveis não recebem atualização otimista.

## Consequências

O portal pode ser implantado como imagem Nginx não root e escalado
independentemente da API. Recarregar a página exige refresh válido, pois o
access token não é persistido. Uma alteração de papel ou bloqueio passa a valer
na próxima requisição e revoga tokens de refresh quando aplicável.

O `AdminOperationsService` concentra a fachada nesta primeira entrega para não
duplicar módulos de domínio. Ele deve ser dividido em submódulos administrativos
quando o volume de regras de orquestração justificar, preservando as mesmas
portas.

## Alternativas rejeitadas

- Next.js: não há necessidade de SSR e adicionaria outra runtime de servidor.
- Guardar refresh token em localStorage: amplia o impacto de XSS.
- Novo backend administrativo: duplicaria autenticação, transações e regras.
- Expor todos os comandos OCPP: o adaptador atual só garante Remote Start/Stop.

## Limitações conhecidas do draft

- O portal usa polling controlado; não foi criada uma segunda infraestrutura
  realtime.
- O CRUD visual completo de charge points/EVSEs/conectores, restauração de
  estação e edição versionada de tarifa ainda não está exposto.
- Convites são persistidos com token em hash, mas entrega, reenvio, aceitação e
  cancelamento ainda dependem de um fluxo de e-mail posterior.
- A conciliação permite execução tenant-scoped; resolução manual e observações
  ainda não alteram estado.
- O CSV síncrono é limitado a 10.000 sessões; volumes maiores exigirão job
  assíncrono com arquivo expirável.
- Apenas Remote Start e Remote Stop aparecem como suportados. Reset, Unlock,
  Change Availability e Get Configuration permanecem bloqueados.
