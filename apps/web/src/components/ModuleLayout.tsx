'use client';

interface ModuleLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function ModuleLayout({ title, description, children }: ModuleLayoutProps) {
  return (
    <main className="celestial-page-main">
      <div className="container">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {title}
          </h1>
          <p style={{ color: 'var(--color-text-muted)' }}>{description}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
