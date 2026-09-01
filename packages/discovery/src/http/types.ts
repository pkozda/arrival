/** Transport-neutral HTTP request/response for the Discovery admin API (E6.2). */

export type DiscoveryHttpHeaders = Record<string, string | string[] | undefined>;

export type DiscoveryHttpRequest = {
  method: string;
  /** Pathname only (no query), e.g. `/schedules/abc` */
  path: string;
  headers: DiscoveryHttpHeaders;
  /** Raw body string when present. */
  bodyText?: string;
};

export type DiscoveryHttpResponse = {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
};

export type DiscoveryHttpErrorCode =
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'SERVICE_NOT_STARTED'
  | 'SERVICE_STOPPED'
  | 'RUNTIME_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export type DiscoveryHttpErrorBody = {
  error: {
    code: DiscoveryHttpErrorCode;
    message: string;
    requestId: string;
  };
};

export const DISCOVERY_REQUEST_ID_HEADER = 'x-request-id';
export const MAX_ADMIN_BODY_BYTES = 65_536;
