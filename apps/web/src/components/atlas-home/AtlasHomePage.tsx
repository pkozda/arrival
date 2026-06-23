'use client';

import { AtlasGuestLanding } from './AtlasGuestLanding';
import { AtlasHomeProvider, useAtlasHomeAuth } from './AtlasHomeProvider';
import { AtlasMemberSlider } from './AtlasSlider';

function AtlasHomeGate() {
  const { isAuthenticated } = useAtlasHomeAuth();
  return isAuthenticated ? <AtlasMemberSlider /> : <AtlasGuestLanding />;
}

export function AtlasHomePage() {
  return (
    <AtlasHomeProvider>
      <AtlasHomeGate />
    </AtlasHomeProvider>
  );
}
