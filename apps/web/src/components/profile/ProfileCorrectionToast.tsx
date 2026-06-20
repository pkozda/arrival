'use client';

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
    <div
      className="card"
      role="status"
      style={{
        marginBottom: '1rem',
        borderColor: 'var(--color-accent)',
        background: 'color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <p style={{ fontWeight: 600, margin: 0 }}>{title}</p>
          {subtitle && (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0' }}>
              {subtitle}
            </p>
          )}
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
    </div>
  );
}
