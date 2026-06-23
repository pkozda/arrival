'use client';

import { AtlasLink as Link } from '@/components/atlas-runtime';
import type { ModuleSuggestion } from '@/lib/situation-utils';
import { useApp } from '@/components/AppProvider';

type Props = {
  suggestions: ModuleSuggestion[];
};

export function SuggestedModulesSection({ suggestions }: Props) {
  const { t } = useApp();

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section style={{ marginBottom: '1rem' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
        {t('life-event.home.suggestedModules')}
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        {suggestions.map(({ module, reason, href }) => (
          <Link
            key={module.id}
            href={href ?? `/modules/${module.id}`}
            className="card"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              {module.title}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              {reason}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
