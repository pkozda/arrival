import type { MutationEvent } from '@arrival-atlas/product-contract';
import type { MutationEventLogPort } from '@arrival-atlas/profile-engine';

/**
 * Append-only event log backed by mutable in-memory array.
 * Persisted via SystemState.profileMutationEvents after coordinator commit.
 */
export class SessionMutationEventLog implements MutationEventLogPort {
  constructor(
    private readonly profileId: string,
    private readonly events: MutationEvent[]
  ) {}

  list(profileId: string): readonly MutationEvent[] {
    if (profileId !== this.profileId) {
      return [];
    }

    return [...this.events].sort((left, right) => left.sequence - right.sequence);
  }

  findByMutationId(mutationId: string): MutationEvent | null {
    return this.events.find((event) => event.mutationId === mutationId) ?? null;
  }

  append(event: MutationEvent): MutationEvent {
    const existing = this.findByMutationId(event.mutationId);
    if (existing) {
      return existing;
    }

    this.events.push(event);
    return event;
  }

  getHeadRevision(profileId: string): number {
    if (profileId !== this.profileId) {
      return 0;
    }

    return this.events.reduce((max, event) => Math.max(max, event.revision), 0);
  }

  getLastSequence(profileId: string): number {
    if (profileId !== this.profileId) {
      return 0;
    }

    return this.events.reduce((max, event) => Math.max(max, event.sequence), 0);
  }

  getEvents(): MutationEvent[] {
    return [...this.events];
  }
}
