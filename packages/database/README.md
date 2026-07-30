# @solis/database

Pacote de persistência do monólito modular da Solis Plataformas.

## PostGIS

A migração inicial habilita `postgis` e mantém a coluna
`stations.location geography(Point, 4326)` como `Unsupported` no Prisma.
As coordenadas também ficam em `latitude` e `longitude` para respostas comuns.

Consultas geoespaciais devem usar SQL parametrizado com `$queryRaw`, por exemplo
`ST_DWithin(location, ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, metros)`.
O backend possui uma alternativa por latitude/longitude somente para ambientes sem
PostGIS; produção deve usar o índice GiST criado pela migração.

## Comandos

- `pnpm --filter @solis/database prisma:generate`
- `pnpm --filter @solis/database migrate:deploy`
- `pnpm --filter @solis/database seed`

O seed cria o tenant e o usuário de demonstração apenas quando
`SEED_DEMO_DATA=true`. A senha pode ser alterada por `DEMO_USER_PASSWORD`.
## Concorrencia de recarga

A migracao `202607200002_charging_session_slice` cria o ciclo canonico de estados, constraints de medidor/timestamps e o indice unico parcial `charging_sessions_connector_active_key`. O indice rejeita mais de uma sessao nao removida em `PENDING`, `AUTHORIZED`, `STARTING`, `CHARGING` ou `STOPPING` para o mesmo conector.

A aplicacao combina esse constraint com transacoes serializaveis e `updateMany` condicionado por `version`. Mudancas de estado gravam `audit_logs` e `outbox_events` na mesma transacao Prisma.

## Persistencia OCPP 1.6J

A migracao `202607210001_ocpp16_adapter` adiciona identidade e protocolo ao charge point, `last_seen_at`, estado de conexao, transacoes OCPP e mensagens correlacionadas.

`ocpp_transactions` possui identidade de protocolo monotona, relacao unica com `charging_sessions`, optimistic locking por `version` e constraints para medidores nao negativos e `meter_stop_wh >= meter_start_wh`. A aplicacao tambem rejeita cada MeterValues regressivo antes do update.

`ocpp_messages` usa a chave unica `(charge_point_id, direction, unique_id)` para devolver a mesma resposta a CALLs repetidos. O idTag efemero e persistido somente como SHA-256; a credencial Basic do carregador seed e armazenada com Argon2.

## Persistência financeira

A migração `20260729173735_payments_wallet_ledger_phase5` evolui a antiga tabela
de pagamentos sem descartar dados e adiciona carteira, contas e lançamentos de
partidas dobradas, reservas, intenções, métodos tokenizados, regras de recarga
automática, recibos, estornos, webhooks e reconciliação.

Constraints impedem valores negativos, moedas inválidas, captura superior ao
permitido e mais de um método principal ativo. Índices únicos vinculam
idempotência ao tenant e impedem uma segunda reserva ativa para a mesma sessão.
Um trigger deferred confirma que cada `ledger_transaction` contabilizada possui
débitos e créditos iguais. Outros triggers tornam transações e entries
contabilizadas imutáveis; ajustes devem ser compensatórios.

O seed financeiro é determinístico e pode ser executado repetidamente. Ele cria
uma carteira, contas, lançamentos balanceados, método mascarado, regra desativada,
intenção pendente, capturada, falha e estornada, sessão concluída e recibo. O
schema e o seed nunca armazenam PAN, CVV ou segredo do webhook.
