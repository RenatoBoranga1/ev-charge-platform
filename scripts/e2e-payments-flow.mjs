import { createHash, createHmac } from 'node:crypto';

const baseUrl = process.env.API_URL ?? 'http://localhost:8000';
const webhookSecret =
  process.env.PAYMENT_WEBHOOK_SECRET ??
  'local-compose-payment-webhook-secret-change-me';
const runId = Date.now().toString(36);

async function request(path, options = {}) {
  const response = await fetch(baseUrl + path, options);
  const raw = await response.text();
  const body = raw ? JSON.parse(raw) : null;
  if (!response.ok) {
    const error = new Error(
      `HTTP ${response.status} ${path}: ${JSON.stringify(body)}`,
    );
    error.status = response.status;
    throw error;
  }
  return body;
}

function authenticated(accessToken, options = {}) {
  return {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  };
}

const login = await request('/v1/auth/login', {
  body: JSON.stringify({
    email: 'marina.souza@example.com',
    password: process.env.DEMO_USER_PASSWORD ?? 'solis-demo',
  }),
  headers: { 'Content-Type': 'application/json' },
  method: 'POST',
});
const accessToken = login.tokens.accessToken;
const walletBefore = await request(
  '/v1/users/me/wallet',
  authenticated(accessToken),
);

const topUpKey = `e2e-payments-${runId}`;
const topUpBody = {
  amountMinor: '5000',
  currency: 'BRL',
  idempotencyKey: topUpKey,
  method: 'PIX',
  scenario: 'pending',
};
const [created, concurrentReplay] = await Promise.all([
  request(
    '/v1/users/me/wallet/top-ups',
    authenticated(accessToken, {
      body: JSON.stringify(topUpBody),
      method: 'POST',
    }),
  ),
  request(
    '/v1/users/me/wallet/top-ups',
    authenticated(accessToken, {
      body: JSON.stringify(topUpBody),
      method: 'POST',
    }),
  ),
]);
if (created.id !== concurrentReplay.id) {
  throw new Error('Concurrent top-up requests created different intents.');
}

let payloadConflict = false;
try {
  await request(
    '/v1/users/me/wallet/top-ups',
    authenticated(accessToken, {
      body: JSON.stringify({ ...topUpBody, amountMinor: '6000' }),
      method: 'POST',
    }),
  );
} catch (error) {
  payloadConflict = error.status === 409;
}
if (!payloadConflict) {
  throw new Error('Idempotency payload conflict was not rejected.');
}

const providerKey = `topup:${login.user.id}:${topUpKey}`;
const providerReference = `mock_pix_${createHash('sha256')
  .update(JSON.stringify(providerKey))
  .digest('hex')
  .slice(0, 24)}`;
const webhookBody = JSON.stringify({
  amountMinor: '5000',
  currency: 'BRL',
  eventType: 'PIX_CONFIRMED',
  providerEventId: `e2e-provider-${runId}`,
  providerReference,
  status: 'APPROVED',
});
const timestamp = Date.now().toString();
const signature = createHmac('sha256', webhookSecret)
  .update(`${timestamp}.${webhookBody}`)
  .digest('hex');
const webhookOptions = {
  body: webhookBody,
  headers: {
    'Content-Type': 'application/json',
    'X-Payment-Signature': signature,
    'X-Payment-Timestamp': timestamp,
  },
  method: 'POST',
};
const confirmed = await request(
  '/v1/webhooks/payments/solis-mock',
  webhookOptions,
);
const duplicate = await request(
  '/v1/webhooks/payments/solis-mock',
  webhookOptions,
);
if (confirmed.duplicate || !duplicate.duplicate) {
  throw new Error('Webhook duplicate semantics are invalid.');
}

const [captured, walletAfter, transactions, receipt] = await Promise.all([
  request(
    `/v1/users/me/wallet/top-ups/${created.id}`,
    authenticated(accessToken),
  ),
  request('/v1/users/me/wallet', authenticated(accessToken)),
  request('/v1/users/me/wallet/transactions', authenticated(accessToken)),
  request(
    '/v1/users/me/charging-sessions/b0000000-0000-4000-8000-000000000002/receipt',
    authenticated(accessToken),
  ),
]);
if (captured.status !== 'CAPTURED') {
  throw new Error(`Expected captured top-up, got ${captured.status}.`);
}
if (
  BigInt(walletAfter.availableBalanceMinor) -
    BigInt(walletBefore.availableBalanceMinor) !==
  5000n
) {
  throw new Error('Wallet was not credited exactly once.');
}
if (
  !transactions.items.some(
    (item) =>
      item.paymentIntentId === created.id &&
      item.amountMinor === '5000' &&
      item.type === 'TOP_UP',
  )
) {
  throw new Error('Top-up ledger movement was not exposed in the statement.');
}
if (!receipt.receiptNumber || receipt.payment.reference?.length > 15) {
  throw new Error('Receipt is missing or exposes an unsafe reference.');
}

const methods = await request(
  '/v1/users/me/payment-methods',
  authenticated(accessToken),
);
const card = methods.find(
  (method) => method.type === 'CARD' && method.status === 'ACTIVE',
);
if (!card) throw new Error('Seed did not provide an active tokenized card.');

let consentRejected = false;
try {
  await request(
    '/v1/users/me/wallet/auto-recharge',
    authenticated(accessToken, {
      body: JSON.stringify({
        consentConfirmed: false,
        currency: 'BRL',
        enabled: true,
        minimumBalanceMinor: '5000',
        paymentMethodId: card.id,
        rechargeAmountMinor: '10000',
      }),
      method: 'PUT',
    }),
  );
} catch (error) {
  consentRejected = error.status === 409;
}
if (!consentRejected) {
  throw new Error('Automatic top-up was enabled without explicit consent.');
}
const enabledRule = await request(
  '/v1/users/me/wallet/auto-recharge',
  authenticated(accessToken, {
    body: JSON.stringify({
      consentConfirmed: true,
      currency: 'BRL',
      enabled: true,
      minimumBalanceMinor: '5000',
      paymentMethodId: card.id,
      rechargeAmountMinor: '10000',
    }),
    method: 'PUT',
  }),
);
const disabledRule = await request(
  '/v1/users/me/wallet/auto-recharge',
  authenticated(accessToken, { method: 'DELETE' }),
);
if (!enabledRule.enabled || disabledRule.enabled) {
  throw new Error('Automatic top-up lifecycle is invalid.');
}

console.log(
  JSON.stringify({
    amountMinor: created.amountMinor,
    autoRechargeConsentRejected: consentRejected,
    duplicateWebhookIgnored: duplicate.duplicate,
    intentId: created.id,
    ledgerMovementFound: true,
    payloadConflict,
    receiptNumber: receipt.receiptNumber,
    walletCreditMinor: '5000',
  }),
);
