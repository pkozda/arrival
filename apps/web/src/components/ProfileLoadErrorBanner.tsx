'use client';

import { SurfaceErrorPanel } from '@/components/surface/SurfaceErrorPanel';
import { SurfaceLoadingSkeleton } from '@/components/surface/SurfaceLoadingSkeleton';
import { useSurfaceRetry } from '@/components/surface/useSurfaceRetry';
import { useApp } from '@/components/AppProvider';

/** REL-05 — profile load failure visible in app shell. */
export function ProfileLoadErrorBanner() {
  const { userContextError, userContextLoading, refreshUserContext, t } = useApp();
  const { retrying, onRetry } = useSurfaceRetry(refreshUserContext);

  if (!userContextError || userContextLoading) {
    return null;
  }

  return (
    <div
      className="profile-load-error-banner"
      data-ui-surface="profile-load-error"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        padding: '0.75rem 1rem',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-danger)',
      }}
    >
      <div className="container">
        {retrying ? (
          <SurfaceLoadingSkeleton compact />
        ) : (
          <SurfaceErrorPanel
            compact
            title={t('app.profileLoad.errorTitle')}
            message={userContextError}
            onRetry={onRetry}
            retrying={retrying}
            retryLabel={t('common.retry')}
          />
        )}
      </div>
    </div>
  );
}
