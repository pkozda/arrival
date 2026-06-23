'use client';

import { AtlasSurface } from '@/components/atlas-runtime/legacy';

interface ResultPanelProps {
  loading: boolean;
  error?: string;
  children: React.ReactNode;
}

export function ResultPanel({ loading, error, children }: ResultPanelProps) {
  if (loading) {
    return (
      <AtlasSurface className="animate-in text-center" style={{ padding: '3rem' }}>
        <p className="text-body text-body--muted">Analyzing...</p>
      </AtlasSurface>
    );
  }

  if (error) {
    return (
      <AtlasSurface className="animate-in text-danger" style={{ borderColor: 'var(--color-danger)' }}>
        <p className="text-danger">{error}</p>
      </AtlasSurface>
    );
  }

  return <div className="animate-in">{children}</div>;
}
