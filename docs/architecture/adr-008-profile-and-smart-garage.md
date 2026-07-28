# ADR 008 — Perfil e garagem inteligente

- Status: aceito
- Data: 2026-07-28

## Contexto

A Fase 3 precisa persistir o perfil completo do motorista e permitir vários
veículos por usuário sem substituir o monólito modular, os contratos mobile
`mock`/`api`, o design system Material 3 ou a arquitetura de recarga existente.

O cadastro de veículo será consumido posteriormente por sessões, histórico,
recomendações, consumo e autonomia. Portanto, remoção física, atualização sem
controle de versão e regras de veículo principal apenas na interface criariam
inconsistências difíceis de corrigir.

## Decisão

### Backend e persistência

1. `UsersModule` e `VehiclesModule` continuam dentro do monólito NestJS.
2. `VehicleRepository` é a porta interna de persistência. A implementação
   Prisma pode ser substituída sem expor tipos do banco aos controllers.
3. Perfil e veículo usam `version` como optimistic locking. O mobile envia
   `recordVersion`; updates com versão antiga retornam conflito.
4. Veículos usam soft delete. Sessões e auditoria preservam a referência
   histórica.
5. Um índice único parcial no PostgreSQL garante no banco apenas um veículo
   principal ativo por usuário. Promoção e troca também ocorrem em transação.
6. Placa e VIN ativos são únicos por usuário, sem distinção de caixa.
7. Alterações relevantes gravam `audit_logs` e `outbox_events` na mesma
   transação. A Outbox permanece a integração preparada para broker futuro.
8. Preferências, notificações e consentimentos de privacidade são documentos
   JSON pequenos e versionados junto ao usuário. Eles não justificam tabelas
   próprias nesta fase.
9. Exclusão de conta registra `accountDeletionRequestedAt`; não remove dados
   automaticamente sem confirmação de identidade e política de retenção.

### Mobile

1. React Query é a fonte de estado remoto para perfil e garagem.
2. React Hook Form e Zod controlam todos os formulários e mensagens.
3. Zustand continua reservado às preferências imediatas do dispositivo. Após
   salvar no servidor, tema e flags locais são sincronizados.
4. Os adaptadores REST e mock implementam exatamente `UsersApi` e
   `VehiclesApi`. O modo `api` nunca recua para mock.
5. `GarageScreen` usa busca com debounce, filtros, ordenação e `FlatList`.
6. `VehicleForm`, `VehicleCard`, `VehicleList`, `VehicleEmptyState`,
   `VehicleSkeleton` e `VehicleDetails` reutilizam o design system existente.
7. Placa e VIN são mascarados na apresentação; valores completos só trafegam
   no formulário autenticado e na API.

## Invariantes

- O primeiro veículo do usuário se torna principal.
- Somente veículo ativo pode ser principal.
- O principal não pode ser desmarcado sem selecionar outro.
- Ao remover o principal, o veículo ativo mais antigo é promovido.
- Veículo com sessão de recarga ativa não pode ser removido.
- BEV e PHEV exigem ao menos um conector; HEV pode não usar recarga externa.
- Operações concorrentes com a mesma versão permitem somente um vencedor.
- Busca e filtros nunca alteram o estado persistido.

## Consequências

### Positivas

- Regras críticas são protegidas pelo serviço e pelo PostgreSQL.
- O histórico permanece referencialmente íntegro após remoção da garagem.
- Mobile real e mock exercitam os mesmos fluxos.
- As fronteiras suportam evolução futura sem criar um microsserviço prematuro.
- Auditoria e Outbox deixam perfil e garagem preparados para integrações.

### Custos

- Clientes precisam tratar conflito de versão e atualizar a query.
- Documentos JSON exigirão migration se suas estruturas se tornarem extensas.
- A troca de veículo principal pode incrementar a versão de mais de um
  registro.

## Alternativas rejeitadas

- Guardar veículos somente no Zustand: não atende persistência nem concorrência.
- Remover veículo fisicamente: quebra histórico e auditoria.
- Controlar principal apenas no mobile: permite inconsistência por API direta.
- Criar microsserviço de garagem: adiciona custo operacional sem necessidade.
- Fazer upload binário nesta fase: exige storage, antivírus e ciclo de retenção
  ainda não definidos.

## Limitações

- A foto usa URL HTTPS; upload/crop e armazenamento de mídia ficam para uma
  fase com política de storage.
- O fluxo LGPD registra a solicitação, mas não executa purge automático.
- Estatísticas e sessões na tela de detalhes são placeholders explícitos.
- Busca textual no backend é case-insensitive; busca sem acentos depende de
  extensão ou índice específico futuro.
- Não há sincronização offline nem resolução visual avançada de conflitos.
