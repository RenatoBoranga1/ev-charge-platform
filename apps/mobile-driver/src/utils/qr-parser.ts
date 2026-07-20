import { z } from 'zod';

const jsonQrPayloadSchema = z.object({
  version: z.literal(1),
  type: z.literal('EV_CONNECTOR'),
  stationId: z.string().uuid(),
  chargePointId: z.string().uuid(),
  evseId: z.string().uuid(),
  connectorId: z.string().uuid(),
});

export type JsonChargeQrPayload = z.infer<typeof jsonQrPayloadSchema> & { source: 'json' };

export type DeepLinkChargeQrPayload = {
  source: 'deep-link';
  version: 1;
  type: 'EV_CONNECTOR';
  connectorId: string;
};

export type ChargeQrPayload = JsonChargeQrPayload | DeepLinkChargeQrPayload;

const supportedSchemes = ['solis:', 'voltway:'] as const;

export function parseChargeQr(rawValue: string): ChargeQrPayload {
  const trimmedValue = rawValue.trim();

  if (trimmedValue.startsWith('{')) {
    const parsed: unknown = JSON.parse(trimmedValue);
    return { source: 'json', ...jsonQrPayloadSchema.parse(parsed) };
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
    source: 'deep-link',
    version: 1,
    type: 'EV_CONNECTOR',
    connectorId: z.string().uuid().parse(pathSegments[2]),
  };
}
