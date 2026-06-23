'use client';

import { AtlasSurface } from '@/components/atlas-runtime/legacy';

type Props = {
  title?: string;
  subtitle?: string;
  onDismiss?: () => void;
};

export function ProfileCorrectionToast({
  title = 'Your situation was updated',
  subtitle = 'Updated from Profile correction',
  onDismiss,
}: Props) {
  return (
    <AtlasSurface
      role="status"
      className="mb-md"
      style={{
        borderColor: 'var(--color-accent)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <p className="text-section-title--sm">{title}</p>
          {subtitle && <p className="text-meta" style={{ marginTop: '0.25rem' }}>{subtitle}</p>}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '1.125rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>
    </AtlasSurface>
  );
}
