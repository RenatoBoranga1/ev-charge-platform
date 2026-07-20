import { ids } from '@/mocks/data';
import { parseChargeQr } from '@/utils/qr-parser';

describe('parseChargeQr', () => {
  it('accepts a versioned JSON payload', () => {
    const payload = {
      version: 1,
      type: 'EV_CONNECTOR',
      stationId: ids.stationOne,
      chargePointId: ids.chargePointOne,
      evseId: ids.evseOne,
      connectorId: ids.connectorOne,
    };

    expect(parseChargeQr(JSON.stringify(payload))).toEqual(payload);
  });

  it('accepts a Solis deep link', () => {
    const payload = parseChargeQr(
      'solis://charge/connectors/' + ids.connectorOne,
    );

    expect(payload.connectorId).toBe(ids.connectorOne);
    expect(payload.type).toBe('EV_CONNECTOR');
  });

  it('rejects an unknown scheme', () => {
    expect(() =>
      parseChargeQr('https://example.com/charge/connectors/' + ids.connectorOne),
    ).toThrow('não pertence');
  });
});
