'use client';

import type { ReactNode } from 'react';
import { AtlasSecondaryButton } from '@/components/atlas-runtime';

type Props = {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
  title?: string;
  retryLabel?: string;
  compact?: boolean;
  children?: ReactNode;
};

const DEFAULT_TITLE = 'Something went wrong';
const DEFAULT_RETRY_LABEL = 'Retry';

/** UX-ENG-01, UX-R1, UX-R2 — shared danger-styled error surface with Retry. */
export function SurfaceErrorPanel({
  message,
  onRetry,
  retrying = false,
  title = DEFAULT_TITLE,
  retryLabel = DEFAULT_RETRY_LABEL,
  compact = false,
  children,
}: Props) {
  return (
    <div
      className={`surface-error-panel${compact ? ' surface-error-panel--compact' : ''}`}
      role="alert"
      aria-live="assertive"
      data-ui-surface="error-panel"
    >
      <p className="surface-error-panel__title">{title}</p>
      <p className="surface-error-panel__message">{message}</p>
      {children}
      <AtlasSecondaryButton
        className="surface-error-panel__retry"
        onClick={() => void onRetry()}
        disabled={retrying}
        aria-busy={retrying}
      >
        {retryLabel}
      </AtlasSecondaryButton>
    </div>
  );
}
