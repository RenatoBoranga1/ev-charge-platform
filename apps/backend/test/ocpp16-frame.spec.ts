import {
  callError,
  callResult,
  OcppProtocolError,
  parseOcppFrame,
  serializeOcppFrame,
} from '../src/ocpp/ocpp16-frame';
import {
  bootNotificationSchema,
  meterValuesSchema,
  startTransactionSchema,
  stopTransactionSchema,
} from '../src/ocpp/ocpp16-payloads';

describe('OCPP 1.6J frames and payloads', () => {
  it('parses CALL, CALLRESULT and CALLERROR frames', () => {
    expect(parseOcppFrame('[2,"a","Heartbeat",{}]')).toEqual([
      2,
      'a',
      'Heartbeat',
      {},
    ]);
    expect(parseOcppFrame('[3,"a",{"currentTime":"now"}]')).toEqual([
      3,
      'a',
      { currentTime: 'now' },
    ]);
    expect(parseOcppFrame('[4,"a","InternalError","failed",{}]')).toEqual([
      4,
      'a',
      'InternalError',
      'failed',
      {},
    ]);
  });

  it('creates serializable CALLRESULT and CALLERROR frames', () => {
    expect(serializeOcppFrame(callResult('1', { status: 'Accepted' }))).toBe(
      '[3,"1",{"status":"Accepted"}]',
    );
    expect(
      callError(
        '2',
        new OcppProtocolError('NotSupported', 'unsupported', { action: 'X' }),
      ),
    ).toEqual([4, '2', 'NotSupported', 'unsupported', { action: 'X' }]);
  });

  it.each([
    ['not json'],
    ['{}'],
    ['[5,"id",{}]'],
    ['[2,"","Heartbeat",{}]'],
    ['[2,"id","Heartbeat",[]]'],
  ])('rejects malformed frame %s', (frame) => {
    expect(() => parseOcppFrame(frame)).toThrow(OcppProtocolError);
  });

  it('enforces the configured frame size', () => {
    expect(() => parseOcppFrame('[2,"id","Heartbeat",{}]', 4)).toThrow(
      'Frame exceeds payload limit.',
    );
  });

  it('validates supported OCPP payloads strictly', () => {
    expect(
      bootNotificationSchema.parse({
        chargePointModel: 'Solis CP',
        chargePointVendor: 'Solis',
      }),
    ).toBeDefined();
    expect(
      startTransactionSchema.parse({
        connectorId: 1,
        idTag: 'tag',
        meterStart: 100,
        timestamp: '2026-07-21T12:00:00.000Z',
      }),
    ).toBeDefined();
    expect(
      meterValuesSchema.parse({
        connectorId: 1,
        meterValue: [
          {
            sampledValue: [{ value: '120', unit: 'Wh' }],
            timestamp: '2026-07-21T12:00:01.000Z',
          },
        ],
        transactionId: 1,
      }),
    ).toBeDefined();
    expect(
      stopTransactionSchema.parse({
        meterStop: 130,
        timestamp: '2026-07-21T12:00:02.000Z',
        transactionId: 1,
      }),
    ).toBeDefined();
  });

  it('rejects extra fields, oversized tags and invalid meter samples', () => {
    expect(() =>
      bootNotificationSchema.parse({
        chargePointModel: 'Solis CP',
        chargePointVendor: 'Solis',
        secret: 'must-not-pass',
      }),
    ).toThrow();
    expect(() =>
      startTransactionSchema.parse({
        connectorId: 1,
        idTag: 'x'.repeat(21),
        meterStart: 100,
        timestamp: 'invalid',
      }),
    ).toThrow();
    expect(() =>
      meterValuesSchema.parse({ connectorId: 1, meterValue: [] }),
    ).toThrow();
  });
});