import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

/**
 * Host-global Discovery ops authorization (H3).
 * Reuses the same pattern as Discovery admin bearer tokens:
 * a composition-root shared secret, not a user/account role system.
 *
 * Configure: ARRIVAL_ATLAS_OPS_TOKEN
 * Present via: Authorization: Bearer <token>  OR  x-arrival-ops-token: <token>
 *
 * When the env token is unset/empty, ops endpoints fail closed.
 */

export const ARRIVAL_OPS_TOKEN_HEADER = 'x-arrival-ops-token';

export function resolveArrivalOpsTokenFromEnv(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const token = env.ARRIVAL_ATLAS_OPS_TOKEN?.trim();
  return token && token.length > 0 ? token : null;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function extractOpsTokenFromRequest(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (typeof authorization === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const header = request.headers[ARRIVAL_OPS_TOKEN_HEADER];
  if (typeof header === 'string' && header.trim().length > 0) {
    return header.trim();
  }
  if (Array.isArray(header) && typeof header[0] === 'string' && header[0].trim()) {
    return header[0].trim();
  }

  return null;
}

export type OpsTokenAccessResult =
  | { ok: true }
  | { ok: false; reason: 'ops_token_not_configured' | 'ops_token_invalid' };

/**
 * Validate ops credential for host-global Discovery ops routes.
 */
export function evaluateOpsTokenAccess(
  request: FastifyRequest,
  env: NodeJS.ProcessEnv = process.env
): OpsTokenAccessResult {
  const expected = resolveArrivalOpsTokenFromEnv(env);
  if (!expected) {
    return { ok: false, reason: 'ops_token_not_configured' };
  }

  const provided = extractOpsTokenFromRequest(request);
  if (!provided || !safeEqual(provided, expected)) {
    return { ok: false, reason: 'ops_token_invalid' };
  }

  return { ok: true };
}
