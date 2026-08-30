import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTranslations } from '@arrival-atlas/core';
import type { SupportedLanguage } from '@/lib/product-contract';
import { AtlasGuestLanding } from '@/components/atlas-home/AtlasGuestLanding';
import { AtlasHUD } from '@/components/atlas-home/AtlasHUD';
import { LeaveDemoConfirm } from '@/components/atlas-home/LeaveDemoConfirm';
import { OnboardingChecklistCard } from '@/components/home/OnboardingChecklistCard';

const tState = {
  language: 'en' as SupportedLanguage,
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('@/components/AppProvider', () => ({
  useApp: () => ({
    language: tState.language,
    leaveDemoAndReset: vi.fn(async () => undefined),
    t: (key: string) => getTranslations(tState.language)[key] ?? key,
  }),
}));

vi.mock('@/components/atlas-home/AtlasHomeProvider', () => ({
  useAtlasHomeDemo: () => ({
    isExploringAtlas: false,
    enterAtlas: vi.fn(),
  }),
}));

vi.mock('@/components/atlas-runtime', () => ({
  AtlasLink: ({
    children,
    href,
    className,
    ...props
  }: {
    children?: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/atlas-home/AtlasLogo', () => ({
  AtlasLogo: () => <span>Atlas</span>,
}));

vi.mock('@/components/atlas-home/AtlasAmbientLayers', () => ({
  AtlasAmbientLayers: () => null,
}));

vi.mock('@/components/atlas-home/AtlasMap', () => ({
  AtlasMap: () => null,
}));

vi.mock('@/components/atlas-home/useAtlasLoadSequence', () => ({
  useAtlasLoadSequence: () => 5,
}));

vi.mock('@/components/atlas-home/useAtlasParallax', () => ({
  useAtlasParallax: () => ({ parallaxRef: { current: null } }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
}));

describe('Phase 1 shell home localization', () => {
  let root: Root | null = null;

  beforeEach(() => {
    tState.language = 'en';
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
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

  async function render(node: React.ReactNode) {
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
    ['en', 'Enter Atlas', 'Your new life.'],
    ['de', 'Atlas betreten', 'Ihr neues Leben.'],
    ['ru', 'Войти в Atlas', 'Ваша новая жизнь.'],
    ['ua', 'Увійти в Atlas', 'Ваше нове життя.'],
  ] as const)('renders Guest Home in %s', async (language, enterLabel, headline) => {
    tState.language = language;
    const container = await render(<AtlasGuestLanding />);
    expect(container.textContent).toContain(enterLabel);
    expect(container.textContent).toContain(headline);
  });

  it('updates Guest Home copy when language changes while mounted', async () => {
    const container = await render(<AtlasGuestLanding />);
    expect(container.textContent).toContain('Enter Atlas');

    tState.language = 'ua';
    await act(async () => {
      root!.render(<AtlasGuestLanding />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Увійти в Atlas');
    expect(container.textContent).not.toContain('Enter Atlas');
  });

  it('localizes HUD guest CTA and aria-label', async () => {
    tState.language = 'de';
    const container = await render(<AtlasHUD />);
    const cta = container.querySelector('.atlas-hud__cta') as HTMLButtonElement;
    expect(cta.textContent).toContain('Atlas betreten');
    expect(cta.getAttribute('aria-label')).toBe('Atlas-Demo betreten');
  });

  it('localizes Leave Demo dialog including a11y close label', async () => {
    tState.language = 'ru';
    const container = await render(
      <LeaveDemoConfirm open leaving={false} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(container.textContent).toContain('Выйти из демо и начать заново?');
    expect(container.textContent).toContain('Начать заново');
    expect(container.textContent).toContain('Продолжить знакомство');
    expect(container.querySelector('.leave-demo-confirm__backdrop')?.getAttribute('aria-label')).toBe(
      'Закрыть'
    );
  });

  it('localizes onboarding checklist chrome', async () => {
    tState.language = 'ua';
    const container = await render(
      <OnboardingChecklistCard
        steps={[
          { id: 'language', label: 'Step A', complete: true },
          { id: 'location', label: 'Step B', complete: false },
        ]}
        onDismiss={vi.fn()}
      />
    );
    expect(container.textContent).toContain('Орієнтація в Німеччині');
    expect(container.textContent).toContain('1 з 2 кроків виконано');
    expect(container.textContent).toContain('Сховати');
    expect(container.textContent).toContain('Оберіть мову');
    expect(container.querySelector('section')?.getAttribute('aria-label')).toBe('Орієнтація в Німеччині');
  });
});
