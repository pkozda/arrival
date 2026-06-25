'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
import { ProfileDomainDetail } from '@/components/profile/ProfileDomainDetail';
import { useApp } from '@/components/AppProvider';
import { isProfileMirrorDomainSlug } from '@/lib/profile-mirror-utils';

function LoadingState() {
  return (
    <AtlasSurface className="text-center">
      <p className="text-body text-body--muted">Loading...</p>
    </AtlasSurface>
  );
}

function ProfileDomainDetailPageContent() {
  const params = useParams<{ domainSlug: string }>();
  const domainSlug = params.domainSlug;
  const { uiSnapshotLoading } = useApp();

  const validSlug = isProfileMirrorDomainSlug(domainSlug) ? domainSlug : '';

  return (
    <>
      {uiSnapshotLoading && <LoadingState />}
      {!uiSnapshotLoading && <ProfileDomainDetail domainSlug={validSlug || domainSlug} />}
    </>
  );
}

export default function ProfileDomainPage() {
  return (
    <main className="celestial-page-main">
      <div className="container" style={{ maxWidth: '720px' }}>
        <Suspense fallback={<LoadingState />}>
          <ProfileDomainDetailPageContent />
        </Suspense>
      </div>
    </main>
  );
}
