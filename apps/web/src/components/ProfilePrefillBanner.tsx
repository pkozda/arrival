'use client';

type Props = {
  visible: boolean;
};

export function ProfilePrefillBanner({ visible }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className="card"
      style={{
        marginBottom: '1rem',
        padding: '0.875rem 1rem',
        background: 'var(--color-hero-gradient, var(--color-surface))',
        borderColor: 'var(--color-accent)',
      }}
    >
      <p style={{ fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>
        Using information from your situation
      </p>
    </div>
  );
}
