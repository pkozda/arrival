export type DiscoveryApiErrorCode =
  | 'FETCH_FAILED'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'INVALID_REQUEST'
  | 'CONFLICT'
  | 'STATE_UPDATE_FAILED';

export class DiscoveryApiError extends Error {
  readonly code: DiscoveryApiErrorCode;

  constructor(message: string, code: DiscoveryApiErrorCode) {
    super(message);
    this.name = 'DiscoveryApiError';
    this.code = code;
  }
}

export function isDiscoveryApiErrorCode(value: unknown): value is DiscoveryApiErrorCode {
  return (
    value === 'FETCH_FAILED' ||
    value === 'UNAUTHORIZED' ||
    value === 'NOT_FOUND' ||
    value === 'INVALID_REQUEST' ||
    value === 'CONFLICT' ||
    value === 'STATE_UPDATE_FAILED'
  );
}
