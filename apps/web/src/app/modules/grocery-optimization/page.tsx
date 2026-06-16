'use client';

import { useState } from 'react';
import { ModuleLayout } from '@/components/ModuleLayout';
import { ResultPanel } from '@/components/ResultPanel';
import { ModuleResultRenderer } from '@/components/ModuleResultRenderer';
import { executeModule } from '@/lib/api';
import { useModuleSnapshot, toModuleResult } from '@/lib/snapshot';
import { useApp } from '@/components/AppProvider';

interface GroceryResult {
  budgetBreakdown: {
    total: number;
    perPerson: number;
    perDay: number;
    perMeal: number;
  };
  storeRecommendations: Array<{
    store: string;
    strategy: string;
    estimatedSavings: string;
  }>;
  shoppingPlan: Array<{
    category: string;
    items: string[];
    estimatedCost: number;
    tip?: string;
  }>;
  decisions: Array<{
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
  }>;
}

export default function GroceryOptimizationPage() {
  const { sessionId, language, t, refreshUiSnapshot } = useApp();
  const uiState = useModuleSnapshot('grocery-optimization');
  const input = uiState.input;
  const result = uiState.result as GroceryResult | null;
  const moduleResult = toModuleResult<GroceryResult>('grocery-optimization', uiState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);

    const form = new FormData(e.currentTarget);
    const submitInput = {
      monthlyBudget: Number(form.get('monthlyBudget')),
      householdSize: Number(form.get('householdSize')),
    };

    try {
      const res = await executeModule<typeof submitInput, GroceryResult>(
        'grocery-optimization',
        submitInput,
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
    <ModuleLayout titleKey="grocery.title" descKey="grocery.description">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem' }}>
        <form
          key={`grocery-optimization-${uiState.snapshotVersion}`}
          className="card"
          onSubmit={handleSubmit}
        >
          <div className="form-group">
            <label htmlFor="monthlyBudget">Monthly food budget (€)</label>
            <input id="monthlyBudget" name="monthlyBudget" type="number" defaultValue={Number(input.monthlyBudget)} min={50} required />
          </div>
          <div className="form-group">
            <label htmlFor="householdSize">Household size</label>
            <input id="householdSize" name="householdSize" type="number" defaultValue={Number(input.householdSize)} min={1} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading || uiState.isStale} style={{ width: '100%' }}>
            {loading ? t('common.loading') : t('common.submit')}
          </button>
        </form>

        <ResultPanel loading={loading || uiState.isStale} error={error}>
          <ModuleResultRenderer result={moduleResult}>
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card">
                <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                  Budget Breakdown
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Stat label="Per person" value={`€${result.budgetBreakdown.perPerson}`} />
                  <Stat label="Per day" value={`€${result.budgetBreakdown.perDay}`} />
                  <Stat label="Per meal" value={`€${result.budgetBreakdown.perMeal}`} highlight />
                </div>
              </div>

              <div className="card">
                <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                  Store Strategy
                </h3>
                {result.storeRecommendations.map((s, i) => (
                  <div key={i} style={{ marginBottom: '0.75rem' }}>
                    <strong>{s.store}</strong>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-accent)', marginLeft: '0.5rem' }}>
                      {s.estimatedSavings}
                    </span>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{s.strategy}</p>
                  </div>
                ))}
              </div>

              <div className="card">
                <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                  Shopping Plan
                </h3>
                {result.shoppingPlan.map((cat) => (
                  <div key={cat.category} style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <strong style={{ fontSize: '0.875rem' }}>{cat.category}</strong>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{cat.items.join(', ')}</p>
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>~€{cat.estimatedCost}</span>
                  </div>
                ))}
              </div>

              {result.decisions.map((d, i) => (
                <div key={i} className="card">
                  <span className={`badge badge-${d.impact === 'high' ? 'high' : d.impact === 'medium' ? 'medium' : 'low'}`}>
                    {d.impact}
                  </span>
                  <strong style={{ marginLeft: '0.5rem' }}>{d.title}</strong>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{d.description}</p>
                </div>
              ))}
            </div>
          )}
          </ModuleResultRenderer>
        </ResultPanel>
      </div>
    </ModuleLayout>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{label}</div>
      <div style={{ fontSize: '1.125rem', fontWeight: highlight ? 700 : 500, color: highlight ? 'var(--color-accent)' : 'inherit' }}>
        {value}
      </div>
    </div>
  );
}
