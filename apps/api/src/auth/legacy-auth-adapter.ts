import type { FastifyRequest } from 'fastify';

export function extractLegacySessionId(request: FastifyRequest): string | undefined {
  const header = request.headers['x-session-id'];
  return typeof header === 'string' && header.length > 0 ? header : undefined;
}

export function hasLegacySessionCredential(request: FastifyRequest): boolean {
  return extractLegacySessionId(request) !== undefined;
}
