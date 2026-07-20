import { z } from 'zod';

export const manualConnectorCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^SOLIS-[0-9]{3}-[A-Z]$/, 'Use o formato SOLIS-001-A.');

export function normalizeManualConnectorCode(value: string): string {
  return manualConnectorCodeSchema.parse(value);
}
