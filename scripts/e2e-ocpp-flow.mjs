import WebSocket from 'ws';

const apiUrl = process.env.API_URL ?? 'http://localhost:8000';
const ocppUrl = process.env.OCPP_URL ?? 'ws://localhost:9000';
const identity = process.env.OCPP_IDENTITY ?? 'SOLIS-OCPP-001';
const password = process.env.OCPP_DEMO_PASSWORD ?? 'solis-ocpp-demo';
const runId = Date.now().toString(36);

async function request(path, options = {}) {
  const response = await fetch(apiUrl + path, options);
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

class OcppChargePoint {
  #queue = [];
  #waiters = [];
  #sequence = 0;

  constructor(socket) {
    this.socket = socket;
    socket.on('message', (data) => this.#receive(JSON.parse(data.toString())));
  }

  static async connect() {
    const authorization = Buffer.from(identity + ':' + password).toString('base64');
    const socket = new WebSocket(
      ocppUrl + '/ocpp/' + encodeURIComponent(identity),
      'ocpp1.6',
      { headers: { Authorization: 'Basic ' + authorization } },
    );
    await new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    if (socket.protocol !== 'ocpp1.6') {
      throw new Error('Server did not negotiate ocpp1.6.');
    }
    return new OcppChargePoint(socket);
  }

  async call(action, payload, uniqueId = 'e2e-' + runId + '-' + ++this.#sequence) {
    this.socket.send(JSON.stringify([2, uniqueId, action, payload]));
    const frame = await this.#wait(
      (candidate) => candidate[1] === uniqueId && [3, 4].includes(candidate[0]),
    );
    if (frame[0] === 4) {
      throw new Error(action + ' returned CALLERROR ' + frame[2] + ': ' + frame[3]);
    }
    return frame[2];
  }

  waitCommand(action) {
    return this.#wait((frame) => frame[0] === 2 && frame[2] === action);
  }

  result(uniqueId, payload) {
    this.socket.send(JSON.stringify([3, uniqueId, payload]));
  }

  async close() {
    if (this.socket.readyState === WebSocket.CLOSED) return;
    const closed = new Promise((resolve) => this.socket.once('close', resolve));
    this.socket.close(1000, 'E2E complete');
    await closed;
  }

  #wait(predicate, timeoutMs = 10_000) {
    const index = this.#queue.findIndex(predicate);
    if (index >= 0) return Promise.resolve(this.#queue.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.#waiters.findIndex((waiter) => waiter.resolve === resolve);
        if (index >= 0) this.#waiters.splice(index, 1);
        reject(new Error('Timed out waiting for OCPP frame.'));
      }, timeoutMs);
      this.#waiters.push({ predicate, reject, resolve, timer });
    });
  }

  #receive(frame) {
    const index = this.#waiters.findIndex((waiter) => waiter.predicate(frame));
    if (index < 0) {
      this.#queue.push(frame);
      return;
    }
    const waiter = this.#waiters.splice(index, 1)[0];
    clearTimeout(waiter.timer);
    waiter.resolve(frame);
  }
}

const chargePoint = await OcppChargePoint.connect();
try {
  const boot = await chargePoint.call('BootNotification', {
    chargePointModel: 'Solis Virtual CP',
    chargePointVendor: 'Solis Plataformas',
    firmwareVersion: 'e2e-1.0.0',
  });
  if (boot.status !== 'Accepted') throw new Error('BootNotification was not accepted.');
  const heartbeat = await chargePoint.call('Heartbeat', {});
  if (!heartbeat.currentTime) throw new Error('Heartbeat did not return currentTime.');
  await chargePoint.call('StatusNotification', {
    connectorId: 1,
    errorCode: 'NoError',
    status: 'Available',
    timestamp: new Date().toISOString(),
  });

  const login = await request('/v1/auth/login', {
    body: JSON.stringify({
      email: 'marina.souza@example.com',
      password: process.env.DEMO_USER_PASSWORD ?? 'solis-demo',
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const accessToken = login.tokens.accessToken;
  const active = await request(
    '/v1/charging-sessions/active',
    authenticated(accessToken),
  );
  if (active) {
    throw new Error('An active session already exists; finish it before OCPP E2E.');
  }

  const [stations, vehicles] = await Promise.all([
    request(
      '/v1/stations/nearby?latitude=-23.59245&longitude=-46.67218&distanceKm=50',
      authenticated(accessToken),
    ),
    request('/v1/users/me/vehicles', authenticated(accessToken)),
  ]);
  const connector = stations
    .flatMap((station) => station.connectors)
    .find((candidate) => candidate.code === 'SOLIS-003-A');
  const vehicle = vehicles[0];
  if (!connector || connector.status !== 'AVAILABLE' || !vehicle) {
    throw new Error('OCPP seed connector or vehicle is unavailable.');
  }

  const created = await request(
    '/v1/charging-sessions',
    authenticated(accessToken, {
      body: JSON.stringify({
        connectorId: connector.id,
        paymentMethodId: 'account-default',
        vehicleId: vehicle.id,
      }),
      headers: { 'Idempotency-Key': 'ocpp-e2e-create-' + runId },
      method: 'POST',
    }),
  );
  if (created.status !== 'authorized') {
    throw new Error('Expected authorized session, got ' + created.status);
  }

  const startRequest = request(
    '/v1/charging-sessions/' + created.id + '/start',
    authenticated(accessToken, {
      headers: { 'Idempotency-Key': 'ocpp-e2e-start-' + runId },
      method: 'POST',
    }),
  );
  const remoteStart = await chargePoint.waitCommand('RemoteStartTransaction');
  const remoteStartPayload = remoteStart[3];
  chargePoint.result(remoteStart[1], { status: 'Accepted' });
  const authorization = await chargePoint.call('Authorize', {
    idTag: remoteStartPayload.idTag,
  });
  if (authorization.idTagInfo?.status !== 'Accepted') {
    throw new Error('Authorize was not accepted.');
  }
  const startedTransaction = await chargePoint.call('StartTransaction', {
    connectorId: 1,
    idTag: remoteStartPayload.idTag,
    meterStart: 50_000,
    timestamp: new Date().toISOString(),
  });
  const transactionId = startedTransaction.transactionId;
  const started = await startRequest;
  if (started.status !== 'charging') {
    throw new Error('Expected charging session, got ' + started.status);
  }
  await chargePoint.call('StatusNotification', {
    connectorId: 1,
    errorCode: 'NoError',
    status: 'Charging',
    timestamp: new Date().toISOString(),
  });

  const meterPayload = {
    connectorId: 1,
    meterValue: [
      {
        sampledValue: [
          {
            measurand: 'Energy.Active.Import.Register',
            unit: 'Wh',
            value: '50320',
          },
          { measurand: 'Power.Active.Import', unit: 'W', value: '11000' },
          { measurand: 'SoC', unit: 'Percent', value: '55' },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
    transactionId,
  };
  await chargePoint.call('MeterValues', meterPayload, 'ocpp-e2e-meter-' + runId);
  await chargePoint.call('MeterValues', meterPayload, 'ocpp-e2e-meter-' + runId);
  const metrics = await request(
    '/v1/charging-sessions/' + created.id + '/metrics',
    authenticated(accessToken),
  );
  if (metrics.energyKwh !== 0.32 || metrics.currentPowerKw !== 11) {
    throw new Error('OCPP metrics were not reflected in the session: ' + JSON.stringify(metrics));
  }

  const stopRequest = request(
    '/v1/charging-sessions/' + created.id + '/stop',
    authenticated(accessToken, {
      headers: { 'Idempotency-Key': 'ocpp-e2e-stop-' + runId },
      method: 'POST',
    }),
  );
  const remoteStop = await chargePoint.waitCommand('RemoteStopTransaction');
  if (remoteStop[3].transactionId !== transactionId) {
    throw new Error('RemoteStopTransaction used the wrong transaction.');
  }
  chargePoint.result(remoteStop[1], { status: 'Accepted' });
  await chargePoint.call('StopTransaction', {
    meterStop: 50_500,
    reason: 'Remote',
    timestamp: new Date().toISOString(),
    transactionId,
  });
  const summary = await stopRequest;
  if (summary.session.status !== 'completed' || summary.energyKwh !== 0.5) {
    throw new Error('OCPP stop did not complete the session: ' + JSON.stringify(summary));
  }
  await chargePoint.call('StatusNotification', {
    connectorId: 1,
    errorCode: 'NoError',
    status: 'Available',
    timestamp: new Date().toISOString(),
  });

  console.log(
    JSON.stringify({
      boot: boot.status,
      energyKwh: summary.energyKwh,
      heartbeat: true,
      protocol: chargePoint.socket.protocol,
      sessionId: created.id,
      status: summary.session.status,
      transactionId,
    }),
  );
} finally {
  await chargePoint.close();
}