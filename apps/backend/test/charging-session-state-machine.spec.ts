import {
  assertChargingSessionTransition,
  chargingSessionStates,
  InvalidChargingSessionTransitionError,
  isActiveChargingSessionState,
  isTerminalChargingSessionState,
} from '../src/charging/domain/charging-session-state-machine';

describe('charging session state machine', () => {
  it('exposes the complete canonical state set', () => {
    expect(chargingSessionStates).toEqual([
      'PENDING',
      'AUTHORIZED',
      'STARTING',
      'CHARGING',
      'STOPPING',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
    ]);
  });

  it.each([
    ['PENDING', 'AUTHORIZED'],
    ['AUTHORIZED', 'STARTING'],
    ['STARTING', 'CHARGING'],
    ['CHARGING', 'STOPPING'],
    ['STOPPING', 'COMPLETED'],
    ['PENDING', 'FAILED'],
    ['AUTHORIZED', 'CANCELLED'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(() => assertChargingSessionTransition(from, to)).not.toThrow();
  });

  it('treats a repeated transition as idempotent', () => {
    expect(() =>
      assertChargingSessionTransition('CHARGING', 'CHARGING'),
    ).not.toThrow();
  });

  it('rejects invalid and terminal transitions with context', () => {
    expect(() =>
      assertChargingSessionTransition('COMPLETED', 'CHARGING'),
    ).toThrow(InvalidChargingSessionTransitionError);
    try {
      assertChargingSessionTransition('CHARGING', 'AUTHORIZED');
    } catch (error) {
      expect(error).toMatchObject({ from: 'CHARGING', to: 'AUTHORIZED' });
    }
  });

  it('classifies active and terminal states', () => {
    expect(isActiveChargingSessionState('STOPPING')).toBe(true);
    expect(isTerminalChargingSessionState('COMPLETED')).toBe(true);
    expect(isTerminalChargingSessionState('FAILED')).toBe(true);
    expect(isTerminalChargingSessionState('CANCELLED')).toBe(true);
  });
});
