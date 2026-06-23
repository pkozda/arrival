'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRODUCT_NAME } from '@/lib/product-contract';

const NAV_ITEMS = [
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

  return (
    <header className="atlas-hud" data-ui-surface="atlas-hud">
      <Link href="/" className="atlas-hud__brand">
        <span className="atlas-hud__logo" aria-hidden="true" />
        {PRODUCT_NAME}
      </Link>

      <nav className="atlas-hud__nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
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
    </header>
  );
}
