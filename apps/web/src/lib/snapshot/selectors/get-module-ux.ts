import type { UiSnapshot } from '@/lib/product-contract';

export function getModuleUx(snapshot: UiSnapshot | null, moduleId: string) {
  if (!snapshot) {
    return [];
  }

  return snapshot.actionCards.filter((card) => card.moduleId === moduleId);
}
