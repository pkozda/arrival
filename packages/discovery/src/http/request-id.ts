import { randomUUID } from 'node:crypto';
import {
  DISCOVERY_REQUEST_ID_HEADER,
  type DiscoveryHttpHeaders,
} from './types.js';

export function headerValue(
  headers: DiscoveryHttpHeaders,
  name: string
): string | undefined {
  const key = Object.keys(headers).find(
    (k) => k.toLowerCase() === name.toLowerCase()
  );
  if (!key) return undefined;
  const value = headers[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Resolve HTTP request correlation ID.
 * Accepts incoming x-request-id when present and well-formed; otherwise generates.
 */
export function resolveRequestId(headers: DiscoveryHttpHeaders): string {
  const incoming = headerValue(headers, DISCOVERY_REQUEST_ID_HEADER)?.trim();
  if (incoming && incoming.length <= 128 && /^[\w.:@+/-]+$/.test(incoming)) {
    return incoming;
  }
  return randomUUID();
}
