'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from './AppProvider';
import type { SupportedLanguage } from '@arrivalos/core';

const NAV_ITEMS = [
  { href: '/modules/financial-reality', key: 'nav.financial', icon: '€' },
  { href: '/modules/healthcare-navigation', key: 'nav.healthcare', icon: '+' },
  { href: '/modules/grocery-optimization', key: 'nav.grocery', icon: '🛒' },
  { href: '/modules/system-translation', key: 'nav.translation', icon: 'Aa' },
  { href: '/modules/life-event', key: 'nav.lifeEvents', icon: '◎' },
];

const LANGUAGES: { code: SupportedLanguage; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
  { code: 'ru', label: 'RU' },
  { code: 'ua', label: 'UA' },
];

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

export function Header() {
  const pathname = usePathname();
  const { language, setLanguage, theme, toggleTheme, t } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
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
            <span className="header-logo-title">ArrivalOS</span>
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
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`header-nav-link${active ? ' header-nav-link--active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="header-nav-icon">{item.icon}</span>
                  <span>{t(item.key)}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="header-drawer-footer">
          <span className="header-drawer-label">{t('common.language')}</span>
          <div className="header-lang-group">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                className={`header-lang-btn${language === lang.code ? ' header-lang-btn--active' : ''}`}
                onClick={() => setLanguage(lang.code)}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
