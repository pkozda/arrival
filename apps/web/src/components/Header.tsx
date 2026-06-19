'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from './AppProvider';
import {
  formatCategoryLabel,
  groupModulesByCategory,
} from '@/lib/module-catalog-utils';
import { PRODUCT_NAME, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/lib/product-contract';

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

export function Header() {
  const pathname = usePathname();
  const { language, changeLanguage, theme, toggleTheme, t, modules } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const groupedModules = useMemo(() => groupModulesByCategory(modules), [modules]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
          <span className="header-drawer-label">{t('common.language')}</span>
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
