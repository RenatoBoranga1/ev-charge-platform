import { z } from 'zod';

const nonEmpty = (maximum: number) => z.string().min(1).max(maximum);
const dateTime = z.string().datetime({ offset: true });
const safeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const bootNotificationSchema = z
  .object({
    chargePointVendor: nonEmpty(20),
    chargePointModel: nonEmpty(20),
    chargeBoxSerialNumber: nonEmpty(25).optional(),
    chargePointSerialNumber: nonEmpty(25).optional(),
    firmwareVersion: nonEmpty(50).optional(),
    iccid: nonEmpty(20).optional(),
    imsi: nonEmpty(20).optional(),
    meterSerialNumber: nonEmpty(25).optional(),
    meterType: nonEmpty(25).optional(),
  })
  .strict();

export const heartbeatSchema = z.object({}).strict();

export const statusNotificationSchema = z
  .object({
    connectorId: z.number().int().nonnegative(),
    errorCode: z.enum([
      'ConnectorLockFailure',
      'EVCommunicationError',
      'GroundFailure',
      'HighTemperature',
      'InternalError',
      'LocalListConflict',
      'NoError',
      'OtherError',
      'OverCurrentFailure',
      'OverVoltage',
      'PowerMeterFailure',
      'PowerSwitchFailure',
      'ReaderFailure',
      'ResetFailure',
      'UnderVoltage',
      'WeakSignal',
    ]),
    status: z.enum([
      'Available',
      'Preparing',
      'Charging',
      'SuspendedEVSE',
      'SuspendedEV',
      'Finishing',
      'Reserved',
      'Unavailable',
      'Faulted',
    ]),
    timestamp: dateTime.optional(),
    info: nonEmpty(50).optional(),
    vendorId: nonEmpty(255).optional(),
    vendorErrorCode: nonEmpty(50).optional(),
  })
  .strict();

export const authorizeSchema = z.object({ idTag: nonEmpty(20) }).strict();

export const startTransactionSchema = z
  .object({
    connectorId: z.number().int().positive(),
    idTag: nonEmpty(20),
    meterStart: safeInteger,
    reservationId: z.number().int().nonnegative().optional(),
    timestamp: dateTime,
  })
  .strict();

const sampledValueSchema = z
  .object({
    value: nonEmpty(32),
    context: z
      .enum([
        'Interruption.Begin',
        'Interruption.End',
        'Sample.Clock',
        'Sample.Periodic',
        'Transaction.Begin',
        'Transaction.End',
        'Trigger',
        'Other',
      ])
      .optional(),
    format: z.enum(['Raw', 'SignedData']).optional(),
    measurand: nonEmpty(64).optional(),
    phase: nonEmpty(16).optional(),
    location: nonEmpty(32).optional(),
    unit: nonEmpty(16).optional(),
  })
  .strict();

export const meterValueSchema = z
  .object({
    timestamp: dateTime,
    sampledValue: z.array(sampledValueSchema).min(1).max(32),
  })
  .strict();

export const meterValuesSchema = z
  .object({
    connectorId: z.number().int().nonnegative(),
    transactionId: z.number().int().nonnegative().optional(),
    meterValue: z.array(meterValueSchema).min(1).max(64),
  })
  .strict();

export const stopTransactionSchema = z
  .object({
    idTag: nonEmpty(20).optional(),
    meterStop: safeInteger,
    reason: nonEmpty(64).optional(),
    timestamp: dateTime,
    transactionId: z.number().int().nonnegative(),
    transactionData: z.array(meterValueSchema).max(64).optional(),
  })
  .strict();

export const remoteStartResponseSchema = z
  .object({ status: z.enum(['Accepted', 'Rejected']) })
  .strict();
export const remoteStopResponseSchema = remoteStartResponseSchema;

export type BootNotificationPayload = z.infer<typeof bootNotificationSchema>;
export type StatusNotificationPayload = z.infer<typeof statusNotificationSchema>;
export type StartTransactionPayload = z.infer<typeof startTransactionSchema>;
export type MeterValuesPayload = z.infer<typeof meterValuesSchema>;
export type StopTransactionPayload = z.infer<typeof stopTransactionSchema>;