import type { AuthContext } from '../auth/auth.types.js';
import type { ResolvedIdentity } from '../auth/resolved-identity.js';
import type { AccountContext } from '../authz/account-context.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
    identity?: ResolvedIdentity;
    accountContext?: AccountContext;
  }
}
