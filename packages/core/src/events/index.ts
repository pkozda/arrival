import type { TrackedEvent } from '../types/index.js';

const events: TrackedEvent[] = [];
const MAX_EVENTS = 10_000;

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function trackEvent(
  type: string,
  options: {
    moduleId?: string;
    payload?: Record<string, unknown>;
    sessionId?: string;
  } = {}
): TrackedEvent {
  const event: TrackedEvent = {
    id: generateEventId(),
    type,
    moduleId: options.moduleId,
    payload: options.payload,
    timestamp: new Date().toISOString(),
    sessionId: options.sessionId,
  };

  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.shift();
  }

  return event;
}

export function getEvents(filter?: {
  type?: string;
  moduleId?: string;
  sessionId?: string;
  limit?: number;
}): TrackedEvent[] {
  let result = [...events];

  if (filter?.type) {
    result = result.filter((e) => e.type === filter.type);
  }
  if (filter?.moduleId) {
    result = result.filter((e) => e.moduleId === filter.moduleId);
  }
  if (filter?.sessionId) {
    result = result.filter((e) => e.sessionId === filter.sessionId);
  }

  result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (filter?.limit) {
    result = result.slice(0, filter.limit);
  }

  return result;
}

export function clearEvents(): void {
  events.length = 0;
}
