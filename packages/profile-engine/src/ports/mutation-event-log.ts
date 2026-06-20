import type { MutationEvent } from '@arrival-atlas/product-contract';

export interface MutationEventLogPort {
  list(profileId: string): readonly MutationEvent[];
  findByMutationId(mutationId: string): MutationEvent | null;
  append(event: MutationEvent): MutationEvent;
  getHeadRevision(profileId: string): number;
  getLastSequence(profileId: string): number;
}

export class InMemoryMutationEventLog implements MutationEventLogPort {
  private readonly eventsByProfile = new Map<string, MutationEvent[]>();
  private readonly eventsByMutationId = new Map<string, MutationEvent>();

  list(profileId: string): readonly MutationEvent[] {
    return [...(this.eventsByProfile.get(profileId) ?? [])];
  }

  findByMutationId(mutationId: string): MutationEvent | null {
    return this.eventsByMutationId.get(mutationId) ?? null;
  }

  append(event: MutationEvent): MutationEvent {
    const existing = this.eventsByMutationId.get(event.mutationId);
    if (existing) {
      return existing;
    }

    const profileEvents = this.eventsByProfile.get(event.profileId) ?? [];
    profileEvents.push(event);
    this.eventsByProfile.set(event.profileId, profileEvents);
    this.eventsByMutationId.set(event.mutationId, event);
    return event;
  }

  getHeadRevision(profileId: string): number {
    const events = this.eventsByProfile.get(profileId) ?? [];
    if (events.length === 0) {
      return 0;
    }

    return events.reduce((max, event) => Math.max(max, event.revision), 0);
  }

  getLastSequence(profileId: string): number {
    const events = this.eventsByProfile.get(profileId) ?? [];
    if (events.length === 0) {
      return 0;
    }

    return events.reduce((max, event) => Math.max(max, event.sequence), 0);
  }
}
