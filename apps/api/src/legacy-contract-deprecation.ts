import type { FastifyReply } from 'fastify';

const LEGACY_DEPRECATION_MESSAGE =
  'Legacy contract compatibility is deprecated and will be removed in a future release.';

export function markLegacyContractDeprecated(
  reply: FastifyReply,
  feature: 'execute' | 'snapshot'
): void {
  reply.header('Deprecation', 'true');
  reply.header('Sunset', 'TBD');
  reply.header(
    'x-deprecation-notice',
    `${feature}: ${LEGACY_DEPRECATION_MESSAGE}`
  );
}
