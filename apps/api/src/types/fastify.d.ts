import type { ResolvedIdentity } from '../auth/resolved-identity.js';

declare module 'fastify' {
  interface FastifyRequest {
    identity?: ResolvedIdentity;
  }
}
