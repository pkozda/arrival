'use client';

import { AtlasLink as Link } from '@/components/atlas-runtime';
import type { ActionCard, MissingContextHint } from '@/lib/product-contract';
import type { ModuleSuggestion, SituationSummary } from '@/lib/situation-utils';
import { useApp } from '@/components/AppProvider';

type SignalKind = 'profile' | 'hint' | 'action' | 'suggestion' | 'activity' | 'explore';

type Signal = {
  id: string;
  kind: SignalKind;
  text: string;
  href?: string;
};

type Props = {
  situationSummary: SituationSummary | null;
  hints: MissingContextHint[];
  priorityActions: ActionCard[];
  suggestions: ModuleSuggestion[];
  recentResultsCount: number;
  showBrowseLink: boolean;
};

function formatCountTemplate(template: string, count: number): string {
  return template.replace('{count}', String(count));
}

export function HomeSystemSignals({
  situationSummary,
  hints,
  priorityActions,
  suggestions,
  recentResultsCount,
  showBrowseLink,
}: Props) {
  const { t } = useApp();

  const signals: Signal[] = [];

  if (situationSummary && situationSummary.needsAttentionCount > 0) {
    const template =
      situationSummary.needsAttentionCount === 1
        ? t('life-event.home.situationNeedAttention')
        : t('life-event.home.situationNeedsAttention');
    signals.push({
      id: 'profile-attention',
      kind: 'profile',
      text: formatCountTemplate(template, situationSummary.needsAttentionCount),
      href: '/profile',
    });
  }

  for (const hint of hints.slice(0, 2)) {
    signals.push({
      id: `hint-${hint.domain}-${hint.mirrorSlug}`,
      kind: 'hint',
      text: hint.message,
      href: hint.href,
    });
  }

  for (const action of priorityActions.slice(0, 1)) {
    signals.push({
      id: `action-${action.actionId}`,
      kind: 'action',
      text: action.label,
    });
  }

  for (const suggestion of suggestions.slice(0, 1)) {
    signals.push({
      id: `suggestion-${suggestion.module.id}`,
      kind: 'suggestion',
      text: suggestion.reason,
      href: suggestion.href ?? `/modules/${suggestion.module.id}`,
    });
  }

  if (recentResultsCount > 0) {
    signals.push({
      id: 'recent-results',
      kind: 'activity',
      text: formatCountTemplate(t('life-event.home.signals.recentActivity'), recentResultsCount),
    });
  }

  if (showBrowseLink) {
    signals.push({
      id: 'browse-topics',
      kind: 'explore',
      text: t('life-event.home.signals.exploreTopics'),
      href: '#home-explore-topics',
    });
  }

  if (signals.length === 0) {
    return null;
  }

  return (
    <footer className="home-system-signals" data-home-layer="signals" aria-label="System awareness">
      <ul className="home-system-signals__hud">
        {signals.map((signal, index) => (
          <li key={signal.id} className="home-system-signals__item">
            <span
              className="home-system-signals__icon"
              data-kind={signal.kind}
              aria-hidden="true"
            />
            {signal.href ? (
              <Link href={signal.href} className="home-system-signals__text">
                {signal.text}
              </Link>
            ) : (
              <span className="home-system-signals__text">{signal.text}</span>
            )}
            {index < signals.length - 1 && (
              <span className="home-system-signals__sep" aria-hidden="true" />
            )}
          </li>
        ))}
      </ul>
    </footer>
  );
}
