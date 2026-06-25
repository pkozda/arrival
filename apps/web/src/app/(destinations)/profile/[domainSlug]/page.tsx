'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ProfileGalaxyBridge } from '@/components/profile/ProfileGalaxyBridge';
import { LegacyPanelSurface } from '@/components/atlas-runtime/legacy';
import { GalaxyViewport } from '@/lib/presentation/spatial-core';
import { useApp } from '@/components/AppProvider';
import { isProfileMirrorDomainSlug } from '@/lib/profile-mirror-utils';

function LoadingOverlay() {
  return (
    <div className="le-galaxy-viewport__overlay le-galaxy-viewport__overlay--message">
      Loading...
    </div>
  );
}

function ProfileDomainGalaxyContent() {
  const params = useParams<{ domainSlug: string }>();
  const searchParams = useSearchParams();
  const domainSlug = params.domainSlug;
  const { uiSnapshot, uiSnapshotLoading } = useApp();
  const showUpdatedToast = searchParams.get('updated') === '1';

  const validSlug = isProfileMirrorDomainSlug(domainSlug) ? domainSlug : null;

  if (uiSnapshotLoading) {
    return <LoadingOverlay />;
  }

  if (!uiSnapshot || !validSlug) {
    return (
      <div className="le-galaxy-viewport__overlay">
        <LegacyPanelSurface>
          <p className="text-body text-body--muted">This section could not be found.</p>
        </LegacyPanelSurface>
      </div>
    );
  }

  return (
    <ProfileGalaxyBridge
      initialSelectedSlug={validSlug}
      inspectorDepth="detail"
      showUpdatedToast={showUpdatedToast}
    />
  );
}

export default function ProfileDomainPage() {
  return (
    <GalaxyViewport label="Profile" surfaceId="profile-galaxy">
      <Suspense fallback={<LoadingOverlay />}>
        <ProfileDomainGalaxyContent />
      </Suspense>
    </GalaxyViewport>
  );
}
