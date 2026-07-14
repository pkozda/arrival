import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ATLAS_DEMO_STORAGE_KEY } from '@/components/atlas-home/atlas-demo-state';
import { AtlasHomeProvider, useAtlasHomeDemo } from '@/components/atlas-home/AtlasHomeProvider';
import { ArrivalWelcomeGate } from '@/components/arrival/ArrivalWelcomeGate';
import {
  ARRIVAL_WELCOME_STORAGE_KEY,
  persistArrivalWelcomeCompleted,
} from '@/lib/arrival-welcome';
import { DISPLAY_LANGUAGE_STORAGE_KEY } from '@/lib/i18n/display-language';

vi.mock('@/components/AppProvider', () => ({
  useApp: () => ({
    changeLanguage: vi.fn(async () => undefined),
  }),
}));

function stubMatchMedia() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function DemoProbe() {
  const { isExploringAtlas } = useAtlasHomeDemo();
  return <div data-testid="guest-child" data-exploring={isExploringAtlas ? '1' : '0'} />;
}

describe('ArrivalWelcomeGate', () => {
  let root: Root | null = null;
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    stubMatchMedia();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal('window', {
      localStorage: globalThis.localStorage,
      sessionStorage: globalThis.sessionStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matchMedia: globalThis.matchMedia,
    });
    vi.stubGlobal('navigator', { language: 'uk-UA' });
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

  it('renders welcome above a softened guest environment', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <ArrivalWelcomeGate>
          <div data-testid="guest-child">Guest landing</div>
        </ArrivalWelcomeGate>
      );
      await Promise.resolve();
    });

    expect(container.querySelector('[data-arrival-welcome-active]')).not.toBeNull();
    expect(container.querySelector('[data-ui-surface="arrival-welcome"]')).not.toBeNull();
    expect(container.querySelector('.arrival-welcome-gate__environment')).not.toBeNull();
    expect(container.querySelector('[data-testid="guest-child"]')).not.toBeNull();
    expect(container.querySelector('.arrival-welcome-gate__environment')?.getAttribute('aria-hidden')).toBe(
      'true'
    );
  });

  it('skips welcome for returning visitors', async () => {
    persistArrivalWelcomeCompleted('en');

    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <ArrivalWelcomeGate>
          <div data-testid="guest-child">Guest landing</div>
        </ArrivalWelcomeGate>
      );
      await Promise.resolve();
    });

    expect(container.querySelector('[data-ui-surface="arrival-welcome"]')).toBeNull();
    expect(container.querySelector('[data-testid="guest-child"]')).not.toBeNull();
    expect(container.querySelector('[data-arrival-welcome-active]')).toBeNull();
  });

  it('does not clear arrival welcome state when demo flag changes', async () => {
    storage.set(ATLAS_DEMO_STORAGE_KEY, '1');

    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <AtlasHomeProvider>
          <ArrivalWelcomeGate>
            <DemoProbe />
          </ArrivalWelcomeGate>
        </AtlasHomeProvider>
      );
      await Promise.resolve();
    });

    const uaButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.arrival-welcome__lang-btn')
    ).find((button) => button.textContent?.includes('Українська'));

    await act(async () => {
      uaButton?.click();
    });

    const continueButton = container.querySelector('.arrival-welcome__cta') as HTMLButtonElement;
    await act(async () => {
      continueButton?.click();
    });

    expect(storage.has(ARRIVAL_WELCOME_STORAGE_KEY)).toBe(true);
    expect(storage.get(DISPLAY_LANGUAGE_STORAGE_KEY)).toBeTruthy();
    expect(storage.get(ATLAS_DEMO_STORAGE_KEY)).toBe('1');
  });
});
