import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTranslations } from '@arrival-atlas/core';
import { JourneyGuideProvider } from '@/lib/journey-guide/JourneyGuideProvider';
import { useJourneyGuideContext } from '@/lib/journey-guide/JourneyGuideProvider';
import type { JourneyGuideCertaintySource } from '@/lib/journey-guide/types';

vi.mock('@/components/AppProvider', () => ({
  useApp: () => ({
    language: 'en',
    t: (key: string) => getTranslations('en')[key] ?? key,
  }),
}));

function Probe() {
  const guide = useJourneyGuideContext();
  return (
    <div
      data-testid="probe"
      data-uses-certainty={String(guide.usesCertaintySource)}
      data-reason={guide.recommendation?.reason ?? ''}
      data-mission={guide.recommendation?.missionTitle ?? ''}
    />
  );
}

describe('JourneyGuideProvider certainty integration', () => {
  let root: Root | null = null;
  const originalEnv = process.env.NEXT_PUBLIC_GUIDE_USE_CERTAINTY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_GUIDE_USE_CERTAINTY = 'false';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_GUIDE_USE_CERTAINTY = originalEnv;
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  async function renderProvider(
    certaintySource: JourneyGuideCertaintySource | null,
    setGuide?: (guide: ReturnType<typeof useJourneyGuideContext>) => void
  ) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    function Harness() {
      const guide = useJourneyGuideContext();
      setGuide?.(guide);

      return <Probe />;
    }

    await act(async () => {
      root!.render(
        <JourneyGuideProvider surfaceId="life-event-galaxy">
          <Harness />
        </JourneyGuideProvider>
      );
      await Promise.resolve();
    });

    const guideRef: { current: ReturnType<typeof useJourneyGuideContext> | null } = {
      current: null,
    };

    await act(async () => {
      root!.render(
        <JourneyGuideProvider surfaceId="life-event-galaxy">
          <Harness />
        </JourneyGuideProvider>
      );
      await Promise.resolve();
    });

    if (setGuide) {
      await act(async () => {
        setGuide(guideRef.current!);
      });
    }

    return container;
  }

  it('uses legacy recommendation when feature flag is off', async () => {
    let guideApi: ReturnType<typeof useJourneyGuideContext> | null = null;

    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    function Harness() {
      guideApi = useJourneyGuideContext();
      return <Probe />;
    }

    await act(async () => {
      root!.render(
        <JourneyGuideProvider surfaceId="life-event-galaxy">
          <Harness />
        </JourneyGuideProvider>
      );
      await Promise.resolve();
    });

    await act(async () => {
      guideApi!.setGraphSnapshot({
        surfaceId: 'life-event-galaxy',
        graphNodes: [
          {
            id: 'registration',
            status: 'recommended',
            x: 30,
            y: 40,
            payload: null,
          },
        ],
        graphEdges: [],
        lockedNodeIds: new Set(),
        selectedNodeId: 'registration',
        nodeTitles: { registration: 'Register your address' },
      });

      guideApi!.setCertaintySource({
        state: {
          location: 'Life Events',
          title: 'Registration',
          nextAction: {
            label: 'Register your address',
            reason: { type: 'description', description: 'from certainty' },
          },
        },
        recommendedNodeId: 'registration',
        unlockPreview: [],
      });
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="probe"]')?.getAttribute('data-uses-certainty')).toBe(
      'false'
    );
  });

  it('consumes certainty when feature flag is on and resolves localized speech', async () => {
    process.env.NEXT_PUBLIC_GUIDE_USE_CERTAINTY = 'true';

    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    let guideApi: ReturnType<typeof useJourneyGuideContext> | null = null;

    function Harness() {
      guideApi = useJourneyGuideContext();
      return <Probe />;
    }

    await act(async () => {
      root!.render(
        <JourneyGuideProvider surfaceId="life-event-galaxy">
          <Harness />
        </JourneyGuideProvider>
      );
      await Promise.resolve();
    });

    await act(async () => {
      guideApi!.setGraphSnapshot({
        surfaceId: 'life-event-galaxy',
        graphNodes: [
          {
            id: 'registration',
            status: 'recommended',
            x: 30,
            y: 40,
            payload: null,
          },
        ],
        graphEdges: [],
        lockedNodeIds: new Set(),
        selectedNodeId: 'registration',
        nodeTitles: { registration: 'Register your address' },
      });

      guideApi!.setCertaintySource({
        state: {
          location: 'Life Events',
          title: 'Registration',
          nextAction: {
            label: 'Register your address',
            reason: { type: 'description', description: 'from certainty adapter' },
          },
        },
        recommendedNodeId: 'registration',
        unlockPreview: [],
      });
      await Promise.resolve();
    });

    const probe = container.querySelector('[data-testid="probe"]');
    expect(probe?.getAttribute('data-uses-certainty')).toBe('true');
    expect(probe?.getAttribute('data-reason')).toBe(
      'Do this now because from certainty adapter.'
    );
  });
});
