import type { ProfileDocument } from './profile-document.js';

export type ProfileChangeActor = 'user' | 'module' | 'system' | 'migration';

export interface ProfileRecord {
  id: string;
  revision: number;
  document: ProfileDocument;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileRevision {
  id: string;
  profileId: string;
  revision: number;
  schemaVersion: string;
  document: ProfileDocument;
  changedFields: string[];
  changedBy: ProfileChangeActor;
  moduleId?: string;
  createdAt: string;
}

export interface CreateProfileMeta {
  changedBy?: ProfileChangeActor;
  moduleId?: string;
}

export interface UpdateProfileMeta {
  changedBy?: ProfileChangeActor;
  moduleId?: string;
}
