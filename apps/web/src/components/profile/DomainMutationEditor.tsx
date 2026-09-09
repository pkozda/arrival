'use client';

import { AtlasLink as Link } from '@/components/atlas-runtime';
import { useEffect, useMemo, useState } from 'react';
import { AtlasSecondaryButton, PageHeader } from '@/components/atlas-runtime';
import { LegacyFormNode } from '@/components/atlas-runtime/legacy';
import { useApp } from '@/components/AppProvider';
import { DomainFieldRenderer } from '@/components/profile/DomainFieldRenderer';
import { updateSessionLanguage, updateSessionTheme } from '@/lib/api';
import {
  buildDomainCorrectionRequests,
  buildInitialDraft,
  getDomainEditSection,
  isSupportedLanguage,
  isThemePreference,
  type DomainDraftValues,
} from '@/lib/profile-correction';
import { submitDomainCorrectionRequests } from '@/lib/profile-correction/submit-domain-correction';
import type { ProfileMirrorDomainSlug } from '@/lib/profile-mirror-utils';
import { selectUserContextProfile } from '@/lib/user-context';

type Props = {
  domainSlug: ProfileMirrorDomainSlug;
  onCancel: () => void;
  onSuccess: () => void;
};

export function DomainMutationEditor({ domainSlug, onCancel, onSuccess }: Props) {
  const { t, userContext, submitMutation, profileHeadRevision, refreshSessionState, sessionId } =
    useApp();
  const profile = selectUserContextProfile(userContext);
  const profileReady = profile != null;
  const section = getDomainEditSection(domainSlug);
  const sectionTitle = t(section.titleKey);
  const sectionSummary = t(section.summaryKey);

  const initialDraft = useMemo(
    () => buildInitialDraft(section, profile ?? undefined),
    [section, profile]
  );

  const [draft, setDraft] = useState<DomainDraftValues>(initialDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync draft when the authoritative profile revision changes (or first becomes available).
  // Do not depend on profile object identity — that can reset mid-edit and drop field values.
  // E14: wait until profile is ready so boolean drafts are not stuck on unchecked defaults.
  const profileSyncKey = profileReady ? String(profileHeadRevision) : 'pending';
  useEffect(() => {
    if (!profileReady) {
      return;
    }
    setDraft(buildInitialDraft(section, profile));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: sync on revision/slug/ready only
  }, [section.slug, profileSyncKey, profileReady]);

  const handleFieldChange = (formKey: string, value: string | boolean | number | undefined) => {
    setDraft((current) => ({ ...current, [formKey]: value }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profileReady) {
      setError(t('profile.saveError'));
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const requests = buildDomainCorrectionRequests(
        section,
        draft,
        profile ?? undefined,
        profileHeadRevision
      );

      await submitDomainCorrectionRequests({
        requests,
        profileHeadRevision,
        submitMutation,
      });

      if (section.slug === 'language-display' && sessionId) {
        const language = draft.preferredLanguage;
        if (typeof language === 'string' && isSupportedLanguage(language)) {
          await updateSessionLanguage(sessionId, language);
        }
        const theme = draft.theme;
        if (typeof theme === 'string' && isThemePreference(theme)) {
          await updateSessionTheme(sessionId, theme);
        }
      }

      await refreshSessionState();
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-ui-surface="profile-correction" data-profile-ready={profileReady ? 'true' : 'false'}>
      <PageHeader
        eyebrow={t('profile.eyebrow')}
        leading={
          <Link href={`/profile/${domainSlug}`}>
            {t('profile.backTo').replace('{title}', sectionTitle)}
          </Link>
        }
        title={t('profile.correctInformation')}
        description={sectionSummary}
      />

      <LegacyFormNode onSubmit={handleSave}>
        <p className="text-meta mb-md">{t('profile.helper')}</p>

        {!profileReady ? (
          <p className="text-meta mb-md" role="status" data-profile-loading>
            {t('profile.loading')}
          </p>
        ) : null}

        {section.fields.map((field) => (
          <DomainFieldRenderer
            key={field.formKey}
            field={field}
            value={draft[field.formKey]}
            onChange={handleFieldChange}
            disabled={saving || !profileReady}
          />
        ))}

        {error && (
          <p role="alert" className="text-meta text-danger">
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !profileReady}
            data-profile-save
          >
            {saving ? t('profile.saving') : t('profile.save')}
          </button>
          <AtlasSecondaryButton disabled={saving} onClick={onCancel}>
            {t('common.cancel')}
          </AtlasSecondaryButton>
        </div>
      </LegacyFormNode>
    </div>
  );
}
