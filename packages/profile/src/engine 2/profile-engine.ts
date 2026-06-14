import { ProfileNotFoundError } from '../errors/profile-revision-conflict.js';
import { migrateProfileDocument } from '../migrations/index.js';
import type { ProfileStore } from '../ports/profile-store.js';
import type { ProfileCreateInput, ProfilePatch } from '../types/profile-document.js';
import { ProfileCreateInputSchema, ProfileDocumentSchema } from '../types/profile-document.js';
import type { ProfileRecord } from '../types/profile-record.js';
import type { ProfileSlice } from '../types/profile-slice.js';
import { createEmptyProfileDocument } from '../utils/merge-profile.js';

const CORE_SLICE_KEYS = [
  'preferredLanguage',
  'countryOfOrigin',
  'location',
  'residency',
  'household',
  'employment',
  'housing',
  'insurance',
  'benefits',
] as const;

export class ProfileEngine {
  constructor(private readonly store: ProfileStore) {}

  async createProfile(input: ProfileCreateInput = {}): Promise<ProfileRecord> {
    const parsed = ProfileCreateInputSchema.parse(input);
    const document = ProfileDocumentSchema.parse(createEmptyProfileDocument(parsed));
    return this.store.create(document, { changedBy: 'user' });
  }

  async getProfile(profileId: string): Promise<ProfileRecord | null> {
    const record = await this.store.get(profileId);
    if (!record) return null;
    return this.withMigratedDocument(record);
  }

  async getProfileBySession(sessionId: string): Promise<ProfileRecord | null> {
    const record = await this.store.getBySession(sessionId);
    if (!record) return null;
    return this.withMigratedDocument(record);
  }

  async updateProfile(
    profileId: string,
    patch: ProfilePatch,
    expectedRevision: number
  ): Promise<ProfileRecord> {
    const updated = await this.store.update(profileId, patch, expectedRevision, {
      changedBy: 'user',
    });
    return this.withMigratedDocument(updated);
  }

  async deleteProfile(profileId: string): Promise<void> {
    await this.store.delete(profileId);
  }

  async listRevisions(profileId: string) {
    return this.store.listRevisions(profileId);
  }

  async bindSession(sessionId: string, profileId: string): Promise<void> {
    const profile = await this.store.get(profileId);
    if (!profile) {
      throw new ProfileNotFoundError(profileId);
    }
    await this.store.bindSession(sessionId, profileId);
  }

  /** @internal Used by resolveExecutionContext pipeline via buildAppContext */
  resolveForModule(moduleId: string, profile: ProfileRecord): ProfileSlice {
    const document = migrateProfileDocument(profile.document);
    const slice: ProfileSlice = {
      preferredLanguage: document.preferredLanguage,
    };

    for (const key of CORE_SLICE_KEYS) {
      if (key === 'preferredLanguage') continue;
      const value = document[key];
      if (value !== undefined) {
        (slice as unknown as Record<string, unknown>)[key] = value;
      }
    }

    const moduleExtension = document.extensions[moduleId];
    if (moduleExtension) {
      slice.extensions = { [moduleId]: moduleExtension };
    }

    return slice;
  }

  private withMigratedDocument(record: ProfileRecord): ProfileRecord {
    return {
      ...record,
      document: migrateProfileDocument(record.document),
    };
  }
}
