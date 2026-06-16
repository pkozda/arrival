'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { hasGlobalUx } from '@/lib/ux-aggregator';
import { getUxStoreVersion, subscribeUxStore } from '@/lib/ux-store';

type ModuleCard = {
  id: string;
  href: string;
  titleKey: string;
  descKey: string;
  icon: string;
  color: string;
  priority: boolean;
};

type Props = {
  modules: ModuleCard[];
  t: (key: string) => string;
  forceCollapsed?: boolean;
};

export function ExploreModulesSection({ modules, t, forceCollapsed = false }: Props) {
  useSyncExternalStore(subscribeUxStore, getUxStoreVersion, () => 0);

  const uxAvailable = hasGlobalUx();
  const [expanded, setExpanded] = useState(forceCollapsed ? false : !uxAvailable);

  useEffect(() => {
    if (forceCollapsed) {
      setExpanded(false);
      return;
    }

    if (uxAvailable) {
      setExpanded(false);
    }
  }, [uxAvailable, forceCollapsed]);

  return (
    <section style={{ opacity: uxAvailable ? 0.82 : 1 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: expanded ? '1rem' : 0,
        }}
      >
        <h2
          style={{
            fontSize: uxAvailable ? '1rem' : '1.25rem',
            fontWeight: 600,
            color: uxAvailable ? 'var(--color-text-muted)' : 'inherit',
          }}
        >
          Explore modules
        </h2>
        {uxAvailable && (
          <button
            type="button"
            className="btn"
            onClick={() => setExpanded((open) => !open)}
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-primary)',
              padding: '0.25rem 0.5rem',
            }}
          >
            {expanded ? 'Hide' : 'Show'}
          </button>
        )}
      </div>

      {expanded && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          {modules.map((mod, i) => (
            <Link
              key={mod.id}
              href={mod.href}
              className="card animate-in"
              style={{
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 0.15s, transform 0.15s',
                animationDelay: `${i * 0.05}s`,
                opacity: 0,
                position: 'relative',
              }}
            >
              {mod.priority && (
                <span
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: mod.color,
                    background: `${mod.color}20`,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                  }}
                >
                  MVP
                </span>
              )}
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: `${mod.color}20`,
                  color: mod.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  marginBottom: '1rem',
                }}
              >
                {mod.icon}
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                {t(mod.titleKey)}
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                {t(mod.descKey)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
