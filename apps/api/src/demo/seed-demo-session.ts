import type { UserContextV1 } from '@arrival-atlas/product-contract';
import {
  DEMO_FIXED_GENERATED_AT,
  isDemoPersonaId,
  resolveDemoUserContext,
  type DemoPersonaId,
} from '@arrival-atlas/life-event-demo';
import { getPersistedSystemStateStore } from '../state/persisted-system-state-store.js';
import { emptyProfileMutationFields } from '../state/profile-mutation-state.js';
import { systemStateCoordinator } from '../state/system-state-coordinator.js';

export async function seedDemoPersonaSession(
  sessionId: string,
  personaId: DemoPersonaId
): Promise<UserContextV1> {
  const state = await systemStateCoordinator.getState(sessionId);
  if (!state) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const userContext = resolveDemoUserContext(personaId);
  const store = getPersistedSystemStateStore();

  await store.save({
    ...state,
    ...emptyProfileMutationFields(),
    userContext,
    generatedAt: DEMO_FIXED_GENERATED_AT,
  });
  systemStateCoordinator.resetCache();

  return userContext;
}

export function parseDemoPersonaId(value: unknown): DemoPersonaId | null {
  return typeof value === 'string' && isDemoPersonaId(value) ? value : null;
}
