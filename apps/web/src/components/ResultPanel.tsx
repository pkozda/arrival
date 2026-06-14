'use client';

interface ResultPanelProps {
  loading: boolean;
  error?: string;
  children: React.ReactNode;
}

export function ResultPanel({ loading, error, children }: ResultPanelProps) {
  if (loading) {
    return (
      <div className="card animate-in" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Analyzing...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card animate-in" style={{ borderColor: 'var(--color-danger)' }}>
        <p style={{ color: 'var(--color-danger)' }}>{error}</p>
      </div>
    );
  }

  return <div className="animate-in">{children}</div>;
}
