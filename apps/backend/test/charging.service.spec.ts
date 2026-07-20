import { BadRequestException } from '@nestjs/common';

import { ChargingService } from '../src/charging/charging.service';
import { StationsService } from '../src/stations/stations.service';

describe('ChargingService', () => {
  const validateConnector = jest.fn();
  const stations = { validateConnector } as unknown as StationsService;
  const service = new ChargingService(stations);

  beforeEach(() => validateConnector.mockReset());

  it('requires a connector id or manual code', () => {
    expect(() => service.validateQr({}, 'tenant')).toThrow(BadRequestException);
  });

  it('passes only the connector id for deep links', async () => {
    validateConnector.mockResolvedValue({ connector: { id: 'connector' } });
    await service.validateQr(
      { connectorId: 'connector', source: 'deep-link' },
      'tenant',
    );
    expect(validateConnector).toHaveBeenCalledWith(
      {
        chargePointId: undefined,
        code: undefined,
        connectorId: 'connector',
        evseId: undefined,
        stationId: undefined,
      },
      'tenant',
    );
  });

  it('normalizes manual connector codes', async () => {
    validateConnector.mockResolvedValue({ connector: { id: 'connector' } });
    await service.validateQr({ code: ' solis-001-a ' }, 'tenant');
    expect(validateConnector).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SOLIS-001-A' }),
      'tenant',
    );
  });
});
