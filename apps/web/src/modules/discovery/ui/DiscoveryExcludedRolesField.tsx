'use client';

import { useState, type KeyboardEvent } from 'react';
import { useApp } from '@/components/AppProvider';
import { appendExcludedRole, removeExcludedRole } from '@/lib/discovery';

type Props = {
  roles: string[];
  onChange: (roles: string[]) => void;
  idPrefix?: string;
};

/**
 * Lightweight excluded-role editor for Jobs profiles.
 * Persists as criteria.excluded[] entries with key "role".
 */
export function DiscoveryExcludedRolesField({
  roles,
  onChange,
  idPrefix = 'discovery-excluded-roles',
}: Props) {
  const { t } = useApp();
  const [draft, setDraft] = useState('');
  const inputId = `${idPrefix}-input`;

  const commitDraft = () => {
    const next = appendExcludedRole(roles, draft);
    onChange(next);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitDraft();
    }
  };

  return (
    <div className="discovery-excluded-roles" data-ui-surface="discovery-excluded-roles">
      <label htmlFor={inputId} className="discovery-excluded-roles__label">
        {t('discovery.criteria.excludedRoles.label')}
        <span className="text-body text-body--muted discovery-excluded-roles__hint">
          {t('discovery.criteria.excludedRoles.description')}
        </span>
      </label>

      {roles.length === 0 ? (
        <p className="discovery-empty discovery-excluded-roles__empty">
          {t('discovery.criteria.excludedRoles.empty')}
        </p>
      ) : (
        <ul className="discovery-excluded-roles__list">
          {roles.map((role) => (
            <li key={role} className="discovery-excluded-roles__chip">
              <span>{role}</span>
              <button
                type="button"
                className="discovery-excluded-roles__remove"
                aria-label={`${t('discovery.criteria.excludedRoles.remove')} ${role}`}
                onClick={() => onChange(removeExcludedRole(roles, role))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="discovery-excluded-roles__add">
        <input
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('discovery.criteria.excludedRoles.placeholder')}
          autoComplete="off"
        />
        <button type="button" className="btn btn-secondary" onClick={commitDraft}>
          {t('discovery.criteria.excludedRoles.add')}
        </button>
      </div>
    </div>
  );
}
