'use client';

import { AtlasSecondaryButton } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import type { DiscoveryPersistenceScope } from '@/lib/discovery';

type Props = {
  scope: DiscoveryPersistenceScope | null;
  claiming?: boolean;
  claimError?: string | null;
  claimSuccess?: boolean;
  onClaimAccount?: () => void;
};

/**
 * PD-006/PD-011: honest persistence + optional account continuity CTA.
 */
export function DiscoveryPersistenceDisclosure({
  scope,
  claiming = false,
  claimError = null,
  claimSuccess = false,
  onClaimAccount,
}: Props) {
  const { t } = useApp();
  if (!scope) {
    return null;
  }

  const sessionScoped = scope === 'session';

  return (
    <section
      className="discovery-persistence-disclosure"
      data-ui-surface="discovery-persistence-disclosure"
      data-persistence-scope={scope}
      aria-label={t('discovery.continuity.title')}
    >
      <p className="text-meta" role="status" data-ui-surface="discovery-ownership-status">
        {sessionScoped
          ? t('discovery.persistence.session')
          : t('discovery.persistence.account')}
      </p>

      {sessionScoped ? (
        <div className="discovery-continuity" data-ui-surface="discovery-continuity">
          <p className="text-body text-body--muted">
            {t('discovery.continuity.sessionExplain')}
          </p>
          {onClaimAccount ? (
            <div className="discovery-actions" style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={claiming}
                data-ui-surface="discovery-continuity-claim"
                aria-busy={claiming || undefined}
                onClick={() => onClaimAccount()}
              >
                {claiming
                  ? t('discovery.continuity.claiming')
                  : t('discovery.continuity.claim')}
              </button>
            </div>
          ) : (
            <p
              className="text-body text-body--muted"
              data-ui-surface="discovery-continuity-unavailable"
            >
              {t('discovery.continuity.unavailable')}
            </p>
          )}
          {claimError ? (
            <p
              className="text-body"
              role="alert"
              data-ui-surface="discovery-continuity-error"
            >
              {claimError}
              {onClaimAccount ? (
                <>
                  {' '}
                  <AtlasSecondaryButton
                    type="button"
                    disabled={claiming}
                    onClick={() => onClaimAccount()}
                  >
                    {t('discovery.continuity.retry')}
                  </AtlasSecondaryButton>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="discovery-continuity" data-ui-surface="discovery-continuity-account">
          <p className="text-body text-body--muted" role="status">
            {claimSuccess
              ? t('discovery.continuity.claimSuccess')
              : t('discovery.continuity.accountExplain')}
          </p>
        </div>
      )}
    </section>
  );
}
