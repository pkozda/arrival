import type { UiSnapshot, UxActionCard } from '@/lib/api';
import { parseUxActionCards } from './ux-action-card';

export function getGlobalUxActions(snapshot: UiSnapshot | null): UxActionCard[] {
  if (!snapshot) {
    return [];
  }

  return parseUxActionCards(snapshot.uxSnapshot.actionCards);
}

export function getPrioritySignals(snapshot: UiSnapshot | null): unknown[] {
  if (!snapshot) {
    return [];
  }

  return snapshot.uxSnapshot.prioritySignals;
}

export function getAttentionLayer(snapshot: UiSnapshot | null): UxActionCard[] {
  if (!snapshot) {
    return [];
  }

  return parseUxActionCards(snapshot.uxSnapshot.attentionLayer);
}

export function hasGlobalUx(snapshot: UiSnapshot | null): boolean {
  return getGlobalUxActions(snapshot).length > 0;
}
