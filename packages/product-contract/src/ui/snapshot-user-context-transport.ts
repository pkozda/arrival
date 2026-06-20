import type { UserContextV1 } from '../profile/user-profile-view.js';

/**
 * Non-authoritative duplicate of UserContextV1 embedded in GET /api/ui-snapshot responses.
 *
 * - Derived at projection time from the same reducer output as GET /api/user-context
 * - Transport convenience only — MUST NOT be used as a source of truth
 * - Web/UI business logic MUST read situation data via AppProvider.userContext
 *   (from GET /api/user-context) and `selectUserContextProfile()` only
 *
 * @see UserContextV1 — authoritative read model (GET /api/user-context)
 */
export type SnapshotUserContextTransport = UserContextV1;

/** Marks responses from GET /api/ui-snapshot?snapshotVersion=legacy — compatibility only. */
export type LegacySnapshotContract = 'legacy-compatibility-only';
