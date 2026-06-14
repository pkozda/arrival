'use client';

import { useState } from 'react';
import { ModuleLayout } from '@/components/ModuleLayout';
import { ResultPanel } from '@/components/ResultPanel';
import { executeModule } from '@/lib/api';
import { useApp } from '@/components/AppProvider';

interface FinancialResult {
  income: {
    gross: number;
    net: number;
    deductions: {
      incomeTax: number;
      solidaritySurcharge: number;
      churchTax: number;
      socialContributions: number;
    };
    effectiveTaxRate: number;
  };
  benefits: {
    buergergeld: {
      eligible: boolean;
      estimatedBenefit: number;
      reasoning: string[];
    };
  };
  decisions: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    action?: string;
  }>;
  adminRules: string[];
}

export default function FinancialRealityPage() {
  const { sessionId, language, t } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<FinancialResult | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);

    const form = new FormData(e.currentTarget);
    const input = {
      grossIncome: Number(form.get('grossIncome')),
      taxClass: Number(form.get('taxClass')) as 1 | 2 | 3 | 4 | 5 | 6,
      churchTax: form.get('churchTax') === 'on',
      householdSize: Number(form.get('householdSize')),
      monthlyRent: Number(form.get('monthlyRent')),
      employmentStatus: form.get('employmentStatus') as string,
      maritalStatus: form.get('maritalStatus') as string,
    };

    try {
      const res = await executeModule<typeof input, FinancialResult>(
        'financial-reality',
        input,
        { userProfile: { language } },
        sessionId ?? undefined
      );
      if (!res.success) {
        setError(res.error ?? t('common.error'));
      } else {
        setResult(res.data ?? null);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModuleLayout titleKey="financial.title" descKey="financial.description">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <form className="card" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="grossIncome">Gross monthly income (€)</label>
            <input id="grossIncome" name="grossIncome" type="number" defaultValue={2500} min={0} required />
          </div>
          <div className="form-group">
            <label htmlFor="taxClass">Steuerklasse</label>
            <select id="taxClass" name="taxClass" defaultValue="1">
              {[1, 2, 3, 4, 5, 6].map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="householdSize">Household size</label>
            <input id="householdSize" name="householdSize" type="number" defaultValue={1} min={1} required />
          </div>
          <div className="form-group">
            <label htmlFor="monthlyRent">Monthly rent (€)</label>
            <input id="monthlyRent" name="monthlyRent" type="number" defaultValue={800} min={0} required />
          </div>
          <div className="form-group">
            <label htmlFor="employmentStatus">Employment status</label>
            <select id="employmentStatus" name="employmentStatus" defaultValue="employed">
              <option value="employed">Employed</option>
              <option value="self-employed">Self-employed</option>
              <option value="unemployed">Unemployed</option>
              <option value="part-time">Part-time</option>
              <option value="student">Student</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="maritalStatus">Marital status</label>
            <select id="maritalStatus" name="maritalStatus" defaultValue="single">
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input id="churchTax" name="churchTax" type="checkbox" />
            <label htmlFor="churchTax" style={{ margin: 0 }}>Church tax (Kirchensteuer)</label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? t('common.loading') : t('common.submit')}
          </button>
        </form>

        <ResultPanel loading={loading} error={error}>
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card">
                <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                  Income Breakdown
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Stat label="Gross" value={`€${result.income.gross}`} />
                  <Stat label="Net" value={`€${result.income.net}`} highlight />
                  <Stat label="Income tax" value={`€${result.income.deductions.incomeTax}`} />
                  <Stat label="Social contributions" value={`€${result.income.deductions.socialContributions}`} />
                  <Stat label="Effective tax rate" value={`${result.income.effectiveTaxRate}%`} />
                </div>
              </div>

              <div className="card">
                <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                  Bürgergeld Eligibility
                </h3>
                <p style={{ fontWeight: 600, color: result.benefits.buergergeld.eligible ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                  {result.benefits.buergergeld.eligible
                    ? `Potentially eligible — ~€${result.benefits.buergergeld.estimatedBenefit}/month`
                    : 'Likely not eligible'}
                </p>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  {result.benefits.buergergeld.reasoning.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              {result.decisions.length > 0 && (
                <div className="card">
                  <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                    Decisions
                  </h3>
                  {result.decisions.map((d, i) => (
                    <div key={i} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: i < result.decisions.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span className={`badge badge-${d.priority}`}>{d.priority}</span>
                        <strong style={{ fontSize: '0.9375rem' }}>{d.title}</strong>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{d.description}</p>
                      {d.action && (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', marginTop: '0.25rem' }}>
                          → {d.action}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
