import type { ProfileDocument } from './profile-document.js';

/** Resolved profile view exposed to a specific module */
export interface ProfileSlice {
  preferredLanguage: ProfileDocument['preferredLanguage'];
  countryOfOrigin?: string;
  location?: ProfileDocument['location'];
  residency?: ProfileDocument['residency'];
  household?: ProfileDocument['household'];
  employment?: ProfileDocument['employment'];
  housing?: ProfileDocument['housing'];
  insurance?: ProfileDocument['insurance'];
  benefits?: ProfileDocument['benefits'];
  extensions?: Record<string, unknown>;
}
