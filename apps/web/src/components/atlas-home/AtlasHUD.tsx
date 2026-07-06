'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AtlasLink as Link } from '@/components/atlas-runtime';
import { usePathname } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
import { useAtlasHomeDemo } from './AtlasHomeProvider';
import { AtlasLogo } from './AtlasLogo';
import { LeaveDemoConfirm } from './LeaveDemoConfirm';

const EXPLORING_NAV_ITEMS = [
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
  const router = useRouter();
  const { isExploringAtlas, enterAtlas } = useAtlasHomeDemo();
  const { leaveDemoAndReset } = useApp();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const handleLeaveRequest = () => {
    setLeaveError(null);
    setConfirmOpen(true);
  };

  const handleLeaveConfirm = async () => {
    setLeaving(true);
    setLeaveError(null);

    try {
      await leaveDemoAndReset();
      setConfirmOpen(false);
      router.push('/');
    } catch (error) {
      setLeaveError(error instanceof Error ? error.message : 'Could not reset demo');
    } finally {
      setLeaving(false);
    }
  };

  return (
    <>
      <header className="atlas-hud" data-ui-surface="atlas-hud">
        <Link href="/" className="atlas-hud__brand">
          <AtlasLogo />
        </Link>

        {isExploringAtlas ? (
          <nav className="atlas-hud__nav" aria-label="Primary">
            {EXPLORING_NAV_ITEMS.map((item) => {
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

        <div className={`atlas-hud__actions${isExploringAtlas ? '' : ' atlas-hud__actions--guest'}`}>
          {leaveError && (
            <p className="atlas-hud__leave-error" role="alert">
              {leaveError}
            </p>
          )}
          {isExploringAtlas ? (
            <button
              type="button"
              className="atlas-hud__ghost"
              onClick={handleLeaveRequest}
              aria-label="Leave Atlas demo and start over"
            >
              Leave demo
            </button>
          ) : (
            <button
              type="button"
              className="atlas-hud__cta"
              onClick={enterAtlas}
              aria-label="Enter Atlas demo"
            >
              Enter Atlas
            </button>
          )}
        </div>
      </header>

      <LeaveDemoConfirm
        open={confirmOpen}
        leaving={leaving}
        onCancel={() => {
          if (!leaving) {
            setConfirmOpen(false);
          }
        }}
        onConfirm={() => {
          void handleLeaveConfirm();
        }}
      />
    </>
  );
}
