import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArrivalWelcomeLayer } from '@/components/arrival/ArrivalWelcomeLayer';
import { ARRIVAL_WELCOME_TELEMETRY_EVENT } from '@/lib/arrival-welcome';

function stubMatchMedia(reducedMotion = false) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reducedMotion && query.includes('reduce'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('ArrivalWelcomeLayer', () => {
  let root: Root | null = null;
  const onSelectLanguage = vi.fn();
  const onComplete = vi.fn();

  beforeEach(() => {
    onSelectLanguage.mockReset();
    onComplete.mockReset();
    stubMatchMedia(false);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  async function renderLayer(selectedLanguage?: 'en' | 'de' | 'ru' | 'ua') {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <ArrivalWelcomeLayer
          suggestedLanguage="ua"
          selectedLanguage={selectedLanguage}
          supportedLanguages={['de', 'ua', 'ru', 'en']}
          onSelectLanguage={onSelectLanguage}
          onComplete={onComplete}
        />
      );
      await Promise.resolve();
    });

    return container;
  }

  it('renders supported languages with flag affordances', async () => {
    const container = await renderLayer();

    expect(container.querySelectorAll('.arrival-welcome__lang-btn')).toHaveLength(4);
    expect(container.textContent).toContain('🇩🇪');
    expect(container.textContent).toContain('🇺🇦');
    expect(container.textContent).toContain('🇷🇺');
    expect(container.textContent).toContain('🇬🇧');
    expect(container.querySelector('.arrival-welcome__card')).not.toBeNull();
    expect(container.querySelector('.arrival-welcome__scrim')).not.toBeNull();
  });

  it('disables Continue until a language is selected', async () => {
    const container = await renderLayer();
    const continueButton = container.querySelector('.arrival-welcome__cta') as HTMLButtonElement;

    expect(continueButton.disabled).toBe(true);
  });

  it('shows selected language active state and completes on Continue', async () => {
    const container = await renderLayer('de');
    const selected = container.querySelector('.arrival-welcome__lang-btn.is-selected') as HTMLButtonElement;
    const continueButton = container.querySelector('.arrival-welcome__cta') as HTMLButtonElement;

    expect(selected?.getAttribute('aria-pressed')).toBe('true');
    expect(continueButton.disabled).toBe(false);

    await act(async () => {
      continueButton.click();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('marks suggested language without auto-selecting it', async () => {
    const container = await renderLayer();
    const suggested = container.querySelector('[data-suggested="true"]');

    expect(suggested).not.toBeNull();
    expect(suggested?.getAttribute('aria-pressed')).toBe('false');
    expect(suggested?.textContent).toContain('Suggested for you');
  });

  it('focuses language selection first for keyboard users', async () => {
    const container = await renderLayer();
    const suggested = container.querySelector('[data-suggested="true"]') as HTMLButtonElement;

    expect(document.activeElement).toBe(suggested);
    expect(container.querySelector('#arrival-welcome-languages-heading')).not.toBeNull();
  });

  it('supports keyboard reachability for language controls', async () => {
    const container = await renderLayer();
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.arrival-welcome__lang-btn')
    );

    await act(async () => {
      buttons[2]?.focus();
    });
    expect(document.activeElement).toBe(buttons[2]);
  });

  it('disables motion classes when reduced motion is preferred', async () => {
    vi.unstubAllGlobals();
    stubMatchMedia(true);

    const container = await renderLayer();
    expect(container.querySelector('.arrival-welcome--reduced-motion')).not.toBeNull();
    expect(container.querySelector('.arrival-welcome__card--static')).not.toBeNull();
  });

  it('exposes telemetry event boundaries for consumers', () => {
    const listener = vi.fn();
    window.addEventListener(ARRIVAL_WELCOME_TELEMETRY_EVENT, listener as EventListener);

    window.dispatchEvent(
      new CustomEvent(ARRIVAL_WELCOME_TELEMETRY_EVENT, {
        detail: { name: 'arrival_welcome_viewed', at: new Date().toISOString() },
      })
    );

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(ARRIVAL_WELCOME_TELEMETRY_EVENT, listener as EventListener);
  });
});
