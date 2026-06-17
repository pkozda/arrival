import type { UxActionCard } from '@/lib/api';

export function isUxActionCard(value: unknown): value is UxActionCard {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as UxActionCard).source === 'string'
    && typeof (value as UxActionCard).title === 'string'
  );
}

export function parseUxActionCards(items: unknown[]): UxActionCard[] {
  return items.filter(isUxActionCard);
}
