'use client';

import { useEffect, useMemo, useState } from 'react';
import { AtlasLink as Link } from '@/components/atlas-runtime';
import { usePathname } from 'next/navigation';
import { useApp } from './AppProvider';
import {
  formatCategoryLabel,
  groupModulesByCategory,
} from '@/lib/module-catalog-utils';
import { PRODUCT_NAME, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/lib/product-contract';
import { isDevToolsUiEnabled } from '@/lib/dev-tools/reset-user-data';
import { DEMO_PERSONA_IDS, getDemoPersona, type DemoPersonaId } from '@arrival-atlas/life-event-demo/personas';
import { EconomicRealityNavLink } from '@/app-shell/navigation/EconomicRealityNavLink';

function ThemeIcon({ theme }: { theme: 'light' | 'dark' }) {
  if (theme === 'dark') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </>
      )}
    </svg>
  );
}

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'EN',
  de: 'DE',
  ru: 'RU',
  ua: 'UA',
};

function CategoryNavSection({
  category,
  modules,
  pathname,
  onNavigate,
}: {
  category: string;
  modules: ReturnType<typeof groupModulesByCategory>[number]['modules'];
  pathname: string;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const sectionId = `nav-category-${category.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <li className="header-nav-category">
      <button
        type="button"
        className="header-nav-category-toggle"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={sectionId}
      >
        <span>{formatCategoryLabel(category)}</span>
        <span aria-hidden>{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <ul id={sectionId} className="header-nav-category-list">
          {modules.map((module) => {
            const href = `/modules/${module.id}`;
            const active = pathname === href;

            return (
              <li key={module.id}>
                <Link
                  href={href}
                  className={`header-nav-link${active ? ' header-nav-link--active' : ''}`}
                  onClick={onNavigate}
                >
                  <span className="header-nav-icon">{module.metadata.icon ?? '•'}</span>
                  <span>{module.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

const LANGUAGE_DRAWER_LABEL = 'Language';

export function Header() {
  const pathname = usePathname();
  const { language, changeLanguage, theme, toggleTheme, t, modules, resetUserData, loadDemoPreset } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [resetting, setResetting] = useState<'session' | 'all' | null>(null);
  const [loadingPreset, setLoadingPreset] = useState<DemoPersonaId | null>(null);
  const groupedModules = useMemo(() => groupModulesByCategory(modules), [modules]);
  const devToolsEnabled = isDevToolsUiEnabled();

  async function handleReset(scope: 'session' | 'all') {
    const label = scope === 'all' ? 'all local dev state' : 'your session data';
    if (!window.confirm(`Clear ${label}? This cannot be undone.`)) {
      return;
    }

    setResetting(scope);
    try {
      await resetUserData(scope);
      setMenuOpen(false);
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : 'Reset failed');
    } finally {
      setResetting(null);
    }
  }

  async function handleLoadPreset(presetId: DemoPersonaId) {
    const persona = getDemoPersona(presetId);
    setLoadingPreset(presetId);
    try {
      await loadDemoPreset(presetId);
      setMenuOpen(false);
      window.alert(`Demo loaded: ${persona.title}`);
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : 'Failed to load demo preset');
    } finally {
      setLoadingPreset(null);
    }
  }

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <>
      <header className="header">
        <div className="header-inner container">
          <Link href="/" className="header-logo">
            <span className="header-logo-title">{PRODUCT_NAME}</span>
            <span className="header-logo-version">v0.1</span>
          </Link>

          <div className="header-actions">
            <button
              type="button"
              className="header-icon-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            >
              <ThemeIcon theme={theme} />
            </button>

            <button
              type="button"
              className="header-icon-btn header-menu-btn"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="header-nav-drawer"
            >
              <BurgerIcon open={menuOpen} />
            </button>
          </div>
        </div>
      </header>

      <div
        className={`header-overlay${menuOpen ? ' header-overlay--visible' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden={!menuOpen}
      />

      <nav
        id="header-nav-drawer"
        className={`header-drawer${menuOpen ? ' header-drawer--open' : ''}`}
        aria-hidden={!menuOpen}
      >
        <div className="header-drawer-header">
          <span className="header-drawer-title">Menu</span>
          <button
            type="button"
            className="header-icon-btn"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <BurgerIcon open />
          </button>
        </div>

        <ul className="header-nav-list">
          <li>
            <Link
              href="/profile"
              className={`header-nav-link header-nav-link--situation${
                pathname === '/profile' || pathname.startsWith('/profile/')
                  ? ' header-nav-link--active'
                  : ''
              }`}
              onClick={() => setMenuOpen(false)}
            >
              <span className="header-nav-icon">◎</span>
              <span>Your situation</span>
            </Link>
          </li>
          <EconomicRealityNavLink onNavigate={() => setMenuOpen(false)} />
          {groupedModules.map(({ category, modules: categoryModules }) => (
            <CategoryNavSection
              key={category}
              category={category}
              modules={categoryModules}
              pathname={pathname}
              onNavigate={() => setMenuOpen(false)}
            />
          ))}
        </ul>

        <div className="header-drawer-footer">
          {devToolsEnabled && (
            <div className="header-dev-tools">
              <span className="header-drawer-label">Dev tools</span>
              <div className="header-dev-tools-actions">
                <button
                  type="button"
                  className="header-dev-btn"
                  disabled={resetting !== null}
                  onClick={() => void handleReset('session')}
                >
                  {resetting === 'session' ? 'Resetting…' : 'Reset my data'}
                </button>
                <button
                  type="button"
                  className="header-dev-btn header-dev-btn--danger"
                  disabled={resetting !== null}
                  onClick={() => void handleReset('all')}
                >
                  {resetting === 'all' ? 'Clearing…' : 'Clear all local state'}
                </button>
              </div>
              <span className="header-drawer-label">Life Event demos</span>
              <div className="header-dev-tools-actions header-dev-tools-actions--stack">
                {DEMO_PERSONA_IDS.map((presetId) => {
                  const persona = getDemoPersona(presetId);
                  return (
                    <button
                      key={presetId}
                      type="button"
                      className="header-dev-btn"
                      disabled={loadingPreset !== null || resetting !== null}
                      onClick={() => void handleLoadPreset(presetId)}
                    >
                      {loadingPreset === presetId ? 'Loading…' : persona.title.replace('Persona ', '')}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <span className="header-drawer-label">
            {mounted ? t('common.language') : LANGUAGE_DRAWER_LABEL}
          </span>
          <div className="header-lang-group">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                className={`header-lang-btn${language === lang ? ' header-lang-btn--active' : ''}`}
                onClick={() => changeLanguage(lang)}
              >
                {LANGUAGE_LABELS[lang]}
              </button>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
