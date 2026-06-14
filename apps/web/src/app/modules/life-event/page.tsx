'use client';

import { useState } from 'react';
import { ModuleLayout } from '@/components/ModuleLayout';
import { ResultPanel } from '@/components/ResultPanel';
import { executeModule } from '@/lib/api';
import { useApp } from '@/components/AppProvider';

interface LifeEventResult {
  event: string;
  timeline: string;
  phases: Array<{
    phase: string;
    timeframe: string;
    actions: Array<{
      title: string;
      description: string;
      institution?: string;
      deadline?: string;
      priority: 'critical' | 'important' | 'recommended';
    }>;
  }>;
  scenarios: Array<{
    name: string;
    description: string;
    outcomes: string[];
  }>;
  checklist: Array<{
    item: string;
    completed: boolean;
    category: string;
  }>;
}

export default function LifeEventPage() {
  const { sessionId, language, t } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<LifeEventResult | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);

    const form = new FormData(e.currentTarget);
    const input = {
      event: form.get('event') as string,
      timeline: form.get('timeline') as string,
      currentStatus: {
        employed: form.get('employed') === 'on',
        insured: form.get('insured') === 'on',
        registered: form.get('registered') === 'on',
      },
    };

    try {
      const res = await executeModule(
        'life-event',
        input,
        { userProfile: { language } },
        sessionId ?? undefined
      );
      if (!res.success) {
        setError(res.error ?? t('common.error'));
      } else {
        setResult(res.data as LifeEventResult);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  const priorityClass: Record<string, string> = {
    critical: 'priority-critical',
    important: 'priority-important',
    recommended: 'priority-recommended',
  };

  return (
    <ModuleLayout titleKey="lifeEvent.title" descKey="lifeEvent.description">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem' }}>
        <form className="card" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="event">Life event</label>
            <select id="event" name="event" defaultValue="arrival">
              <option value="arrival">Arriving in Germany</option>
              <option value="job-change">Job change</option>
              <option value="job-loss">Job loss</option>
              <option value="marriage">Marriage</option>
              <option value="childbirth">Childbirth</option>
              <option value="move-city">Moving city</option>
              <option value="visa-renewal">Visa renewal</option>
              <option value="divorce">Divorce</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="timeline">Timeline</label>
            <select id="timeline" name="timeline" defaultValue="planning">
              <option value="immediate">Immediate</option>
              <option value="within-month">Within a month</option>
              <option value="within-3-months">Within 3 months</option>
              <option value="planning">Planning ahead</option>
            </select>
          </div>
          <fieldset style={{ border: 'none', marginBottom: '1rem' }}>
            <legend style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
              Current status
            </legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <input name="registered" type="checkbox" /> Registered (Anmeldung)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <input name="insured" type="checkbox" /> Health insurance active
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <input name="employed" type="checkbox" /> Currently employed
              </label>
            </div>
          </fieldset>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? t('common.loading') : t('common.submit')}
          </button>
        </form>

        <ResultPanel loading={loading} error={error}>
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card">
                <h3 style={{ fontWeight: 600 }}>{result.event}</h3>
              </div>

              {result.phases.map((phase) => (
                <div key={phase.phase} className="card">
                  <div style={{ marginBottom: '0.75rem' }}>
                    <strong>{phase.phase}</strong>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
                      {phase.timeframe}
                    </span>
                  </div>
                  {phase.actions.map((action, i) => (
                    <div key={i} className={priorityClass[action.priority]} style={{
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      paddingLeft: '0.75rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={`badge badge-${action.priority === 'critical' ? 'high' : action.priority === 'important' ? 'medium' : 'low'}`}>
                          {action.priority}
                        </span>
                        <strong style={{ fontSize: '0.9375rem' }}>{action.title}</strong>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                        {action.description}
                      </p>
                      {action.deadline && (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-danger)', marginTop: '0.25rem' }}>
                          Deadline: {action.deadline}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {result.checklist.length > 0 && (
                <div className="card">
                  <h4 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Checklist</h4>
                  {result.checklist.map((item) => (
                    <div key={item.item} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.375rem 0',
                      fontSize: '0.875rem',
                      opacity: item.completed ? 0.5 : 1,
                    }}>
                      <span style={{ color: item.completed ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                        {item.completed ? '✓' : '○'}
                      </span>
                      {item.item}
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {item.category}
                      </span>
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
