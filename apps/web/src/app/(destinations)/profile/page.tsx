'use client';

import { ProfileGalaxyBridge } from '@/components/profile/ProfileGalaxyBridge';
import { LegacyPanelSurface } from '@/components/atlas-runtime/legacy';
import { GalaxyViewport } from '@/lib/presentation/spatial-core';
import { useApp } from '@/components/AppProvider';

function LoadingOverlay() {
  return (
    <div className="le-galaxy-viewport__overlay le-galaxy-viewport__overlay--message">
      Loading...
    </div>
  );
}

function ErrorOverlay({ message }: { message: string }) {
  return (
    <div className="le-galaxy-viewport__overlay">
      <LegacyPanelSurface className="text-center">
        <p className="text-body text-danger mb-sm">Unable to load your situation</p>
        <p className="text-meta">{message}</p>
      </LegacyPanelSurface>
    </div>
  );
}

export default function ProfilePage() {
  const { uiSnapshot, uiSnapshotLoading, uiSnapshotError } = useApp();

  return (
    <GalaxyViewport label="Profile" surfaceId="profile-galaxy">
      {uiSnapshotLoading && <LoadingOverlay />}
      {!uiSnapshotLoading && uiSnapshotError && !uiSnapshot && (
        <ErrorOverlay message={uiSnapshotError} />
      )}
      {uiSnapshot && <ProfileGalaxyBridge inspectorDepth="summary" />}
    </GalaxyViewport>
  );
}
