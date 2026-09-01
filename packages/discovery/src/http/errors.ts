import {
  DiscoveryServiceNotStartedError,
  DiscoveryServiceStoppedError,
} from '../service/errors.js';
import { DiscoveryRuntimeClosedError } from '../runtime/errors.js';
import { SchedulerError } from '../scheduler/errors.js';
import { sanitizeRuntimeErrorMessage } from '../runtime/runtime-config.js';
import type {
  DiscoveryHttpErrorBody,
  DiscoveryHttpErrorCode,
  DiscoveryHttpResponse,
} from './types.js';

export class DiscoveryHttpError extends Error {
  readonly status: number;
  readonly code: DiscoveryHttpErrorCode;

  constructor(status: number, code: DiscoveryHttpErrorCode, message: string) {
    super(message);
    this.name = 'DiscoveryHttpError';
    this.status = status;
    this.code = code;
  }
}

export function jsonResponse(
  status: number,
  body: unknown,
  requestId: string,
  extraHeaders: Record<string, string> = {}
): DiscoveryHttpResponse {
  return {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-request-id': requestId,
      ...extraHeaders,
    },
    bodyText: JSON.stringify(body),
  };
}

export function errorResponse(
  status: number,
  code: DiscoveryHttpErrorCode,
  message: string,
  requestId: string,
  secrets: readonly string[] = [],
  extraHeaders: Record<string, string> = {}
): DiscoveryHttpResponse {
  const body: DiscoveryHttpErrorBody = {
    error: {
      code,
      message: sanitizeRuntimeErrorMessage(message, secrets),
      requestId,
    },
  };
  return jsonResponse(status, body, requestId, extraHeaders);
}

export function unauthenticatedResponse(
  requestId: string,
  secrets: readonly string[] = []
): DiscoveryHttpResponse {
  return errorResponse(
    401,
    'UNAUTHENTICATED',
    'Authentication required',
    requestId,
    secrets,
    { 'www-authenticate': 'Bearer' }
  );
}

export function forbiddenResponse(
  requestId: string,
  secrets: readonly string[] = []
): DiscoveryHttpResponse {
  return errorResponse(403, 'FORBIDDEN', 'Forbidden', requestId, secrets);
}

export function mapApplicationError(
  err: unknown,
  requestId: string,
  secrets: readonly string[] = []
): DiscoveryHttpResponse {
  if (err instanceof DiscoveryHttpError) {
    if (err.code === 'UNAUTHENTICATED' || err.status === 401) {
      return unauthenticatedResponse(requestId, secrets);
    }
    if (err.code === 'FORBIDDEN' || err.status === 403) {
      return forbiddenResponse(requestId, secrets);
    }
    return errorResponse(err.status, err.code, err.message, requestId, secrets);
  }
  if (err instanceof DiscoveryServiceNotStartedError) {
    return errorResponse(
      503,
      'SERVICE_NOT_STARTED',
      err.message,
      requestId,
      secrets
    );
  }
  if (err instanceof DiscoveryServiceStoppedError) {
    return errorResponse(503, 'SERVICE_STOPPED', err.message, requestId, secrets);
  }
  if (err instanceof DiscoveryRuntimeClosedError) {
    return errorResponse(
      503,
      'RUNTIME_UNAVAILABLE',
      err.message,
      requestId,
      secrets
    );
  }
  if (err instanceof SchedulerError) {
    return errorResponse(400, 'INVALID_REQUEST', err.message, requestId, secrets);
  }

  const raw = err instanceof Error ? err.message : 'Internal server error';
  return errorResponse(
    500,
    'INTERNAL_ERROR',
    sanitizeRuntimeErrorMessage(raw, secrets) || 'Internal server error',
    requestId,
    secrets
  );
}
