export const chargingSessionStates = [
  'PENDING',
  'AUTHORIZED',
  'STARTING',
  'CHARGING',
  'STOPPING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type ChargingSessionState = (typeof chargingSessionStates)[number];

const transitions: Record<ChargingSessionState, readonly ChargingSessionState[]> = {
  PENDING: ['AUTHORIZED', 'FAILED', 'CANCELLED'],
  AUTHORIZED: ['STARTING', 'FAILED', 'CANCELLED'],
  STARTING: ['CHARGING', 'FAILED', 'CANCELLED'],
  CHARGING: ['STOPPING', 'FAILED'],
  STOPPING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export class InvalidChargingSessionTransitionError extends Error {
  constructor(
    readonly from: ChargingSessionState,
    readonly to: ChargingSessionState,
  ) {
    super('Invalid charging session transition: ' + from + ' -> ' + to);
  }
}

export function assertChargingSessionTransition(
  from: ChargingSessionState,
  to: ChargingSessionState,
): void {
  if (from === to) return;
  if (!transitions[from].includes(to)) {
    throw new InvalidChargingSessionTransitionError(from, to);
  }
}

export function isTerminalChargingSessionState(
  status: ChargingSessionState,
): boolean {
  return transitions[status].length === 0;
}

export function isActiveChargingSessionState(
  status: ChargingSessionState,
): boolean {
  return !isTerminalChargingSessionState(status);
}
