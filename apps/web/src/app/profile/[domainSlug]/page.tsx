'use client';

import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { ProfileDomainDetail } from '@/components/profile/ProfileDomainDetail';
import { useApp } from '@/components/AppProvider';
import { isProfileMirrorDomainSlug } from '@/lib/profile-mirror-utils';

function LoadingState() {
  return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
    </div>
  );
}

export default function ProfileDomainPage() {
  const params = useParams<{ domainSlug: string }>();
  const domainSlug = params.domainSlug;
  const { uiSnapshotLoading } = useApp();

  const validSlug = isProfileMirrorDomainSlug(domainSlug) ? domainSlug : '';

  return (
    <>
      <Header />
      <main style={{ padding: '2rem 0 4rem' }}>
        <div className="container" style={{ maxWidth: '720px' }}>
          {uiSnapshotLoading && <LoadingState />}
          {!uiSnapshotLoading && <ProfileDomainDetail domainSlug={validSlug || domainSlug} />}
        </div>
      </main>
    </>
  );
}
