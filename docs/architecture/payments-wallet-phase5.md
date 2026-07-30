# Carteira, pagamentos e ledger — Fase 5

## Decisão

A Fase 5 permanece no monólito modular NestJS. O módulo `payments` contém portas
para provedores, serviços de intenção de pagamento, carteira, ledger, Pix,
métodos tokenizados, recarga automática, recibos, estornos e reconciliação. O
domínio de recarga depende apenas de `ChargingPaymentPolicy`; ele não conhece
DTOs do gateway.

`PaymentGateway` é a porta de saída. Nesta fase, `MockPaymentGateway` é o único
adaptador permitido e o backend exige `PAYMENTS_MODE=mock`. Não existe fallback
de um provedor real para o mock.

## Invariantes financeiras

- Toda quantia canônica usa `bigint` em unidade mínima e moeda ISO-4217.
- A API serializa unidades mínimas como `string`; o mobile usa `BigInt` e não
  converte o valor canônico para ponto flutuante.
- Cada lançamento do ledger tem débitos e créditos iguais. Um trigger
  PostgreSQL rejeita transações desbalanceadas.
- Lançamentos e transações contabilizadas são imutáveis. Correções usam uma
  transação compensatória.
- Uma `idempotencyKey` é vinculada ao hash do payload e ao tenant. Reutilizá-la
  com outro valor retorna `IDEMPOTENCY_PAYLOAD_CONFLICT`.
- Saldo disponível e reservado são alterados dentro de transações
  `SERIALIZABLE`, com lock da carteira e retry limitado para conflito de
  serialização.
- Webhooks usam HMAC SHA-256 sobre `timestamp.rawBody`, tolerância temporal,
  `providerEventId` único e hash do payload. Repetições idênticas não reaplicam
  crédito; a mesma identidade com payload diferente exige revisão.
- Uma falha de rede ou timeout nunca é interpretada como aprovação.
- Captura acima da autorização leva a `REQUIRES_REVIEW`; não há débito
  automático adicional.
- Auditoria e Outbox acompanham alterações relevantes, sem armazenar tokens,
  segredos, cartão completo ou CVV.

## Fluxo de sessão

1. A sessão é criada em `PENDING`.
2. `ChargingPaymentPolicy` cria uma intenção `CHARGING_AUTHORIZATION` e reserva
   o valor configurado na carteira.
3. Somente após a reserva a sessão passa a `AUTHORIZED`.
4. Ao concluir, o custo final é convertido centralmente para `Money`.
5. A reserva é capturada até o custo final e o excedente é liberado.
6. A intenção passa a `CAPTURED` e um recibo seguro é emitido.
7. Cancelamento ou falha antes da captura libera a reserva de forma idempotente.

O índice parcial de reservas ativas e a unicidade das chaves impedem dupla
autorização. O ledger registra `AUTHORIZATION`, `CAPTURE` e `RELEASE` como
efeitos distintos e rastreáveis.

## Pix e carteira

`POST /v1/users/me/wallet/top-ups` cria a intenção e retorna apenas o QR payload,
o código copia-e-cola e a expiração. A tela não altera saldo. Somente um webhook
confirmado chama `wallet.credit`. Repetir criação ou webhook produz a mesma
intenção e um único lançamento.

O extrato usa cursor opaco e pode ser filtrado por período, tipo e status. Cada
item informa a direção na perspectiva do usuário e pode referenciar a sessão e
a intenção de pagamento.

## Recarga automática

A regra nasce desativada. Ativar exige:

- consentimento explícito na mesma requisição;
- método tokenizado ativo e pertencente ao usuário;
- valores dentro da política do tenant;
- lock distribuído Redis;
- cooldown e contador de falhas.

Uma avaliação cria no máximo uma intenção por janela. Falha ou timeout entra em
cooldown e não executa loop de cobrança.

## Estorno, recibo e reconciliação

O serviço interno de estorno valida propriedade, saldo capturado restante e
idempotência. O crédito na carteira é uma compensação `REFUND`, e o recibo e a
intenção passam para `REFUNDED` ou `PARTIALLY_REFUNDED`.

O job de reconciliação usa lock Redis e compara status, moeda e valor do
provedor. Divergências são persistidas como `MISSING_AT_PROVIDER`,
`AMOUNT_MISMATCH` ou `STATUS_MISMATCH`; o job nunca corrige o ledger
silenciosamente.

## Endpoints

- `GET /v1/users/me/wallet`
- `GET /v1/users/me/wallet/transactions`
- `POST /v1/users/me/wallet/top-ups`
- `GET /v1/users/me/wallet/top-ups/:id`
- `POST /v1/users/me/wallet/top-ups/:id/cancel`
- `GET /v1/users/me/payments`
- `GET /v1/users/me/payments/:id`
- `POST /v1/users/me/payments/:id/cancel`
- `GET|POST /v1/users/me/payment-methods`
- `PATCH /v1/users/me/payment-methods/:id/default`
- `DELETE /v1/users/me/payment-methods/:id`
- `GET|PUT|DELETE /v1/users/me/wallet/auto-recharge`
- `GET /v1/users/me/charging-sessions/:id/receipt`
- `POST /v1/webhooks/payments/:provider`

## Validação

O comando integrado é:

```powershell
docker compose up --build -d
pnpm e2e:payments
```

O E2E comprova criação concorrente idempotente, conflito de payload, webhook
duplicado, crédito único, extrato, recibo mascarado e consentimento da recarga
automática. O núcleo numérico `payments/money` possui limiar Jest de 95% para
statements, functions e lines e 90% para branches, além do limiar global já
existente.

## Limitações

- O gateway é deliberadamente mock; Pix e cartão reais exigem um novo adaptador
  e homologação do provedor.
- Não há captura adicional quando o custo supera a autorização. O caso fica em
  revisão manual.
- O serviço de estorno existe para fluxo administrativo e testes, mas ainda não
  há endpoint público ou console operacional.
- O recibo é estruturado em JSON. Nota fiscal, PDF assinado e envio por e-mail
  não fazem parte desta fase.
- O worker da Outbox e a automação operacional da reconciliação em produção
  ainda exigem infraestrutura de execução e observabilidade.
