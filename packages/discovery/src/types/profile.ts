import type { DiscoveryCriteria } from './criteria.js';

export type DiscoverySchedule =
  | { cadence: 'daily'; hourUtc: number }
  | { cadence: 'weekly'; dayOfWeek: number; hourUtc: number }
  | { cadence: 'manual' };

export type NotificationPreferences = {
  emailEnabled: boolean;
  skipEmptyDigest: boolean;
};

export type DiscoveryProfile = {
  id: string;
  userId: string;
  name: string;
  /** Immutable after create (MVP). */
  strategyId: string;
  strategyVersion: string;
  criteria: DiscoveryCriteria;
  schedule: DiscoverySchedule;
  notification: NotificationPreferences;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};
