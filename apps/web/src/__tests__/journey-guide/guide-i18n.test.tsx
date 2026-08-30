import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTranslations } from '@arrival-atlas/core';
import type { SupportedLanguage } from '@/lib/product-contract';
import {
  JourneyGuideFloatingButton,
  JourneyGuideSpeech,
  JourneyGuideWelcome,
} from '@/lib/journey-guide/JourneyGuide';
import { JourneyGuideLayer } from '@/lib/journey-guide/JourneyGuideLayer';
import { JourneyGuideProvider, useJourneyGuideContext } from '@/lib/journey-guide/JourneyGuideProvider';
import {
  clearJourneyGuideState,
  readJourneyGuideState,
} from '@/lib/journey-guide/storage';
import { toMissionTitle } from '@/lib/journey-guide/mission-labels';

const tState = {
  language: 'en' as SupportedLanguage,
};

vi.mock('@/components/AppProvider', () => ({
  useApp: () => ({
    language: tState.language,
    t: (key: string) => getTranslations(tState.language)[key] ?? key,
  }),
}));

describe('Phase 2A Journey Guide localization', () => {
  let root: Root | null = null;
  const storage = new Map<string, string>();

  beforeEach(() => {
    tState.language = 'en';
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
    clearJourneyGuideState();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    document.body.innerHTML = '';
    clearJourneyGuideState();
    vi.unstubAllGlobals();
  });

  async function render(node: ReactNode) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(node);
      await Promise.resolve();
    });
    return container;
  }

  it.each([
    ['en', 'Welcome to Arrival Atlas.', 'Start Guided Journey', 'Explore On My Own'],
    ['de', 'Willkommen bei Arrival Atlas.', 'Geführte Reise starten', 'Selbst erkunden'],
    ['ru', 'Добро пожаловать в Arrival Atlas.', 'Начать сопровождаемый путь', 'Исследовать самостоятельно'],
    ['ua', 'Ласкаво просимо до Arrival Atlas.', 'Почати супроводжуваний шлях', 'Досліджувати самостійно'],
  ] as const)('renders welcome / mode selection in %s', async (language, title, guided, alone) => {
    tState.language = language;
    const container = await render(
      <JourneyGuideWelcome onStartGuided={vi.fn()} onExploreAlone={vi.fn()} />
    );
    expect(container.textContent).toContain(title);
    expect(container.textContent).toContain(guided);
    expect(container.textContent).toContain(alone);
  });

  it.each([
    ['en', 'Journey Guide'],
    ['de', 'Reisebegleiter'],
    ['ru', 'Путеводитель'],
    ['ua', 'Провідник'],
  ] as const)('localizes FAB accessibility label in %s', async (language, label) => {
    tState.language = language;
    const container = await render(<JourneyGuideFloatingButton onClick={vi.fn()} />);
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe(label);
    expect(button?.getAttribute('title')).toBe(label);
  });

  it.each([
    ['en', 'Dismiss guide'],
    ['de', 'Begleiter schließen'],
    ['ru', 'Закрыть путеводитель'],
    ['ua', 'Закрити провідник'],
  ] as const)('localizes dismiss aria-label in %s', async (language, label) => {
    tState.language = language;
    const container = await render(
      <JourneyGuideSpeech title="Title" onClose={vi.fn()}>
        Body
      </JourneyGuideSpeech>
    );
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe(label);
  });

  it.each(LOCALES_MISSION)(
    'localizes known mission labels in %s',
    (language, expected) => {
      tState.language = language;
      const translate = (key: string) => getTranslations(language)[key] ?? key;
      expect(toMissionTitle('move-to-germany', 'Move to Germany', translate)).toBe(expected);
    }
  );

  it('updates Guide chrome when language changes at runtime', async () => {
    const container = await render(
      <JourneyGuideWelcome onStartGuided={vi.fn()} onExploreAlone={vi.fn()} />
    );
    expect(container.textContent).toContain('Welcome to Arrival Atlas.');

    tState.language = 'de';
    await act(async () => {
      root!.render(<JourneyGuideWelcome onStartGuided={vi.fn()} onExploreAlone={vi.fn()} />);
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Willkommen bei Arrival Atlas.');
    expect(container.textContent).toContain('Geführte Reise starten');

    tState.language = 'ua';
    await act(async () => {
      root!.render(<JourneyGuideWelcome onStartGuided={vi.fn()} onExploreAlone={vi.fn()} />);
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Ласкаво просимо до Arrival Atlas.');
  });

  it('localizes recommended panel chrome without changing storage/dismissal behavior', async () => {
    tState.language = 'de';
    let guideApi: ReturnType<typeof useJourneyGuideContext> | null = null;

    function Harness() {
      guideApi = useJourneyGuideContext();
      return <JourneyGuideLayer />;
    }

    const container = await render(
      <JourneyGuideProvider surfaceId="life-event-galaxy">
        <Harness />
      </JourneyGuideProvider>
    );

    expect(container.textContent).toContain('Willkommen bei Arrival Atlas.');

    await act(async () => {
      guideApi!.startGuidedJourney();
      guideApi!.setGraphSnapshot({
        surfaceId: 'life-event-galaxy',
        graphNodes: [
          { id: '__journey__', status: 'core', x: 50, y: 50, payload: null },
          { id: 'where-you-live', status: 'recommended', x: 30, y: 40, payload: null },
        ],
        graphEdges: [],
        lockedNodeIds: new Set(),
        selectedNodeId: 'where-you-live',
        nodeTitles: { 'where-you-live': 'Where you live' },
      });
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Empfohlener nächster Schritt');
    expect(container.textContent).toContain('Ihren Wohnort festlegen');
    expect(container.textContent).toContain('Route ansehen');

    const beforeDismiss = readJourneyGuideState();
    expect(beforeDismiss.hasChosenMode).toBe(true);
    expect(beforeDismiss.mode).toBe('guided');
    expect(beforeDismiss.dismissedWelcomeSurfaces).toContain('life-event-galaxy');

    await act(async () => {
      guideApi!.closePanel();
      await Promise.resolve();
    });

    const afterDismiss = readJourneyGuideState();
    expect(afterDismiss.hasChosenMode).toBe(true);
    expect(afterDismiss.mode).toBe('guided');
    expect(afterDismiss.dismissedWelcomeSurfaces).toContain('life-event-galaxy');
  });
});

const LOCALES_MISSION = [
  ['en', 'Establish Your Arrival Base'],
  ['de', 'Ihre Ankunftsbasis aufbauen'],
  ['ru', 'Создать базу прибытия'],
  ['ua', 'Створити базу прибуття'],
] as const;
