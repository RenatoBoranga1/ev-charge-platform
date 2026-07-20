import { z } from 'zod';

const qrPayloadSchema = z.object({
  version: z.literal(1),
  type: z.literal('EV_CONNECTOR'),
  stationId: z.string().uuid(),
  chargePointId: z.string().uuid(),
  evseId: z.string().uuid(),
  connectorId: z.string().uuid(),
});

export type ChargeQrPayload = z.infer<typeof qrPayloadSchema>;

const supportedSchemes = ['solis:', 'voltway:'] as const;

export function parseChargeQr(rawValue: string): ChargeQrPayload {
  const trimmedValue = rawValue.trim();

  if (trimmedValue.startsWith('{')) {
    const parsed: unknown = JSON.parse(trimmedValue);
    return qrPayloadSchema.parse(parsed);
  }

  const url = new URL(trimmedValue);
  if (!supportedSchemes.includes(url.protocol as (typeof supportedSchemes)[number])) {
    throw new Error('Este QR Code não pertence à rede Solis.');
  }

  const pathSegments = [url.hostname, ...url.pathname.split('/')]
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));

  if (
    pathSegments.length !== 3 ||
    pathSegments[0] !== 'charge' ||
    pathSegments[1] !== 'connectors'
  ) {
    throw new Error('O endereço do conector não possui um formato válido.');
  }

  return {
    version: 1,
    type: 'EV_CONNECTOR',
    stationId: '00000000-0000-4000-8000-000000000000',
    chargePointId: '00000000-0000-4000-8000-000000000000',
    evseId: '00000000-0000-4000-8000-000000000000',
    connectorId: z.string().uuid().parse(pathSegments[2]),
  };
}
