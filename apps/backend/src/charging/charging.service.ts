import { BadRequestException, Injectable } from '@nestjs/common';

import { StationsService } from '../stations/stations.service';
import type { ValidateQrDto } from './dto/validate-qr.dto';

@Injectable()
export class ChargingService {
  constructor(private readonly stations: StationsService) {}

  validateQr(input: ValidateQrDto, tenantId: string) {
    if (!input.connectorId && !input.code) {
      throw new BadRequestException('Informe connectorId ou código manual.');
    }

    return this.stations.validateConnector(
      {
        chargePointId: input.chargePointId,
        code: input.code?.trim().toUpperCase(),
        connectorId: input.connectorId,
        evseId: input.evseId,
        stationId: input.stationId,
      },
      tenantId,
    );
  }
}
