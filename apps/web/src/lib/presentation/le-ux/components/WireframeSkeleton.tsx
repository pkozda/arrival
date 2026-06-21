'use client';

import { useApp } from '@/components/AppProvider';

function SkeletonBar({ width, height = '1rem' }: { width: string; height?: string }) {
  return <div className="le-skeleton__bar" style={{ width, height }} />;
}

export function WireframeSkeleton() {
  const { t } = useApp();

  return (
    <div className="le-skeleton" aria-busy="true" aria-label={t('life-event.empty.loadingPlan')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <SkeletonBar width="40%" />
        <SkeletonBar width="25%" />
      </div>
      <div
        style={{
          border: '2px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          padding: '1.25rem',
        }}
      >
        <SkeletonBar width="20%" height="0.875rem" />
        <div style={{ marginTop: '0.75rem' }}>
          <SkeletonBar width="70%" height="1.5rem" />
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <SkeletonBar width="90%" />
          <div style={{ marginTop: '0.5rem' }}>
            <SkeletonBar width="80%" />
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <SkeletonBar width="8rem" height="2.5rem" />
        </div>
      </div>
      <div className="le-breakdown">
        {[0, 1, 2].map((column) => (
          <div key={column}>
            <SkeletonBar width="50%" height="0.875rem" />
            <div style={{ marginTop: '0.75rem' }}>
              <SkeletonBar width="100%" height="4rem" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
