# Perfil e Minha Garagem

## Escopo

A Fase 3 adiciona perfil persistente, preferências, consentimentos de
privacidade e gestão completa dos veículos do motorista. O fluxo funciona nos
modos explícitos `mock` e `api`; não existe fallback entre eles.

## Rotas

- `/(tabs)/profile`: resumo, avatar, métricas, configurações, LGPD e logout.
- `/(tabs)/profile/edit`: dados pessoais e URL do avatar.
- `/(tabs)/profile/settings`: tema, preferências, notificações e privacidade.
- `/(tabs)/vehicles`: Minha Garagem com busca, filtros e ordenação.
- `/(tabs)/vehicles/new`: cadastro em três etapas.
- `/(tabs)/vehicles/[vehicleId]`: detalhes e ações.
- `/(tabs)/vehicles/edit-[vehicleId]`: edição com optimistic locking.

## Componentes

- `ProfileForm`: React Hook Form + Zod para dados pessoais.
- `ProfileSettingsForm`: tema, flags de comunicação, dados e consentimentos.
- `GarageScreen`: coordena queries, busca com debounce e filtros.
- `VehicleList`: `FlatList` virtualizada com chaves estáveis.
- `VehicleCard`: resumo acessível, principal, status, conectores e placa
  mascarada.
- `VehicleForm`: cadastro/edição em três etapas.
- `VehicleDetails`: imagem, especificações, conectores e placeholders futuros.
- `VehicleEmptyState` e `VehicleSkeleton`: estados sem conteúdo e carregamento.

## Contratos de API

### Perfil

```text
GET    /v1/users/me
PATCH  /v1/users/me
DELETE /v1/users/me
```

`PATCH` e `DELETE` recebem `recordVersion`. `DELETE` apenas registra a
solicitação LGPD.

### Veículos

```text
GET    /v1/users/me/vehicles
POST   /v1/users/me/vehicles
GET    /v1/users/me/vehicles/:id
PATCH  /v1/users/me/vehicles/:id
DELETE /v1/users/me/vehicles/:id
POST   /v1/users/me/vehicles/:id/default
POST   /v1/users/me/vehicles/:id/duplicate
```

A listagem aceita:

```text
search
type=BEV|PHEV|HEV
status=ACTIVE|INACTIVE|SOLD
sortBy=nickname|brand|createdAt|year
sortOrder=asc|desc
```

## Modelo de veículo

Campos persistidos:

- apelido, marca, modelo, versão, ano e cor;
- placa e VIN opcionais;
- tipo `BEV`, `PHEV` ou `HEV`;
- bateria, autonomia, consumo, potência AC e DC;
- conectores `CCS2`, `TYPE_2`, `CHADEMO`, `NACS` e `GB_T`;
- status, principal, URL da foto e observações;
- `recordVersion`, timestamps e soft delete no backend.

## Fluxos

### Cadastro

1. O usuário informa identidade do veículo.
2. Informa energia, autonomia e potência.
3. Seleciona conectores, status e principal.
4. Zod valida localmente.
5. React Query envia para o adaptador selecionado.
6. Sucesso invalida `['vehicles']`; erro permanece visível.

### Alteração do principal

1. O detalhe envia `recordVersion`.
2. O backend verifica status ativo.
3. A transação desmarca o principal anterior e marca o novo.
4. O índice parcial protege contra concorrência.
5. A query da garagem é invalidada.

### Remoção

1. Um dialog acessível pede confirmação.
2. O backend rejeita veículo com recarga ativa.
3. O registro recebe `deletedAt`.
4. Se necessário, outro ativo é promovido.
5. Histórico, auditoria e Outbox são preservados.

## Estado e cache

React Query armazena perfil e veículos. As chaves principais são:

```text
['profile']
['vehicles', filters]
['vehicles', vehicleId]
```

Zustand não replica esses objetos. Ele mantém somente preferências imediatas do
dispositivo; após salvar configurações, o estado local é sincronizado com a
resposta da API.

## Acessibilidade

- Campos possuem labels e erros com `accessibilityRole="alert"`.
- Cards anunciam apelido, modelo, status e veículo principal.
- Botões informam estado `busy` e `disabled`.
- Placa e VIN são mascarados na apresentação.
- Dialogs e Bottom Sheets são modais para o leitor de tela.
- Controles têm área mínima e suportam escala de fonte do sistema.
- Skeleton é ocultado da árvore de acessibilidade.

Validar manualmente com TalkBack e VoiceOver, inclusive foco após abrir/fechar
dialogs e sheets.

## Performance

- `FlatList` limita o lote inicial, batch e janela de renderização.
- Busca usa debounce antes de alterar a query.
- Callbacks de navegação e render da lista são estáveis.
- Perfil e garagem não duplicam estado remoto no Zustand.
- Filtros fazem parte da query key e evitam cache incorreto.

## Testes

A suíte cobre:

- perfil, preferências e solicitação LGPD;
- CRUD, busca, filtros, ordenação, principal, duplicação e remoção;
- optimistic locking e constraints no PostgreSQL;
- adaptadores REST e mock;
- formulários Zod e mensagens;
- labels, hints, estados vazios e cards acessíveis.

## Limitações

- Avatar é informado por URL; seleção/upload nativo ainda não existe.
- Exclusão registra uma solicitação, não remove dados automaticamente.
- Estatísticas e sessões do veículo serão integradas em fases futuras.
- Não há modo offline ou merge visual de conflitos.
- Homologação final de TalkBack/VoiceOver exige dispositivos reais.
