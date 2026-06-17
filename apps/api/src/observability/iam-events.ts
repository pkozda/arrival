export enum IAMEventType {
  TOKEN_ACCOUNT_DRIFT_DETECTED = 'TOKEN_ACCOUNT_DRIFT_DETECTED',
  TOKEN_ACCOUNT_IGNORED = 'TOKEN_ACCOUNT_IGNORED',
  TOKEN_MISMATCH = 'token_mismatch',
  LEGACY_USED = 'legacy_used',
  REGISTRY_BACKFILL = 'registry_backfill',
  AUTH_SUBJECT_NULL = 'auth_subject_null',
  ROUTE_UNCLASSIFIED = 'route_unclassified',
}

export type IAMEventPayload = Record<string, unknown>;

export type IAMEventLogger = {
  warn: (payload: IAMEventPayload) => void;
};

export function emitIAMEvent(
  logger: IAMEventLogger,
  type: IAMEventType,
  payload: IAMEventPayload = {}
): void {
  logger.warn({
    iamEvent: type,
    ...payload,
  });
}
