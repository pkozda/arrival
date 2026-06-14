'use client';

import { Header } from './Header';
import { useApp } from './AppProvider';

interface ModuleLayoutProps {
  titleKey: string;
  descKey: string;
  children: React.ReactNode;
}

export function ModuleLayout({ titleKey, descKey, children }: ModuleLayoutProps) {
  const { t } = useApp();

  return (
    <>
      <Header />
      <main style={{ padding: '2rem 0 4rem' }}>
        <div className="container">
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              {t(titleKey)}
            </h1>
            <p style={{ color: 'var(--color-text-muted)' }}>{t(descKey)}</p>
          </div>
          {children}
        </div>
      </main>
    </>
  );
}
