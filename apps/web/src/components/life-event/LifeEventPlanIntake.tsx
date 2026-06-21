'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { DomainFieldRenderer } from '@/components/profile/DomainFieldRenderer';
import {
  buildColdStartIntakeRequests,
  LIFE_EVENT_COLD_START_FIELDS,
  validateColdStartIntakeDraft,
} from '@/lib/life-event/cold-start-intake';
import type { DomainDraftValues } from '@/lib/profile-correction';
import { submitDomainCorrectionRequests } from '@/lib/profile-correction/submit-domain-correction';

function translateLabel(
  t: (key: string) => string,
  key: string,
  fallback: string
): string {
  const value = t(key);
  return value === key ? fallback : value;
}

export function LifeEventPlanIntake() {
  const { t, submitMutation, profileHeadRevision } = useApp();
  const [draft, setDraft] = useState<DomainDraftValues>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(
    () =>
      LIFE_EVENT_COLD_START_FIELDS.map((field) => ({
        ...field,
        label: translateLabel(t, `life-event.intake.field.${field.formKey}`, field.label),
        placeholder: field.placeholder
          ? translateLabel(
              t,
              `life-event.intake.placeholder.${field.formKey}`,
              field.placeholder
            )
          : undefined,
        options: field.options?.map((option) => ({
          ...option,
          label: translateLabel(
            t,
            `life-event.intake.option.${field.formKey}.${option.value}`,
            option.label
          ),
        })),
      })),
    [t]
  );

  const handleFieldChange = (formKey: string, value: string | boolean | number | undefined) => {
    setDraft((current) => ({ ...current, [formKey]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const missingField = validateColdStartIntakeDraft(draft);
    if (missingField) {
      setError(t('life-event.intake.validationRequired'));
      setSaving(false);
      return;
    }

    try {
      const requests = buildColdStartIntakeRequests(draft, profileHeadRevision);
      await submitDomainCorrectionRequests({
        requests,
        profileHeadRevision,
        submitMutation,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card le-plan-intake" aria-labelledby="le-plan-intake-title">
      <header className="le-plan-intake__header">
        <h2 id="le-plan-intake-title" className="le-plan-intake__title">
          {t('life-event.intake.title')}
        </h2>
        <p className="le-plan-intake__description">{t('life-event.intake.description')}</p>
        <p className="le-plan-intake__meta">{t('life-event.home.coldStart.duration')}</p>
      </header>

      <form onSubmit={handleSubmit} className="le-plan-intake__form">
        {fields.map((field) => (
          <DomainFieldRenderer
            key={field.formKey}
            field={field}
            value={draft[field.formKey]}
            onChange={handleFieldChange}
            disabled={saving}
          />
        ))}

        {error && (
          <p className="le-plan-intake__error" role="alert">
            {error}
          </p>
        )}

        <div className="le-plan-intake__actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.loading') : t('life-event.intake.submit')}
          </button>
          <Link href="/modules/life-event?mode=scenarios" className="btn btn-secondary">
            {t('life-event.home.coldStart.exploreScenarios')}
          </Link>
        </div>
      </form>
    </section>
  );
}
