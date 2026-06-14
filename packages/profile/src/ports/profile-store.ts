import type {
  CreateProfileMeta,
  ProfileRecord,
  ProfileRevision,
  UpdateProfileMeta,
} from '../types/profile-record.js';
import type { ProfileDocument, ProfilePatch } from '../types/profile-document.js';

export interface ProfileStore {
  create(document: ProfileDocument, meta?: CreateProfileMeta): Promise<ProfileRecord>;
  get(profileId: string): Promise<ProfileRecord | null>;
  update(
    profileId: string,
    patch: ProfilePatch,
    expectedRevision: number,
    meta?: UpdateProfileMeta
  ): Promise<ProfileRecord>;
  delete(profileId: string): Promise<void>;
  listRevisions(profileId: string): Promise<ProfileRevision[]>;
  bindSession(sessionId: string, profileId: string): Promise<void>;
  getBySession(sessionId: string): Promise<ProfileRecord | null>;
}
