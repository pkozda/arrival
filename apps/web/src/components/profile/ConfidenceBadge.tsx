'use client';

import type { DomainInsight } from '@/lib/product-contract';

export function confidenceLabel(level: DomainInsight['confidence']['level']): string {
  switch (level) {
    case 'high':
      return 'High confidence';
    case 'medium':
      return 'Medium confidence';
    case 'low':
      return 'Low confidence';
    case 'none':
      return 'Not saved yet';
    default:
      return level;
  }
}

type Props = {
  level: DomainInsight['confidence']['level'];
  compact?: boolean;
};

export function ConfidenceBadge({ level, compact = false }: Props) {
  if (level === 'none') {
    return null;
  }

  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: compact ? '0.75rem' : '0.8125rem',
        fontWeight: 600,
        padding: compact ? '0.125rem 0.375rem' : '0.25rem 0.5rem',
        borderRadius: '999px',
        background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
        color: 'var(--color-accent)',
        whiteSpace: 'nowrap',
      }}
    >
      {confidenceLabel(level)}
    </span>
  );
}
