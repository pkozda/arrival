'use client';

import { Header } from '@/components/Header';
import { HomeSnapshotRenderer } from '@/components/home/HomeSnapshotRenderer';
import { useApp } from '@/components/AppProvider';

function LoadingState() {
  return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--color-danger)', marginBottom: '0.5rem' }}>Unable to load home</p>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{message}</p>
    </div>
  );
}

export default function HomePage() {
  const { t, uiSnapshot, uiSnapshotLoading, uiSnapshotError } = useApp();

  return (
    <>
      <Header />
      <main>
        <section
          style={{
            padding: '3rem 0 2rem',
            textAlign: 'center',
            background: 'linear-gradient(180deg, var(--color-hero-gradient) 0%, transparent 100%)',
          }}
        >
          <div className="container">
            <h1
              style={{
                fontSize: '2.25rem',
                fontWeight: 700,
                marginBottom: '0.75rem',
                letterSpacing: '-0.02em',
              }}
            >
              {t('app.title')}
            </h1>
            <p
              style={{
                fontSize: '1.0625rem',
                color: 'var(--color-text-muted)',
                maxWidth: '540px',
                margin: '0 auto',
              }}
            >
              {t('app.subtitle')}
            </p>
          </div>
        </section>

        <section style={{ padding: '0 0 4rem' }}>
          <div className="container">
            {uiSnapshotLoading && <LoadingState />}
            {!uiSnapshotLoading && uiSnapshotError && !uiSnapshot && (
              <ErrorState message={uiSnapshotError} />
            )}
            {uiSnapshot && <HomeSnapshotRenderer snapshot={uiSnapshot} />}
          </div>
        </section>
      </main>
    </>
  );
}
