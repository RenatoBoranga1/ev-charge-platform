export type ConnectorStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'OFFLINE'
  | 'FAULTED';

export type SimulatorScenario =
  | 'normal'
  | 'fail-after-3'
  | 'disconnect-after-3';

export interface ChargerEvent {
  batteryPercent?: number;
  meterWh?: string;
  occurredAt: string;
  powerKw?: number;
  reason?: string;
  sessionId: string;
  type: 'METER_VALUE' | 'FAILED' | 'DISCONNECTED';
}

export interface RegisterConnectorInput {
  connectorId: string;
  maximumPowerKw: number;
  status: ConnectorStatus;
}

export interface StartSessionInput {
  callbackUrl: string;
  connectorId: string;
  maximumPowerKw: number;
  scenario?: SimulatorScenario;
  sessionId: string;
}

type ConnectorState = RegisterConnectorInput;

interface SessionState {
  callbackUrl: string;
  connectorId: string;
  finalMeterWh?: bigint;
  meterWh: bigint;
  powerKw: number;
  scenario: SimulatorScenario;
  sessionId: string;
  status: 'CHARGING' | 'COMPLETED' | 'FAILED';
  ticks: number;
  timer?: ReturnType<typeof setInterval>;
}

export interface ChargerSimulatorOptions {
  callbackSecret: string;
  defaultScenario?: SimulatorScenario;
  meterIntervalMs?: number;
}

export class ChargerSimulator {
  private readonly connectors = new Map<string, ConnectorState>();
  private readonly sessions = new Map<string, SessionState>();
  private readonly meterIntervalMs: number;
  private readonly defaultScenario: SimulatorScenario;

  constructor(private readonly options: ChargerSimulatorOptions) {
    this.meterIntervalMs = options.meterIntervalMs ?? 1_000;
    this.defaultScenario = options.defaultScenario ?? 'normal';
  }

  registerConnector(input: RegisterConnectorInput): void {
    if (!input.connectorId || input.maximumPowerKw <= 0) {
      throw new Error('Invalid connector registration.');
    }
    const existing = this.connectors.get(input.connectorId);
    this.connectors.set(input.connectorId, {
      ...input,
      status:
        existing?.status === 'OCCUPIED' ? existing.status : input.status,
    });
  }

  setConnectorStatus(
    connectorId: string,
    status: ConnectorStatus,
  ): ConnectorState {
    const connector = this.requiredConnector(connectorId);
    if (
      status === 'AVAILABLE' &&
      [...this.sessions.values()].some(
        (session) =>
          session.connectorId === connectorId &&
          session.status === 'CHARGING',
      )
    ) {
      throw new Error('Cannot release a connector with an active session.');
    }
    connector.status = status;
    return { ...connector };
  }

  listConnectors(): ConnectorState[] {
    return [...this.connectors.values()].map((item) => ({ ...item }));
  }

  start(input: StartSessionInput): {
    meterStartWh: string;
    powerKw: number;
  } {
    const existing = this.sessions.get(input.sessionId);
    if (existing) {
      return {
        meterStartWh: existing.meterWh.toString(),
        powerKw: existing.powerKw,
      };
    }

    const connector = this.requiredConnector(input.connectorId);
    if (connector.status !== 'AVAILABLE') {
      throw new Error('Connector is offline or occupied.');
    }
    const connectorBusy = [...this.sessions.values()].some(
      (session) =>
        session.connectorId === input.connectorId &&
        session.status === 'CHARGING',
    );
    if (connectorBusy) throw new Error('Connector already has an active session.');

    const powerKw = Math.min(
      connector.maximumPowerKw,
      input.maximumPowerKw,
      74,
    );
    const session: SessionState = {
      callbackUrl: input.callbackUrl,
      connectorId: input.connectorId,
      meterWh: 1_000_000n + BigInt(this.sessions.size * 10_000),
      powerKw,
      scenario: input.scenario ?? this.defaultScenario,
      sessionId: input.sessionId,
      status: 'CHARGING',
      ticks: 0,
    };
    connector.status = 'OCCUPIED';
    this.sessions.set(input.sessionId, session);
    session.timer = setInterval(() => {
      void this.tick(session.sessionId).catch(() => {
        this.clearTimer(session);
        session.status = 'FAILED';
        this.requiredConnector(session.connectorId).status = 'FAULTED';
      });
    }, this.meterIntervalMs);

    return {
      meterStartWh: session.meterWh.toString(),
      powerKw,
    };
  }

  stop(sessionId: string): { meterStopWh: string } {
    const session = this.requiredSession(sessionId);
    if (session.status === 'COMPLETED' && session.finalMeterWh !== undefined) {
      return { meterStopWh: session.finalMeterWh.toString() };
    }
    if (session.status !== 'CHARGING') {
      throw new Error('Session is not charging.');
    }
    this.clearTimer(session);
    session.status = 'COMPLETED';
    session.finalMeterWh = session.meterWh;
    const connector = this.requiredConnector(session.connectorId);
    if (connector.status !== 'OFFLINE') connector.status = 'AVAILABLE';
    return { meterStopWh: session.meterWh.toString() };
  }

  async fail(sessionId: string, reason = 'Simulated failure.'): Promise<void> {
    const session = this.requiredSession(sessionId);
    if (session.status !== 'CHARGING') return;
    this.clearTimer(session);
    session.status = 'FAILED';
    this.requiredConnector(session.connectorId).status = 'FAULTED';
    await this.emit(session, {
      occurredAt: new Date().toISOString(),
      reason,
      sessionId,
      type: 'FAILED',
    });
  }

  async disconnect(sessionId: string): Promise<void> {
    const session = this.requiredSession(sessionId);
    if (session.status !== 'CHARGING') return;
    this.clearTimer(session);
    session.status = 'FAILED';
    this.requiredConnector(session.connectorId).status = 'OFFLINE';
    await this.emit(session, {
      occurredAt: new Date().toISOString(),
      reason: 'Simulated charger disconnect.',
      sessionId,
      type: 'DISCONNECTED',
    });
  }

  shutdown(): void {
    for (const session of this.sessions.values()) this.clearTimer(session);
  }

  private async tick(sessionId: string): Promise<void> {
    const session = this.requiredSession(sessionId);
    if (session.status !== 'CHARGING') return;
    session.ticks += 1;
    const incrementWh = Math.max(
      1,
      Math.round(
        (session.powerKw * 1000 * this.meterIntervalMs) / 3_600_000,
      ),
    );
    session.meterWh += BigInt(incrementWh);
    await this.emit(session, {
      batteryPercent: Math.min(100, 30 + session.ticks),
      meterWh: session.meterWh.toString(),
      occurredAt: new Date().toISOString(),
      powerKw: session.powerKw,
      sessionId,
      type: 'METER_VALUE',
    });
    if (session.scenario === 'fail-after-3' && session.ticks >= 3) {
      await this.fail(sessionId);
    } else if (
      session.scenario === 'disconnect-after-3' &&
      session.ticks >= 3
    ) {
      await this.disconnect(sessionId);
    }
  }

  private async emit(
    session: SessionState,
    event: ChargerEvent,
  ): Promise<void> {
    const response = await fetch(session.callbackUrl, {
      body: JSON.stringify(event),
      headers: {
        'Content-Type': 'application/json',
        'x-simulator-secret': this.options.callbackSecret,
      },
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Backend callback failed with ' + response.status + '.');
    }
  }

  private clearTimer(session: SessionState): void {
    if (session.timer) clearInterval(session.timer);
    session.timer = undefined;
  }

  private requiredConnector(connectorId: string): ConnectorState {
    const connector = this.connectors.get(connectorId);
    if (!connector) throw new Error('Connector is not registered.');
    return connector;
  }

  private requiredSession(sessionId: string): SessionState {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session is not registered.');
    return session;
  }
}
