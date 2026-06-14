import type { ProfileDocument } from '../types/profile-document.js';
import { PROFILE_SCHEMA_VERSION } from '../types/profile-document.js';

/**
 * Migration hook — Phase 0 stub returns document unchanged.
 * Future versions add transform chains here.
 */
export function migrateProfileDocument(document: ProfileDocument): ProfileDocument {
  if (document.schemaVersion === PROFILE_SCHEMA_VERSION) {
    return document;
  }

  // Stub: accept unknown versions without mutation until migrations are implemented.
  return {
    ...document,
    schemaVersion: PROFILE_SCHEMA_VERSION,
  };
}
