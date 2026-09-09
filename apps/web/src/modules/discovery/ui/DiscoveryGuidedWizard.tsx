'use client';

import { useState } from 'react';
import { AtlasSecondaryButton } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import {
  buildGuidedCreateInput,
  canSubmitGuidedDraft,
  createInitialGuidedDraft,
  guidedWizardClaimsDiscoveryResults,
  guidedWizardClaimsDiscoveryRun,
  nextGuidedStep,
  previousGuidedStep,
  validateGuidedCriteria,
  type GuidedDiscoveryDraft,
  type GuidedDiscoveryStep,
} from '@/lib/discovery/guided-wizard';
import type { CreateDiscoveryProfileInput, DiscoveryStrategyTemplate } from '@/lib/discovery';

type Props = {
  onCancel: () => void;
  onCreatedContinue: () => void;
  createProfile: (input: CreateDiscoveryProfileInput) => Promise<unknown>;
};

export function DiscoveryGuidedWizard({ onCancel, onCreatedContinue, createProfile }: Props) {
  const { t } = useApp();
  const [step, setStep] = useState<GuidedDiscoveryStep>('welcome');
  const [draft, setDraft] = useState<GuidedDiscoveryDraft>(createInitialGuidedDraft);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  const missing = validateGuidedCriteria(draft);
  const claimsRun = guidedWizardClaimsDiscoveryRun();
  const claimsResults = guidedWizardClaimsDiscoveryResults();

  const goNext = () => {
    if (step === 'criteria') {
      if (!canSubmitGuidedDraft(draft)) {
        setShowValidation(true);
        return;
      }
      setShowValidation(false);
    }
    if (step === 'intent' && !draft.template) {
      setShowValidation(true);
      return;
    }
    const next = nextGuidedStep(step);
    if (next) {
      setCreateError(null);
      setStep(next);
    }
  };

  const goBack = () => {
    const prev = previousGuidedStep(step);
    if (prev && prev !== 'created') {
      setCreateError(null);
      setStep(prev);
    }
  };

  const selectIntent = (template: DiscoveryStrategyTemplate) => {
    setDraft((current) => ({
      ...current,
      template,
      name:
        current.name.trim() ||
        (template === 'jobs'
          ? t('discovery.guided.defaultName.jobs')
          : t('discovery.guided.defaultName.giveaways')),
    }));
    setShowValidation(false);
  };

  const handleCreate = async () => {
    if (!canSubmitGuidedDraft(draft)) {
      setShowValidation(true);
      setStep('criteria');
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      await createProfile(buildGuidedCreateInput(draft));
      setStep('created');
    } catch (error) {
      setCreateError(
        error instanceof Error && error.message
          ? error.message
          : t('discovery.guided.createError')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="discovery-panel discovery-guided-wizard"
      data-ui-surface="discovery-guided-wizard"
      data-guided-step={step}
      data-claims-discovery-run={String(claimsRun)}
      data-claims-discovery-results={String(claimsResults)}
      aria-labelledby="discovery-guided-title"
    >
      <h2 id="discovery-guided-title" className="discovery-panel__title">
        {t('discovery.guided.title')}
      </h2>
      <p className="text-meta">{t(`discovery.guided.stepLabel.${step}`)}</p>

      {step === 'welcome' ? (
        <div data-guided-panel="welcome">
          <p className="text-body">{t('discovery.guided.welcome.body')}</p>
          <p className="text-meta">{t('discovery.guided.welcome.boundary')}</p>
          <div className="discovery-create-form__actions">
            <button type="button" className="btn btn-primary" data-guided-action="start" onClick={goNext}>
              {t('discovery.guided.welcome.start')}
            </button>
            <AtlasSecondaryButton type="button" onClick={onCancel}>
              {t('discovery.guided.cancel')}
            </AtlasSecondaryButton>
          </div>
        </div>
      ) : null}

      {step === 'intent' ? (
        <div data-guided-panel="intent">
          <p className="text-body">{t('discovery.guided.intent.body')}</p>
          <div className="discovery-guided-wizard__intents">
            <button
              type="button"
              className={`btn${draft.template === 'jobs' ? ' btn-primary' : ''}`}
              data-guided-intent="jobs"
              aria-pressed={draft.template === 'jobs'}
              onClick={() => selectIntent('jobs')}
            >
              {t('discovery.strategy.jobs')}
            </button>
            <button
              type="button"
              className={`btn${draft.template === 'giveaways' ? ' btn-primary' : ''}`}
              data-guided-intent="giveaways"
              aria-pressed={draft.template === 'giveaways'}
              onClick={() => selectIntent('giveaways')}
            >
              {t('discovery.strategy.giveaways')}
            </button>
          </div>
          {showValidation && !draft.template ? (
            <p className="text-body" role="alert" data-guided-validation="intent">
              {t('discovery.guided.validation.intent')}
            </p>
          ) : null}
          <div className="discovery-create-form__actions">
            <AtlasSecondaryButton type="button" onClick={goBack}>
              {t('discovery.guided.back')}
            </AtlasSecondaryButton>
            <button type="button" className="btn btn-primary" data-guided-action="next" onClick={goNext}>
              {t('discovery.guided.next')}
            </button>
          </div>
        </div>
      ) : null}

      {step === 'criteria' ? (
        <div data-guided-panel="criteria">
          <p className="text-body">{t('discovery.guided.criteria.body')}</p>
          <form
            className="discovery-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              goNext();
            }}
          >
            <label>
              {t('discovery.create.name')}
              <input
                value={draft.name}
                data-guided-field="name"
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <label>
              {t('discovery.create.country')}
              <input
                value={draft.country}
                data-guided-field="country"
                maxLength={2}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, country: event.target.value.toUpperCase() }))
                }
                required
              />
            </label>
            {draft.template === 'jobs' ? (
              <label>
                {t('discovery.create.role')}
                <input
                  value={draft.role}
                  data-guided-field="role"
                  onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))}
                />
              </label>
            ) : null}
            {showValidation && missing.includes('name') ? (
              <p className="text-body" role="alert" data-guided-validation="name">
                {t('discovery.guided.validation.name')}
              </p>
            ) : null}
            {showValidation && missing.includes('country') ? (
              <p className="text-body" role="alert" data-guided-validation="country">
                {t('discovery.guided.validation.country')}
              </p>
            ) : null}
            <div className="discovery-create-form__actions">
              <AtlasSecondaryButton type="button" onClick={goBack}>
                {t('discovery.guided.back')}
              </AtlasSecondaryButton>
              <button type="submit" className="btn btn-primary" data-guided-action="next">
                {t('discovery.guided.next')}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {step === 'review' ? (
        <div data-guided-panel="review">
          <p className="text-body">{t('discovery.guided.review.body')}</p>
          <ul className="text-body" data-guided-review>
            <li data-review-field="intent">
              {t('discovery.guided.review.intent')}:{' '}
              {draft.template === 'jobs'
                ? t('discovery.strategy.jobs')
                : t('discovery.strategy.giveaways')}
            </li>
            <li data-review-field="name">
              {t('discovery.create.name')}: {draft.name.trim()}
            </li>
            <li data-review-field="country">
              {t('discovery.create.country')}: {draft.country.trim().toUpperCase()}
            </li>
            {draft.template === 'jobs' && draft.role.trim() ? (
              <li data-review-field="role">
                {t('discovery.create.role')}: {draft.role.trim()}
              </li>
            ) : null}
          </ul>
          <p className="text-meta">{t('discovery.guided.review.boundary')}</p>
          {createError ? (
            <p className="text-body" role="alert" data-guided-create-error>
              {createError}
            </p>
          ) : null}
          <div className="discovery-create-form__actions">
            <AtlasSecondaryButton type="button" onClick={goBack} disabled={submitting}>
              {t('discovery.guided.back')}
            </AtlasSecondaryButton>
            <button
              type="button"
              className="btn btn-primary"
              data-guided-action="create"
              disabled={submitting}
              onClick={() => void handleCreate()}
            >
              {submitting ? t('discovery.guided.creating') : t('discovery.guided.create')}
            </button>
          </div>
        </div>
      ) : null}

      {step === 'created' ? (
        <div data-guided-panel="created">
          <p className="text-body" data-guided-confirmation role="status">
            {t('discovery.guided.created.confirmation')}
          </p>
          <p className="text-meta">{t('discovery.guided.created.next')}</p>
          <div className="discovery-create-form__actions">
            <button
              type="button"
              className="btn btn-primary"
              data-guided-action="continue"
              onClick={onCreatedContinue}
            >
              {t('discovery.guided.created.continue')}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
