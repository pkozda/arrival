'use client';

import { useState } from 'react';
import { ModuleLayout } from '@/components/ModuleLayout';
import { ResultPanel } from '@/components/ResultPanel';
import { ModuleResultRenderer } from '@/components/ModuleResultRenderer';
import { executeModule } from '@/lib/api';
import { useModuleSnapshot, toModuleResult } from '@/lib/snapshot';
import { useApp } from '@/components/AppProvider';

interface TranslationResult {
  results: Array<{
    term: string;
    translation: string;
    explanation: string;
    category: string;
    relatedTerms: string[];
  }>;
  contextHint?: string;
}

export default function SystemTranslationPage() {
  const { sessionId, language, t, refreshUiSnapshot } = useApp();
  const uiState = useModuleSnapshot('system-translation');
  const input = uiState.input;
  const result = uiState.result as TranslationResult | null;
  const moduleResult = toModuleResult<TranslationResult>('system-translation', uiState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);

    const form = new FormData(e.currentTarget);
    const query = form.get('query') as string;
    const mode = form.get('mode') as string;

    try {
      const res = await executeModule<{ query: string; mode: string }, TranslationResult>(
        'system-translation',
        { query, mode },
        { userProfile: { language } },
        sessionId ?? undefined
      );
      if (!res.success) {
        setError(res.error ?? t('common.error'));
      } else {
        await refreshUiSnapshot();
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModuleLayout titleKey="translation.title" descKey="translation.description">
      <form
        key={`system-translation-${uiState.snapshotVersion}`}
        className="card"
        onSubmit={handleSearch}
        style={{ marginBottom: '1.5rem' }}
      >
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="query">Search German term</label>
            <input id="query" name="query" type="text" defaultValue={String(input.query)} placeholder="e.g. Anmeldung, Bürgergeld, Steuerklasse" required />
          </div>
          <div className="form-group" style={{ width: '140px', marginBottom: 0 }}>
            <label htmlFor="mode">Mode</label>
            <select id="mode" name="mode" defaultValue={String(input.mode)}>
              <option value="search">Search</option>
              <option value="lookup">Exact lookup</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={loading || uiState.isStale}>
              {loading ? '...' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      <ResultPanel loading={loading || uiState.isStale} error={error}>
        <ModuleResultRenderer result={moduleResult}>
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {result.contextHint && (
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{result.contextHint}</p>
            )}
            {result.results.map((item, i) => (
              <div key={i} className="card">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{item.term}</h3>
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-primary)' }}>{item.translation}</span>
                  <span className="badge badge-low" style={{ marginLeft: 'auto' }}>{item.category}</span>
                </div>
                <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                  {item.explanation}
                </p>
                {item.relatedTerms.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {item.relatedTerms.map((term) => (
                      <span key={term} style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.5rem',
                        background: 'var(--color-bg)',
                        borderRadius: '999px',
                        color: 'var(--color-text-muted)',
                      }}>
                        {term}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </ModuleResultRenderer>
      </ResultPanel>
    </ModuleLayout>
  );
}
