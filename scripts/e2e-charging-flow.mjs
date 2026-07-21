const baseUrl = process.env.API_URL ?? 'http://localhost:8000';
const runId = Date.now().toString(36);

async function request(path, options = {}) {
  const response = await fetch(baseUrl + path, options);
  const raw = await response.text();
  const body = raw ? JSON.parse(raw) : null;
  if (!response.ok) {
    const error = new Error(
      'HTTP ' + response.status + ' ' + path + ': ' + JSON.stringify(body),
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
      Authorization: 'Bearer ' + accessToken,
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

const staleActive = await request(
  '/v1/charging-sessions/active',
  authenticated(accessToken),
);
if (staleActive) {
  let recoverable = staleActive;
  if (recoverable.status === 'authorized') {
    recoverable = await request(
      '/v1/charging-sessions/' + recoverable.id + '/start',
      authenticated(accessToken, {
        headers: { 'Idempotency-Key': 'e2e-recover-start-' + runId },
        method: 'POST',
      }),
    );
  }
  if (recoverable.status !== 'charging') {
    throw new Error(
      'Cannot recover stale active session in state ' + recoverable.status,
    );
  }
  await request(
    '/v1/charging-sessions/' + recoverable.id + '/stop',
    authenticated(accessToken, {
      headers: { 'Idempotency-Key': 'e2e-recover-stop-' + runId },
      method: 'POST',
    }),
  );
}

const [stations, vehicles] = await Promise.all([
  request(
    '/v1/stations/nearby?latitude=-23.55052&longitude=-46.633308&distanceKm=50',
    authenticated(accessToken),
  ),
  request('/v1/users/me/vehicles', authenticated(accessToken)),
]);
const station = stations.find((candidate) =>
  candidate.connectors.some((connector) => connector.status === 'AVAILABLE'),
);
const connector = station?.connectors.find(
  (candidate) => candidate.status === 'AVAILABLE',
);
const vehicle = vehicles[0];
if (!station || !connector || !vehicle) {
  throw new Error('Seed did not provide an available connector and vehicle.');
}

const createKey = 'e2e-create-' + runId;
const created = await request(
  '/v1/charging-sessions',
  authenticated(accessToken, {
    body: JSON.stringify({
      connectorId: connector.id,
      paymentMethodId: 'account-default',
      vehicleId: vehicle.id,
    }),
    headers: { 'Idempotency-Key': createKey },
    method: 'POST',
  }),
);
if (created.status !== 'authorized') {
  throw new Error('Expected AUTHORIZED after create, got ' + created.status);
}

let concurrencyBlocked = false;
try {
  await request(
    '/v1/charging-sessions',
    authenticated(accessToken, {
      body: JSON.stringify({
        connectorId: connector.id,
        paymentMethodId: 'account-default',
        vehicleId: vehicle.id,
      }),
      headers: { 'Idempotency-Key': createKey + '-concurrent' },
      method: 'POST',
    }),
  );
} catch (error) {
  concurrencyBlocked = error.status === 409;
}
if (!concurrencyBlocked) throw new Error('Concurrent connector session was not blocked.');

const startOptions = authenticated(accessToken, {
  headers: { 'Idempotency-Key': 'e2e-start-' + runId },
  method: 'POST',
});
const started = await request(
  '/v1/charging-sessions/' + created.id + '/start',
  startOptions,
);
const repeatedStart = await request(
  '/v1/charging-sessions/' + created.id + '/start',
  startOptions,
);
if (started.id !== repeatedStart.id || started.status !== 'charging') {
  throw new Error('Start endpoint was not idempotent.');
}

await new Promise((resolve) => setTimeout(resolve, 2200));
const metrics = await request(
  '/v1/charging-sessions/' + created.id + '/metrics',
  authenticated(accessToken),
);
if (metrics.sessionId !== created.id || metrics.energyKwh < 0) {
  throw new Error('Metrics recovery returned an invalid snapshot.');
}

const stopOptions = authenticated(accessToken, {
  headers: { 'Idempotency-Key': 'e2e-stop-' + runId },
  method: 'POST',
});
const stopped = await request(
  '/v1/charging-sessions/' + created.id + '/stop',
  stopOptions,
);
const repeatedStop = await request(
  '/v1/charging-sessions/' + created.id + '/stop',
  stopOptions,
);
if (
  stopped.session.status !== 'completed' ||
  repeatedStop.session.id !== stopped.session.id
) {
  throw new Error('Stop endpoint was not idempotent.');
}

console.log(
  JSON.stringify({
    concurrencyBlocked,
    energyKwh: stopped.energyKwh,
    login: login.user.email,
    sessionId: created.id,
    station: station.name,
    status: stopped.session.status,
  }),
);
