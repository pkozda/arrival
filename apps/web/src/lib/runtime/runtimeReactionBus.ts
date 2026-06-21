import type { SyncPlan } from './domainSyncGraph';
import type { SyncScope } from './syncScope';
import type { UserContextV1 } from '@/lib/product-contract';

export type RuntimeReactionEvent =
  | {
      type: 'PROFILE_MUTATED';
      revision: number;
      userContext: UserContextV1;
    }
  | {
      type: 'ECONOMIC_ACTION_EXECUTED';
      actionId: string;
      previousDeterministicHash: string;
      deterministicHash: string;
      planChanged: boolean;
    }
  | {
      type: 'SESSION_SYNC_REQUESTED';
      scope?: SyncScope;
    }
  | {
      type: 'SYNC_STARTED';
      plan: SyncPlan;
      trigger: RuntimeReactionInputEvent['type'];
    }
  | {
      type: 'SYNC_COMPLETED';
      plan: SyncPlan;
      success: boolean;
    };

export type RuntimeReactionInputEvent = Exclude<
  RuntimeReactionEvent,
  { type: 'SYNC_STARTED' } | { type: 'SYNC_COMPLETED' }
>;

export type RuntimeReactionEventType = RuntimeReactionEvent['type'];

type RuntimeReactionHandler = (event: RuntimeReactionEvent) => void;

const listeners = new Map<RuntimeReactionEventType, Set<RuntimeReactionHandler>>();

export function subscribe(
  eventType: RuntimeReactionEventType,
  handler: RuntimeReactionHandler
): () => void {
  const bucket = listeners.get(eventType) ?? new Set<RuntimeReactionHandler>();
  bucket.add(handler);
  listeners.set(eventType, bucket);

  return () => {
    bucket.delete(handler);
    if (bucket.size === 0) {
      listeners.delete(eventType);
    }
  };
}

export function emit(event: RuntimeReactionEvent): void {
  const bucket = listeners.get(event.type);
  if (!bucket) {
    return;
  }

  for (const handler of bucket) {
    handler(event);
  }
}
