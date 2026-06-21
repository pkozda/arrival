import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { Header } from '@/components/Header';

const LANGUAGE_DRAWER_LABEL = 'Language';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('@/app-shell/navigation/EconomicRealityNavLink', () => ({
  EconomicRealityNavLink: () => null,
}));

vi.mock('@/lib/dev-tools/reset-user-data', () => ({
  isDevToolsUiEnabled: () => false,
}));

function createMockApp(language: 'en' | 'ru' = 'ru') {
  const translations: Record<string, string> = {
    'common.language': language === 'ru' ? 'Язык' : 'Language',
  };

  return {
    language,
    changeLanguage: vi.fn(),
    theme: 'light' as const,
    toggleTheme: vi.fn(),
    t: (key: string) => translations[key] ?? key,
    modules: [],
    resetUserData: vi.fn(),
    loadDemoPreset: vi.fn(),
  };
}

vi.mock('@/components/AppProvider', () => ({
  useApp: vi.fn(),
}));

import { useApp } from '@/components/AppProvider';

function renderHeaderFirstPaint(): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  const root = createRoot(container);
  flushSync(() => {
    root.render(<Header />);
  });
  return { container, root };
}

function extractLanguageDrawerLabel(text: string): string {
  if (text.includes('Язык')) {
    return 'Язык';
  }
  if (text.includes(LANGUAGE_DRAWER_LABEL)) {
    return LANGUAGE_DRAWER_LABEL;
  }
  return text;
}

describe('Hydration determinism invariants', () => {
  let root: Root | null = null;

  beforeEach(() => {
    vi.mocked(useApp).mockReturnValue(createMockApp('ru') as ReturnType<typeof useApp>);
  });

  afterEach(() => {
    root?.unmount();
    root = null;
    vi.mocked(useApp).mockReset();
  });

  it('SSR and client initial render produce identical language drawer label', () => {
    const ssrMarkup = renderToString(<Header />);
    const { container, root: mountedRoot } = renderHeaderFirstPaint();
    root = mountedRoot;

    expect(ssrMarkup).toContain(LANGUAGE_DRAWER_LABEL);
    expect(ssrMarkup).not.toContain('Язык');
    expect(container.textContent).toContain(LANGUAGE_DRAWER_LABEL);
    expect(container.textContent).not.toContain('Язык');
  });

  it('prevents locale drift when stored locale is ru but SSR bootstraps in en', async () => {
    const ssrMarkup = renderToString(<Header />);
    const { container, root: mountedRoot } = renderHeaderFirstPaint();
    root = mountedRoot;

    expect(extractLanguageDrawerLabel(ssrMarkup)).toBe(LANGUAGE_DRAWER_LABEL);
    expect(extractLanguageDrawerLabel(container.textContent ?? '')).toBe(LANGUAGE_DRAWER_LABEL);

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Язык');
  });

  it('does not access localStorage or navigator during Header render phase', () => {
    const headerSource = readFileSync(
      join(process.cwd(), 'src/components/Header.tsx'),
      'utf8'
    );
    const appProviderSource = readFileSync(
      join(process.cwd(), 'src/components/AppProvider.tsx'),
      'utf8'
    );

    expect(headerSource).not.toMatch(/localStorage/);
    expect(headerSource).not.toMatch(/navigator\.language/);
    expect(headerSource).not.toMatch(/Date\.now\(\)/);
    expect(headerSource).toContain('mounted ? t(');
    expect(headerSource).toContain('LANGUAGE_DRAWER_LABEL');

    expect(appProviderSource).toMatch(/readStoredDisplayLanguage\(\)/);
    expect(appProviderSource).toMatch(/useEffect\(\(\) => \{[\s\S]*readStoredDisplayLanguage/);
    expect(appProviderSource).not.toMatch(/useState\(readStoredDisplayLanguage/);
  });
});
