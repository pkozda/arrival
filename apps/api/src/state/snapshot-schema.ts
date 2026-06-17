export const UI_SNAPSHOT_SCHEMA_VERSION = 1;

export type SnapshotProjectionErrorCode =
  | 'INVALID_SYSTEM_STATE'
  | 'UNSUPPORTED_SCHEMA_VERSION';

export class SnapshotProjectionError extends Error {
  readonly code: SnapshotProjectionErrorCode;

  constructor(code: SnapshotProjectionErrorCode, message: string) {
    super(message);
    this.name = 'SnapshotProjectionError';
    this.code = code;
  }
}
