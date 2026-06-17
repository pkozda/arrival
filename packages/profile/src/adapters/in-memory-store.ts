import { ProfileNotFoundError, ProfileRevisionConflictError } from '../errors/profile-revision-conflict.js';
import type { ProfileStore } from '../ports/profile-store.js';
import type {
  CreateProfileMeta,
  ProfileRecord,
  ProfileRevision,
  UpdateProfileMeta,
} from '../types/profile-record.js';
import type { ProfileDocument, ProfilePatch } from '../types/profile-document.js';
import {
  collectChangedFields,
  createEmptyProfileDocument,
  deepMergeProfile,
} from '../utils/merge-profile.js';

function generateProfileId(): string {
  return `prof_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function generateRevisionId(): string {
  return `prev_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export class InMemoryProfileStore implements ProfileStore {
  private profiles = new Map<string, ProfileRecord>();
  private revisions = new Map<string, ProfileRevision[]>();
  private sessionToProfile = new Map<string, string>();

  async create(document: ProfileDocument, meta: CreateProfileMeta = {}): Promise<ProfileRecord> {
    const id = generateProfileId();
    const now = new Date().toISOString();
    const normalized = createEmptyProfileDocument(document);

    const record: ProfileRecord = {
      id,
      revision: 1,
      document: normalized,
      createdAt: now,
      updatedAt: now,
    };

    this.profiles.set(id, record);
    this.revisions.set(id, [
      this.toRevision(record, ['*'], meta.changedBy ?? 'user', meta.moduleId),
    ]);

    return record;
  }

  async get(profileId: string): Promise<ProfileRecord | null> {
    return this.profiles.get(profileId) ?? null;
  }

  async update(
    profileId: string,
    patch: ProfilePatch,
    expectedRevision: number,
    meta: UpdateProfileMeta = {}
  ): Promise<ProfileRecord> {
    const existing = this.profiles.get(profileId);
    if (!existing) {
      throw new ProfileNotFoundError(profileId);
    }

    if (existing.revision !== expectedRevision) {
      throw new ProfileRevisionConflictError(expectedRevision, existing.revision);
    }

    const mergedDocument = deepMergeProfile(existing.document, patch);
    const changedFields = collectChangedFields(existing.document, mergedDocument);
    const now = new Date().toISOString();
    const nextRevision = existing.revision + 1;

    const updated: ProfileRecord = {
      ...existing,
      revision: nextRevision,
      document: mergedDocument,
      updatedAt: now,
    };

    this.profiles.set(profileId, updated);
    const history = this.revisions.get(profileId) ?? [];
    history.push(
      this.toRevision(updated, changedFields, meta.changedBy ?? 'user', meta.moduleId)
    );
    this.revisions.set(profileId, history);

    return updated;
  }

  async delete(profileId: string): Promise<void> {
    if (!this.profiles.has(profileId)) {
      throw new ProfileNotFoundError(profileId);
    }

    this.profiles.delete(profileId);
    this.revisions.delete(profileId);

    for (const [sessionId, boundProfileId] of this.sessionToProfile.entries()) {
      if (boundProfileId === profileId) {
        this.sessionToProfile.delete(sessionId);
      }
    }
  }

  async listRevisions(profileId: string): Promise<ProfileRevision[]> {
    const history = this.revisions.get(profileId);
    if (!history) {
      throw new ProfileNotFoundError(profileId);
    }
    return [...history].sort((a, b) => b.revision - a.revision);
  }

  async bindSession(sessionId: string, profileId: string): Promise<void> {
    if (!this.profiles.has(profileId)) {
      throw new ProfileNotFoundError(profileId);
    }
    this.sessionToProfile.set(sessionId, profileId);
  }

  async getBySession(sessionId: string): Promise<ProfileRecord | null> {
    const profileId = this.sessionToProfile.get(sessionId);
    if (!profileId) return null;
    return this.get(profileId);
  }

  /** Test helper — clear all state */
  clear(): void {
    this.profiles.clear();
    this.revisions.clear();
    this.sessionToProfile.clear();
  }

  /** Restores a profile record and session binding (used by state hydration). */
  restoreRecord(record: ProfileRecord, sessionId: string): void {
    this.profiles.set(record.id, { ...record, document: { ...record.document } });
    this.sessionToProfile.set(sessionId, record.id);
    if (!this.revisions.has(record.id)) {
      this.revisions.set(record.id, [
        {
          id: `prev_restore_${record.id}`,
          profileId: record.id,
          revision: record.revision,
          schemaVersion: record.document.schemaVersion,
          document: record.document,
          changedFields: ['*'],
          changedBy: 'system',
          createdAt: record.updatedAt,
        },
      ]);
    }
  }

  private toRevision(
    record: ProfileRecord,
    changedFields: string[],
    changedBy: ProfileRevision['changedBy'],
    moduleId?: string
  ): ProfileRevision {
    return {
      id: generateRevisionId(),
      profileId: record.id,
      revision: record.revision,
      schemaVersion: record.document.schemaVersion,
      document: record.document,
      changedFields,
      changedBy,
      moduleId,
      createdAt: record.updatedAt,
    };
  }
}
