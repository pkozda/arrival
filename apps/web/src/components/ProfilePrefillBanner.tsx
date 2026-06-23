'use client';

import { AtlasSurface } from '@/components/atlas-runtime/legacy';

type Props = {
  visible: boolean;
  message?: string;
};

export function ProfilePrefillBanner({ visible, message = 'Using information from your situation' }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <AtlasSurface
      style={{
        marginBottom: '1rem',
        padding: '0.875rem 1rem',
        borderColor: 'var(--color-accent)',
      }}
    >
      <p className="text-meta">{message}</p>
    </AtlasSurface>
  );
}
