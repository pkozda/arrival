import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTranslations } from '@arrival-atlas/core';
import type { SupportedLanguage } from '@/lib/product-contract';
import { BecauseExplanation } from '@/components/certainty/BecauseExplanation';
import { CertaintyHeader } from '@/components/certainty/CertaintyHeader';
import { CertaintyPanel } from '@/components/certainty/CertaintyPanel';
import { NextStepCard } from '@/components/certainty/NextStepCard';
import { ProgressDelta } from '@/components/certainty/ProgressDelta';
import type { CertaintyState } from '@/lib/certainty/types';

const tState = {
  language: 'en' as SupportedLanguage,
};

vi.mock('@/components/AppProvider', () => ({
  useApp: () => ({
    language: tState.language,
    t: (key: string) => getTranslations(tState.language)[key] ?? key,
  }),
}));

const sampleState: CertaintyState = {
  location: 'Life Events',
  title: 'Register your address',
  confidence: 'needs_attention',
  nextAction: {
    label: 'Register your address',
    reason: {
      type: 'description',
      description: 'housing support depends on registration',
    },
    expectedOutcome: {
      type: 'openPath',
      target: 'housing support',
    },
  },
  progress: {
    completed: 2,
    total: 5,
  },
};

describe('Certainty UI primitives', () => {
  let root: Root | null = null;

  beforeEach(() => {
    tState.language = 'en';
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    document.body.innerHTML = '';
  });

  async function render(ui: ReactElement) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(ui);
      await Promise.resolve();
    });

    return container;
  }

  it('renders location and title in header', async () => {
    const container = await render(
      <CertaintyHeader location="Life Events" title="Register your address" confidence="clear" />
    );

    expect(container.textContent).toContain('Where you are');
    expect(container.textContent).toContain('Life Events');
    expect(container.textContent).toContain('Register your address');
    expect(container.textContent).toContain('On track');
  });

  it('renders next action and because explanation via formatters', async () => {
    const container = await render(
      <>
        <NextStepCard
          label={sampleState.nextAction!.label}
          expectedOutcome={sampleState.nextAction!.expectedOutcome}
        />
        <BecauseExplanation reason={sampleState.nextAction!.reason} />
      </>
    );

    expect(container.textContent).toContain('Recommended next step');
    expect(container.textContent).toContain('Register your address');
    expect(container.textContent).toContain('Why this step');
    expect(container.textContent).toContain('housing support depends on registration');
    expect(container.textContent).toContain('This opens the path to housing support.');
  });

  it('hides empty because section when formatted copy is empty', async () => {
    const container = await render(
      <BecauseExplanation reason={{ type: 'description', description: '   ' }} />
    );
    expect(container.querySelector('.certainty-because')).toBeNull();
  });

  it('renders full certainty panel and progress', async () => {
    const container = await render(<CertaintyPanel state={sampleState} surfaceId="test" />);

    expect(container.querySelector('[data-ui-surface="certainty-panel"]')).not.toBeNull();
    expect(container.textContent).toContain('Your progress');
    expect(container.textContent).toContain('2 of 5 steps are already in place.');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toBe(
      '2 of 5 steps completed'
    );
  });

  it.each([
    ['de', 'Wo Sie stehen', 'Warum dieser Schritt', 'Ihr Fortschritt'],
    ['ru', 'Где вы сейчас', 'Почему этот шаг', 'Ваш прогресс'],
    ['ua', 'Де ви зараз', 'Чому цей крок', 'Ваш прогрес'],
  ] as const)('localizes Certainty chrome in %s', async (language, eyebrow, because, progress) => {
    tState.language = language;
    const container = await render(<CertaintyPanel state={sampleState} surfaceId="test" />);
    expect(container.textContent).toContain(eyebrow);
    expect(container.textContent).toContain(because);
    expect(container.textContent).toContain(progress);
  });

  it('updates Certainty text when language changes at runtime', async () => {
    const container = await render(<CertaintyPanel state={sampleState} surfaceId="test" />);
    expect(container.textContent).toContain('Why this step');

    tState.language = 'ua';
    await act(async () => {
      root!.render(<CertaintyPanel state={sampleState} surfaceId="test" />);
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Чому цей крок');
    expect(container.textContent).toContain('Уже виконано 2 з 5 кроків.');
  });
});
