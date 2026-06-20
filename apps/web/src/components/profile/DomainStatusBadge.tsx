'use client';

import type { DomainStatus } from '@/lib/situation-utils';
import { formatDomainStatus } from '@/lib/profile-mirror-utils';

const STATUS_STYLE: Record<DomainStatus, { background: string; color: string }> = {
  complete: {
    background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
    color: 'var(--color-accent)',
  },
  needs_attention: {
    background: 'color-mix(in srgb, var(--color-warning, #d97706) 15%, transparent)',
    color: 'var(--color-warning, #d97706)',
  },
  not_added: {
    background: 'var(--color-surface-muted, var(--color-border))',
    color: 'var(--color-text-muted)',
  },
};

type Props = {
  status: DomainStatus;
};

export function DomainStatusBadge({ status }: Props) {
  const style = STATUS_STYLE[status];

  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '0.75rem',
        fontWeight: 600,
        padding: '0.2rem 0.5rem',
        borderRadius: '999px',
        background: style.background,
        color: style.color,
      }}
    >
      {formatDomainStatus(status)}
    </span>
  );
}
