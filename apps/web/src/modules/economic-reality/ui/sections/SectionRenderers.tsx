'use client';

import type { EconomicUiSectionProjection } from '@/lib/economic-reality';
import { useEconomicCopy } from '@/lib/economic-reality';
import {
  ActionCardView,
  IntentCardView,
  ProfileCardView,
  ResourceCardView,
} from '../components/ActionRenderer';

type Props = {
  section: EconomicUiSectionProjection;
};

function renderCard(section: EconomicUiSectionProjection, index: number) {
  const entry = section.cards[index];
  if (!entry) {
    return null;
  }

  switch (entry.component) {
    case 'ActionCard':
      return <ActionCardView key={entry.card.cardId} card={entry.card} />;
    case 'IntentCard':
      return <IntentCardView key={entry.card.cardId} card={entry.card} />;
    case 'ResourceCard':
      return <ResourceCardView key={entry.card.cardId} card={entry.card} />;
    case 'ProfileCard':
      return <ProfileCardView key={entry.card.cardId} card={entry.card} />;
    default:
      return null;
  }
}

function SectionHeading({ titleKey }: { titleKey: string }) {
  const copy = useEconomicCopy();
  return <>{copy(titleKey)}</>;
}

export function PrimarySection({ section }: Props) {
  return (
    <section data-ui-panel="MainActionPanel" aria-labelledby={`${section.section.sectionId}-title`}>
      <h2 id={`${section.section.sectionId}-title`} className="text-section-title">
        <SectionHeading titleKey={section.section.titleKey} />
      </h2>
      <div style={{ marginTop: '0.75rem' }}>
        {section.cards.map((_, index) => renderCard(section, index))}
      </div>
    </section>
  );
}

export function SecondarySection({ section }: Props) {
  return (
    <section data-ui-panel="SupportPanel" aria-labelledby={`${section.section.sectionId}-title`}>
      <h2 id={`${section.section.sectionId}-title`} className="text-section-title">
        <SectionHeading titleKey={section.section.titleKey} />
      </h2>
      <div style={{ marginTop: '0.75rem' }}>
        {section.cards.map((_, index) => renderCard(section, index))}
      </div>
    </section>
  );
}

export function SystemSection({ section }: Props) {
  return (
    <section data-ui-panel="SystemPanel" aria-labelledby={`${section.section.sectionId}-title`}>
      <h2 id={`${section.section.sectionId}-title`} className="text-section-title">
        <SectionHeading titleKey={section.section.titleKey} />
      </h2>
      <div style={{ marginTop: '0.75rem' }}>
        {section.cards.map((_, index) => renderCard(section, index))}
      </div>
    </section>
  );
}
