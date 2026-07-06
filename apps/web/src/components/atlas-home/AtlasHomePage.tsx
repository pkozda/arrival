'use client';

import { AtlasGuestLanding } from './AtlasGuestLanding';
import { AtlasHomeProvider, useAtlasHomeDemo } from './AtlasHomeProvider';
import { AtlasMemberSlider } from './AtlasSlider';

function AtlasHomeGate() {
  const { isExploringAtlas } = useAtlasHomeDemo();
  return isExploringAtlas ? <AtlasMemberSlider /> : <AtlasGuestLanding />;
}

export function AtlasHomePage() {
  return (
    <AtlasHomeProvider>
      <AtlasHomeGate />
    </AtlasHomeProvider>
  );
}
