export type OcppJsonObject = Record<string, unknown>;

export type OcppCall = [
  messageTypeId: 2,
  uniqueId: string,
  action: string,
  payload: OcppJsonObject,
];
export type OcppCallResult = [
  messageTypeId: 3,
  uniqueId: string,
  payload: OcppJsonObject,
];
export type OcppCallError = [
  messageTypeId: 4,
  uniqueId: string,
  errorCode: string,
  errorDescription: string,
  errorDetails: OcppJsonObject,
];
export type OcppFrame = OcppCall | OcppCallResult | OcppCallError;

export type OcppErrorCode =
  | 'NotImplemented'
  | 'NotSupported'
  | 'InternalError'
  | 'ProtocolError'
  | 'SecurityError'
  | 'FormationViolation'
  | 'PropertyConstraintViolation'
  | 'OccurrenceConstraintViolation'
  | 'TypeConstraintViolation'
  | 'GenericError';

export class OcppProtocolError extends Error {
  constructor(
    readonly errorCode: OcppErrorCode,
    message: string,
    readonly details: OcppJsonObject = {},
  ) {
    super(message);
  }
}

function isObject(value: unknown): value is OcppJsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validUniqueId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64;
}

export function parseOcppFrame(
  raw: string,
  maximumPayloadBytes = 64 * 1024,
): OcppFrame {
  if (Buffer.byteLength(raw, 'utf8') > maximumPayloadBytes) {
    throw new OcppProtocolError('FormationViolation', 'Frame exceeds payload limit.');
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw) as unknown;
  } catch {
    throw new OcppProtocolError('FormationViolation', 'Frame is not valid JSON.');
  }
  if (!Array.isArray(decoded)) {
    throw new OcppProtocolError('FormationViolation', 'Frame must be a JSON array.');
  }

  const messageTypeId: unknown = decoded[0];
  const uniqueId: unknown = decoded[1];
  if (!validUniqueId(uniqueId)) {
    throw new OcppProtocolError('FormationViolation', 'Invalid uniqueId.');
  }

  if (messageTypeId === 2) {
    if (
      decoded.length !== 4 ||
      typeof decoded[2] !== 'string' ||
      decoded[2].length === 0 ||
      decoded[2].length > 64 ||
      !isObject(decoded[3])
    ) {
      throw new OcppProtocolError('FormationViolation', 'Invalid CALL frame.');
    }
    return [2, uniqueId, decoded[2], decoded[3]];
  }

  if (messageTypeId === 3) {
    if (decoded.length !== 3 || !isObject(decoded[2])) {
      throw new OcppProtocolError('FormationViolation', 'Invalid CALLRESULT frame.');
    }
    return [3, uniqueId, decoded[2]];
  }

  if (messageTypeId === 4) {
    if (
      decoded.length !== 5 ||
      typeof decoded[2] !== 'string' ||
      typeof decoded[3] !== 'string' ||
      decoded[3].length > 512 ||
      !isObject(decoded[4])
    ) {
      throw new OcppProtocolError('FormationViolation', 'Invalid CALLERROR frame.');
    }
    return [4, uniqueId, decoded[2], decoded[3], decoded[4]];
  }

  throw new OcppProtocolError('FormationViolation', 'Unknown message type.');
}

export function callResult(
  uniqueId: string,
  payload: OcppJsonObject,
): OcppCallResult {
  return [3, uniqueId, payload];
}

export function callError(
  uniqueId: string,
  error: OcppProtocolError,
): OcppCallError {
  return [4, uniqueId, error.errorCode, error.message.slice(0, 512), error.details];
}

export function serializeOcppFrame(frame: OcppFrame): string {
  return JSON.stringify(frame);
}