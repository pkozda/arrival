'use client';

import { WireframeSkeleton } from '@/lib/presentation/le-ux';

type Props = {
  compact?: boolean;
};

/** P0 loading skeleton for surface-bound retry cycles (UX-RETRY-*). */
export function SurfaceLoadingSkeleton({ compact = false }: Props) {
  if (compact) {
    return (
      <div className="surface-loading-skeleton surface-loading-skeleton--compact" aria-busy="true">
        <div className="le-skeleton__bar" style={{ width: '60%', height: '1rem' }} />
        <div className="le-skeleton__bar" style={{ width: '90%', height: '0.875rem', marginTop: '0.5rem' }} />
        <div className="le-skeleton__bar" style={{ width: '75%', height: '0.875rem', marginTop: '0.5rem' }} />
      </div>
    );
  }

  return <WireframeSkeleton />;
}
