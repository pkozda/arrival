'use client';

import { useState } from 'react';
import { ModuleLayout } from '@/components/ModuleLayout';
import { ResultPanel } from '@/components/ResultPanel';
import { executeModule } from '@/lib/api';
import { useApp } from '@/components/AppProvider';

interface HealthcareResult {
  scenario: string;
  steps: Array<{
    order: number;
    title: string;
    description: string;
    institution?: string;
    documents?: string[];
  }>;
  decisions: Array<{
    title: string;
    options: Array<{
      label: string;
      pros: string[];
      cons: string[];
    }>;
  }>;
  warnings: string[];
}

export default function HealthcareNavigationPage() {
  const { sessionId, language, t } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<HealthcareResult | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);

    const form = new FormData(e.currentTarget);
    const input = {
      situation: form.get('situation') as string,
      hasInsurance: form.get('hasInsurance') === 'on',
      insuranceType: form.get('insuranceType') as string,
      urgency: form.get('urgency') as string,
    };

    try {
      const res = await executeModule(
        'healthcare-navigation',
        input,
        { userProfile: { language } },
        sessionId ?? undefined
      );
      if (!res.success) {
        setError(res.error ?? t('common.error'));
      } else {
        setResult(res.data as HealthcareResult);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModuleLayout titleKey="healthcare.title" descKey="healthcare.description">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem' }}>
        <form className="card" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="situation">Your situation</label>
            <select id="situation" name="situation" defaultValue="new-arrival">
              <option value="new-arrival">New arrival</option>
              <option value="need-doctor">Need a doctor</option>
              <option value="need-specialist">Need a specialist</option>
              <option value="insurance-choice">Choosing insurance</option>
              <option value="emergency">Emergency</option>
              <option value="prescription">Prescription</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="urgency">Urgency</label>
            <select id="urgency" name="urgency" defaultValue="routine">
              <option value="routine">Routine</option>
              <option value="soon">Soon</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="insuranceType">Insurance type</label>
            <select id="insuranceType" name="insuranceType" defaultValue="none">
              <option value="none">None</option>
              <option value="public">Public (GKV)</option>
              <option value="private">Private (PKV)</option>
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input id="hasInsurance" name="hasInsurance" type="checkbox" />
            <label htmlFor="hasInsurance" style={{ margin: 0 }}>I have active insurance</label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? t('common.loading') : t('common.submit')}
          </button>
        </form>

        <ResultPanel loading={loading} error={error}>
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {result.warnings.length > 0 && (
                <div className="card" style={{ borderColor: 'var(--color-warning)' }}>
                  {result.warnings.map((w, i) => (
                    <p key={i} style={{ fontSize: '0.875rem', color: 'var(--color-warning)' }}>⚠ {w}</p>
                  ))}
                </div>
              )}

              <div className="card">
                <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>{result.scenario}</h3>
                {result.steps.map((step) => (
                  <div key={step.order} style={{
                    marginBottom: '1rem',
                    paddingLeft: '1rem',
                    borderLeft: '2px solid var(--color-primary)',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                      Step {step.order}
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{step.title}</div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{step.description}</p>
                    {step.institution && (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-accent)', marginTop: '0.25rem' }}>
                        {step.institution}
                      </p>
                    )}
                    {step.documents && (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        Documents: {step.documents.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {result.decisions.map((d, i) => (
                <div key={i} className="card">
                  <h4 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{d.title}</h4>
                  {d.options.map((opt) => (
                    <div key={opt.label} style={{ marginBottom: '0.75rem' }}>
                      <strong style={{ fontSize: '0.9375rem' }}>{opt.label}</strong>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                        <div>
                          {opt.pros.map((p) => <div key={p} style={{ color: 'var(--color-accent)' }}>+ {p}</div>)}
                        </div>
                        <div>
                          {opt.cons.map((c) => <div key={c} style={{ color: 'var(--color-text-muted)' }}>− {c}</div>)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ResultPanel>
      </div>
    </ModuleLayout>
  );
}
