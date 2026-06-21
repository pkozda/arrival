'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ECONOMIC_REALITY_MODULE_NAV } from '@/app-shell/navigation/modules';
import { shouldShowEconomicRealitySurface } from '@/app-shell/navigation/visibility';
import { useEconomicCopy, useEconomicRealityPlan } from '@/lib/economic-reality';

type Props = {
  onNavigate: () => void;
};

export function EconomicRealityNavLink({ onNavigate }: Props) {
  const pathname = usePathname();
  const copy = useEconomicCopy();
  const state = useEconomicRealityPlan();
  const visible = shouldShowEconomicRealitySurface({
    evaluation: state.evaluation,
    presentation: state.presentation,
    actionSet: state.actionSet,
  });

  if (!visible) {
    return null;
  }

  const active = pathname === ECONOMIC_REALITY_MODULE_NAV.route;
  const badge =
    ECONOMIC_REALITY_MODULE_NAV.badgeSource === 'primaryHighlight' &&
    state.presentation?.primaryHighlight.labelKey
      ? copy(state.presentation.primaryHighlight.labelKey)
      : null;

  return (
    <li>
      <Link
        href={ECONOMIC_REALITY_MODULE_NAV.route}
        className={`header-nav-link${active ? ' header-nav-link--active' : ''}`}
        onClick={onNavigate}
      >
        <span className="header-nav-icon">€</span>
        <span>{copy(ECONOMIC_REALITY_MODULE_NAV.labelKey)}</span>
        {badge && (
          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {badge}
          </span>
        )}
      </Link>
    </li>
  );
}
