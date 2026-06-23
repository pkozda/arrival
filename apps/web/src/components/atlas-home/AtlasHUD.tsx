'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAtlasHomeAuth } from './AtlasHomeProvider';
import { AtlasLogo } from './AtlasLogo';

const MEMBER_NAV_ITEMS = [
  { href: '/', label: 'Explore Atlas', match: (path: string) => path === '/' },
  {
    href: '/modules/life-event',
    label: 'Life Events',
    match: (path: string) => path.startsWith('/modules/life-event'),
  },
  {
    href: '/modules/economic-reality',
    label: 'Economic Reality',
    match: (path: string) => path.startsWith('/modules/economic-reality'),
  },
  {
    href: '/profile',
    label: 'Profile',
    match: (path: string) => path.startsWith('/profile'),
  },
] as const;

export function AtlasHUD() {
  const pathname = usePathname();
  const { isAuthenticated, login, logout } = useAtlasHomeAuth();

  return (
    <header className="atlas-hud" data-ui-surface="atlas-hud">
      <Link href="/" className="atlas-hud__brand">
        <AtlasLogo />
      </Link>

      {isAuthenticated ? (
        <nav className="atlas-hud__nav" aria-label="Primary">
          {MEMBER_NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`atlas-hud__nav-link${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : (
        <div className="atlas-hud__spacer" aria-hidden="true" />
      )}

      <div className={`atlas-hud__actions${isAuthenticated ? '' : ' atlas-hud__actions--guest'}`}>
        {isAuthenticated ? (
          <button type="button" className="atlas-hud__ghost" onClick={logout}>
            Log out
          </button>
        ) : (
          <>
            <button type="button" className="atlas-hud__ghost" onClick={login}>
              Log in
            </button>
            <button type="button" className="atlas-hud__cta" onClick={login}>
              Sign up
            </button>
          </>
        )}
      </div>
    </header>
  );
}
