import type { UiSnapshot } from '@/lib/product-contract';

export function getGlobalUxActions(snapshot: UiSnapshot | null) {
  return snapshot?.actionCards ?? [];
}

export function getPrioritySignals(snapshot: UiSnapshot | null) {
  if (!snapshot) {
    return [];
  }

  return snapshot.recommendations.filter(
    (recommendation) => recommendation.priority === 'high' || recommendation.priority === 'critical'
  );
}

export function getAttentionLayer(snapshot: UiSnapshot | null) {
  return getGlobalUxActions(snapshot).filter((card) => card.priority === 'high').slice(0, 2);
}

export function hasGlobalUx(snapshot: UiSnapshot | null): boolean {
  return getGlobalUxActions(snapshot).length > 0;
}
