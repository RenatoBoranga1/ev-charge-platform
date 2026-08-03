import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const baseUrl = process.env.E2E_API_URL ?? 'http://localhost:8000';
const email = process.env.E2E_ADMIN_EMAIL ?? 'admin@solis.local';
const password = process.env.E2E_ADMIN_PASSWORD ?? 'solis-admin-demo';
const operatorId =
  process.env.E2E_OPERATOR_ID ?? '10101010-1010-4010-8010-101010101010';

function cookiesFrom(response) {
  const values =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie') ?? ''];
  return values
    .flatMap((value) => value.split(/,(?=\s*solis_admin_)/))
    .map((value) => value.split(';', 1)[0])
    .filter(Boolean)
    .join('; ');
}

function csrfFrom(cookie) {
  return cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('solis_admin_csrf='))
    ?.split('=', 2)[1];
}

async function json(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json().catch(() => null);
  assert.ok(response.ok, `${init.method ?? 'GET'} ${path}: ${response.status} ${JSON.stringify(body)}`);
  return { body, response };
}

const login = await json('/v1/admin/auth/login', {
  body: JSON.stringify({ email, password }),
  headers: { 'content-type': 'application/json' },
  method: 'POST',
});
let cookie = cookiesFrom(login.response);
assert.ok(cookie.includes('solis_admin_refresh='), 'refresh cookie ausente');
assert.ok(cookie.includes('solis_admin_csrf='), 'CSRF cookie ausente');
assert.equal(login.body.membership.tenantName, 'Solis Plataformas');
assert.ok(login.body.membership.permissions.includes('stations.create'));
let token = login.body.accessToken;

function authorized(extra = {}) {
  return {
    ...extra,
    headers: {
      authorization: `Bearer ${token}`,
      ...(extra.headers ?? {}),
    },
  };
}

const dashboard = await json('/v1/admin/dashboard', authorized());
assert.ok(dashboard.body.metrics.stations >= 3);

const stations = await json('/v1/admin/stations?limit=10', authorized());
assert.ok(stations.body.data.length >= 3);
assert.equal(JSON.stringify(stations.body).includes('ocppAuthSecretHash'), false);

const suffix = randomUUID().slice(0, 8);
const created = await json(
  '/v1/admin/stations',
  authorized({
    body: JSON.stringify({
      address: 'Rua de Validação, 100',
      city: 'São Paulo',
      latitude: -23.55,
      longitude: -46.63,
      name: `Solis E2E ${suffix}`,
      operatorId,
      postalCode: '01000-000',
      state: 'SP',
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  }),
);
const stationId = created.body.id;

const detail = await json(`/v1/admin/stations/${stationId}`, authorized());
assert.equal(detail.body.name, `Solis E2E ${suffix}`);
assert.equal(JSON.stringify(detail.body).includes('ocppAuthSecretHash'), false);

const tariff = await json(
  '/v1/admin/tariffs',
  authorized({
    body: JSON.stringify({
      activationFee: 1,
      currency: 'BRL',
      name: `Tarifa E2E ${suffix}`,
      parkingFeeHour: 0,
      pricePerKwh: 1.99,
      stationId,
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  }),
);
assert.equal(tariff.body.publicationStatus, 'DRAFT');
const published = await json(
  `/v1/admin/tariffs/${tariff.body.id}/publish`,
  authorized({ method: 'POST' }),
);
assert.equal(published.body.publicationStatus, 'PUBLISHED');

for (const resource of [
  '/v1/admin/charging-sessions?limit=5',
  '/v1/admin/remote-commands?limit=5',
  '/v1/admin/drivers?limit=5',
  '/v1/admin/reconciliation?limit=5',
  '/v1/admin/operators?limit=5',
  '/v1/admin/audit-logs?limit=10',
]) {
  const result = await json(resource, authorized());
  assert.ok(Array.isArray(result.body.data), `${resource} não retornou cursor page`);
}

const payments = await json('/v1/admin/payments?limit=5', authorized());
assert.ok(Array.isArray(payments.body.data));
assert.equal(JSON.stringify(payments.body).includes('requestHash'), false);
assert.equal(JSON.stringify(payments.body).includes('metadata'), false);
for (const payment of payments.body.data) {
  if (payment.providerReference) {
    assert.match(payment.providerReference, /^(?:\*\*\*|.{3}….{3})$/u);
  }
}
if (payments.body.data[0]) {
  const paymentDetail = await json(
    '/v1/admin/payments/' + payments.body.data[0].id,
    authorized(),
  );
  assert.equal(JSON.stringify(paymentDetail.body).includes('requestHash'), false);
}

const report = await fetch(
  `${baseUrl}/v1/admin/reports/charging-sessions.csv`,
  authorized(),
);
assert.ok(report.ok);
assert.match(report.headers.get('content-type') ?? '', /text\/csv/);
assert.match(await report.text(), /energia_kwh/);

await json(
  `/v1/admin/stations/${stationId}`,
  authorized({
    body: JSON.stringify({
      reason: 'Limpeza do cenário E2E administrativo',
    }),
    headers: { 'content-type': 'application/json' },
    method: 'DELETE',
  }),
);

const refreshed = await json('/v1/admin/auth/refresh', {
  headers: {
    cookie,
    'x-csrf-token': csrfFrom(cookie),
  },
  method: 'POST',
});
cookie = cookiesFrom(refreshed.response);
token = refreshed.body.accessToken;
assert.ok(token);

await json('/v1/admin/auth/logout', authorized({ headers: { cookie }, method: 'POST' }));

console.info(
  JSON.stringify({
    checks: 18,
    stationId,
    status: 'ok',
    tenantId: login.body.membership.tenantId,
  }),
);
