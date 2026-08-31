/**
 * User-facing attention lifecycle for a DiscoveryResult.
 * Engine sets NEW / EXPIRED; notification sets NOTIFIED; UI sets SEEN/OPENED/SAVED/DISMISSED.
 */
export type ResultState =
  | 'NEW'
  | 'SEEN'
  | 'NOTIFIED'
  | 'OPENED'
  | 'SAVED'
  | 'DISMISSED'
  | 'EXPIRED';

export type ResultLifecycleStatus = 'ACTIVE' | 'UPDATED' | 'EXPIRED' | 'REMOVED';

export type ResultStateActor = 'engine' | 'notification' | 'ui' | 'user';

export type ResultStateTransition = {
  from: ResultState | null;
  to: ResultState;
  actor: ResultStateActor;
};
