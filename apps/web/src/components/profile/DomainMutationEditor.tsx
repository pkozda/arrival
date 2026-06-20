'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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
  const { userContext, submitMutation, profileHeadRevision, refreshSessionState, sessionId } =
    useApp();
  const profile = selectUserContextProfile(userContext);
  const section = getDomainEditSection(domainSlug);

  const initialDraft = useMemo(
    () => buildInitialDraft(section, profile ?? undefined),
    [section, profile]
  );

  const [draft, setDraft] = useState<DomainDraftValues>(initialDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFieldChange = (formKey: string, value: string | boolean | number | undefined) => {
    setDraft((current) => ({ ...current, [formKey]: value }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
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
      setError(err instanceof Error ? err.message : 'Could not save your changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header style={{ marginBottom: '1.5rem' }}>
        <p style={{ marginBottom: '0.75rem' }}>
          <Link href={`/profile/${domainSlug}`} style={{ fontSize: '0.875rem', color: 'var(--color-accent)' }}>
            ← Back to {section.title}
          </Link>
        </p>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.375rem' }}>
          Correct information
        </h1>
        <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', margin: 0 }}>
          {section.summary}
        </p>
      </header>

      <form onSubmit={handleSave} className="card">
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
          Update what we know about your situation. Changes are saved securely.
        </p>

        {section.fields.map((field) => (
          <DomainFieldRenderer
            key={field.formKey}
            field={field}
            value={draft[field.formKey]}
            onChange={handleFieldChange}
            disabled={saving}
          />
        ))}

        {error && (
          <p role="alert" style={{ color: 'var(--color-danger, #b42318)', fontSize: '0.875rem' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn btn-secondary" disabled={saving} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
