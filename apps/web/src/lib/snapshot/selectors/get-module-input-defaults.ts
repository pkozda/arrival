import type { UiSnapshot } from '@/lib/api';
import { getProfileInputDefaults } from './module-input-defaults';

export function getModuleInputDefaults(
  snapshot: UiSnapshot | null,
  moduleId: string
): Record<string, unknown> {
  return getProfileInputDefaults(snapshot?.profile ?? null, moduleId);
}
