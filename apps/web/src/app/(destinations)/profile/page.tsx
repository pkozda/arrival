'use client';

import { ProfileMirrorOverview } from '@/components/profile/ProfileMirrorOverview';
import { LegacyPanelSurface } from '@/components/atlas-runtime/legacy';
import { useApp } from '@/components/AppProvider';

function LoadingState() {
  return (
    <LegacyPanelSurface style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
    </LegacyPanelSurface>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <LegacyPanelSurface style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--color-danger)', marginBottom: '0.5rem' }}>
        Unable to load your situation
      </p>
      <p className="text-meta">{message}</p>
    </LegacyPanelSurface>
  );
}

export default function ProfilePage() {
  const { uiSnapshot, uiSnapshotLoading, uiSnapshotError } = useApp();

  return (
    <main className="celestial-page-main">
      <div className="container" style={{ maxWidth: '720px' }}>
        {uiSnapshotLoading && <LoadingState />}
        {!uiSnapshotLoading && uiSnapshotError && !uiSnapshot && (
          <ErrorState message={uiSnapshotError} />
        )}
        {uiSnapshot && <ProfileMirrorOverview />}
      </div>
    </main>
  );
}
