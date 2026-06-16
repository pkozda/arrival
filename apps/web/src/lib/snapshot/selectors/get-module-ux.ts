import type { UiSnapshot, UxActionCard, UxPayload } from '@/lib/api';

function isUxActionCard(value: unknown): value is UxActionCard {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as UxActionCard).source === 'string'
    && typeof (value as UxActionCard).title === 'string'
  );
}

export function getModuleUx(snapshot: UiSnapshot | null, moduleId: string): UxPayload | null {
  if (!snapshot) {
    return null;
  }

  const actions = snapshot.uxSnapshot.actionCards.filter(
    (card): card is UxActionCard => isUxActionCard(card) && card.source === moduleId
  );

  if (actions.length === 0) {
    return null;
  }

  return {
    actions,
    summary: actions.map((action) => action.title).join(' · '),
  };
}
