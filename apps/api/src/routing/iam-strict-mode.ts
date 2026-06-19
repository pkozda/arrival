import { emitIAMEvent, IAMEventType, type IAMEventLogger } from '../observability/iam-events.js';

export class RouteSecurityMisconfigurationError extends Error {
  readonly code = 'UNCLASSIFIED_ROUTE';

  constructor(
    public readonly method: string,
    public readonly path: string
  ) {
    super(`UNCLASSIFIED_ROUTE: ${method} ${path}`);
    this.name = 'RouteSecurityMisconfigurationError';
  }
}

export function isIamStrictModeEnabled(): boolean {
  const explicit = process.env.ARRIVAL_ATLAS_IAM_STRICT;
  if (explicit === 'true') {
    return true;
  }
  if (explicit === 'false') {
    return false;
  }
  return process.env.NODE_ENV === 'test';
}

export function handleRouteSecurityMisconfiguration(
  logger: IAMEventLogger,
  method: string,
  path: string
): boolean {
  emitIAMEvent(logger, IAMEventType.ROUTE_UNCLASSIFIED, { method, path });

  if (isIamStrictModeEnabled()) {
    throw new RouteSecurityMisconfigurationError(method, path);
  }

  return true;
}
