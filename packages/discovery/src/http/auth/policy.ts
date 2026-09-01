import type { DiscoveryPermission } from './types.js';

export type AdminRoutePolicy =
  | { kind: 'public' }
  | { kind: 'protected'; permission: DiscoveryPermission };

/**
 * Endpoint → permission matrix (E6.3).
 * /health is public. All other known admin routes require authz.
 */
export function resolveAdminRoutePolicy(
  method: string,
  path: string
): AdminRoutePolicy | null {
  const m = method.toUpperCase();

  if (m === 'GET' && path === '/health') {
    return { kind: 'public' };
  }
  if (m === 'GET' && path === '/status') {
    return { kind: 'protected', permission: 'discovery:read' };
  }
  if (m === 'GET' && path === '/schedules') {
    return { kind: 'protected', permission: 'discovery:read' };
  }
  if (m === 'POST' && path === '/schedules') {
    return { kind: 'protected', permission: 'discovery:schedule:write' };
  }
  if (m === 'POST' && /^\/schedules\/[^/]+\/enable$/.test(path)) {
    return { kind: 'protected', permission: 'discovery:schedule:write' };
  }
  if (m === 'POST' && /^\/schedules\/[^/]+\/disable$/.test(path)) {
    return { kind: 'protected', permission: 'discovery:schedule:write' };
  }
  if (m === 'POST' && /^\/schedules\/[^/]+\/run$/.test(path)) {
    return { kind: 'protected', permission: 'discovery:run' };
  }
  if (m === 'GET' && /^\/runs\/[^/]+$/.test(path)) {
    return { kind: 'protected', permission: 'discovery:read' };
  }
  if (m === 'POST' && path === '/worker/process-next') {
    return { kind: 'protected', permission: 'discovery:worker:process' };
  }

  return null;
}
