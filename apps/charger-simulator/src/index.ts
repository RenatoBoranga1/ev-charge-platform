import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import {
  ChargerSimulator,
  type ConnectorStatus,
  type SimulatorScenario,
} from './simulator';

const port = Number(process.env.PORT ?? 8100);
const simulatorSecret = process.env.SIMULATOR_SECRET ?? 'local-simulator-secret';
const defaultScenario = (process.env.SIMULATOR_SCENARIO ?? 'normal') as SimulatorScenario;
const simulator = new ChargerSimulator({
  callbackSecret: simulatorSecret,
  defaultScenario,
  meterIntervalMs: Number(process.env.METER_INTERVAL_MS ?? 1_000),
});

function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      raw += chunk;
    });
    request.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Invalid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

function send(response: ServerResponse, status: number, body?: unknown): void {
  response.statusCode = status;
  if (body === undefined) {
    response.end();
    return;
  }
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

function requireSecret(request: IncomingMessage): void {
  if (request.headers['x-simulator-secret'] !== simulatorSecret) {
    throw new Error('Unauthorized simulator request.');
  }
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/health') {
      send(response, 200, { service: 'charger-simulator', status: 'ok' });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/connectors') {
      send(response, 200, simulator.listConnectors());
      return;
    }
    requireSecret(request);
    const body = await readBody(request);

    if (request.method === 'POST' && url.pathname === '/connectors/register') {
      simulator.registerConnector({
        connectorId: String(body.connectorId),
        maximumPowerKw: Number(body.maximumPowerKw),
        status: String(body.status) as ConnectorStatus,
      });
      send(response, 201, { accepted: true });
      return;
    }

    const connectorStatusMatch = url.pathname.match(/^\/connectors\/([^/]+)\/status$/);
    if (request.method === 'POST' && connectorStatusMatch) {
      send(
        response,
        200,
        simulator.setConnectorStatus(
          decodeURIComponent(connectorStatusMatch[1]!),
          String(body.status) as ConnectorStatus,
        ),
      );
      return;
    }

    const sessionMatch = url.pathname.match(
      /^\/sessions\/([^/]+)\/(start|stop|fail|disconnect)$/,
    );
    if (request.method === 'POST' && sessionMatch) {
      const sessionId = decodeURIComponent(sessionMatch[1]!);
      switch (sessionMatch[2]) {
        case 'start':
          send(
            response,
            200,
            simulator.start({
              callbackUrl: String(body.callbackUrl),
              connectorId: String(body.connectorId),
              maximumPowerKw: Number(body.maximumPowerKw),
              scenario: body.scenario as SimulatorScenario | undefined,
              sessionId,
            }),
          );
          return;
        case 'stop':
          send(response, 200, simulator.stop(sessionId));
          return;
        case 'fail': {
          const reason =
            typeof body.reason === 'string'
              ? body.reason
              : 'Simulated failure.';
          await simulator.fail(sessionId, reason);
          send(response, 202, { accepted: true });
          return;
        }
        case 'disconnect':
          await simulator.disconnect(sessionId);
          send(response, 202, { accepted: true });
          return;
      }
    }

    send(response, 404, {
      error: { code: 'NOT_FOUND', message: 'Route not found.' },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected simulator error.';
    send(response, message.startsWith('Unauthorized') ? 401 : 409, {
      error: { code: 'SIMULATOR_ERROR', message },
    });
  }
}

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(port, '0.0.0.0');

function shutdown(): void {
  simulator.shutdown();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
