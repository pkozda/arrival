'use client';

import Link from 'next/link';
import { Header } from '@/components/Header';
import { useApp } from '@/components/AppProvider';

const MODULES = [
  {
    id: 'financial-reality',
    href: '/modules/financial-reality',
    titleKey: 'financial.title',
    descKey: 'financial.description',
    icon: '€',
    color: '#3b82f6',
    priority: true,
  },
  {
    id: 'system-translation',
    href: '/modules/system-translation',
    titleKey: 'translation.title',
    descKey: 'translation.description',
    icon: 'Aa',
    color: '#8b5cf6',
    priority: true,
  },
  {
    id: 'healthcare-navigation',
    href: '/modules/healthcare-navigation',
    titleKey: 'healthcare.title',
    descKey: 'healthcare.description',
    icon: '+',
    color: '#10b981',
    priority: false,
  },
  {
    id: 'grocery-optimization',
    href: '/modules/grocery-optimization',
    titleKey: 'grocery.title',
    descKey: 'grocery.description',
    icon: '🛒',
    color: '#f59e0b',
    priority: false,
  },
  {
    id: 'life-event',
    href: '/modules/life-event',
    titleKey: 'lifeEvent.title',
    descKey: 'lifeEvent.description',
    icon: '◎',
    color: '#ec4899',
    priority: false,
  },
];

export default function HomePage() {
  const { t } = useApp();

  return (
    <>
      <Header />
      <main>
        <section style={{
          padding: '4rem 0 3rem',
          textAlign: 'center',
          background: 'linear-gradient(180deg, var(--color-hero-gradient) 0%, transparent 100%)',
        }}>
          <div className="container">
            <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
              {t('app.title')}
            </h1>
            <p style={{ fontSize: '1.125rem', color: 'var(--color-text-muted)', maxWidth: '540px', margin: '0 auto' }}>
              {t('app.subtitle')}
            </p>
          </div>
        </section>

        <section style={{ padding: '0 0 4rem' }}>
          <div className="container">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem',
            }}>
              {MODULES.map((mod, i) => (
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
                    <span style={{
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
                    }}>
                      MVP
                    </span>
                  )}
                  <div style={{
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
                  }}>
                    {mod.icon}
                  </div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    {t(mod.titleKey)}
                  </h2>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    {t(mod.descKey)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
