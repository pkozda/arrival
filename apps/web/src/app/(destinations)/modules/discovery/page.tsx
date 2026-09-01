'use client';

import { useApp } from '@/components/AppProvider';
import { GalaxyViewport } from '@/lib/presentation/spatial-core';
import { DiscoveryPage } from '@/modules/discovery/ui/DiscoveryPage';
import '@/modules/discovery/ui/discovery-module.css';

export default function DiscoveryModulePage() {
  const { sessionId, t } = useApp();

  return (
    <GalaxyViewport label={t('discovery.module.title')} surfaceId="discovery-galaxy">
      <DiscoveryPage sessionId={sessionId ?? undefined} />
    </GalaxyViewport>
  );
}
