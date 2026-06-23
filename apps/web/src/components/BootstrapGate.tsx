'use client';

import type { ReactNode } from 'react';
import { getTranslations } from '@arrival-atlas/core';
import { SurfaceErrorPanel } from '@/components/surface/SurfaceErrorPanel';
import { SurfaceLoadingSkeleton } from '@/components/surface/SurfaceLoadingSkeleton';
import { readStoredDisplayLanguage } from '@/lib/i18n/display-language';

type Props = {
  children: ReactNode;
  bootstrapLoading: boolean;
  bootstrapError: string | null;
  retryBootstrap: () => Promise<void>;
};

/** REL-02, UX-RETRY-BOOT — session bootstrap error + retry gate. */
export function BootstrapGate({
  children,
  bootstrapLoading,
  bootstrapError,
  retryBootstrap,
}: Props) {
  const lang = readStoredDisplayLanguage() ?? 'en';
  const t = getTranslations(lang);

  if (bootstrapLoading) {
    return (
      <div className="container" style={{ padding: '4rem 1rem' }} data-ui-surface="bootstrap-loading">
        <div className="card" style={{ padding: '2rem' }}>
          <SurfaceLoadingSkeleton compact />
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '1rem' }}>
            {t['common.loading']}
          </p>
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="container" style={{ padding: '4rem 1rem' }} data-ui-surface="bootstrap-error">
        <div className="card" style={{ padding: '2rem' }}>
          <SurfaceErrorPanel
            title={t['app.bootstrap.errorTitle']}
            message={bootstrapError}
            retryLabel={t['common.retry']}
            onRetry={() => void retryBootstrap()}
          />
        </div>
      </div>
    );
  }

  return children;
}
