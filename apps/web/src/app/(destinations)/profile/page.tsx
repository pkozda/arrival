'use client';

import { ProfileMirrorOverview } from '@/components/profile/ProfileMirrorOverview';
import { useApp } from '@/components/AppProvider';

function LoadingState() {
  return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--color-danger)', marginBottom: '0.5rem' }}>
        Unable to load your situation
      </p>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{message}</p>
    </div>
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
