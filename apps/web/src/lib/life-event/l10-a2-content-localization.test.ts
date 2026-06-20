import { describe, expect, it } from 'vitest';
import { getTranslations } from '@arrival-atlas/core';
import { buildLifeEventPlan, CLASSIFIER_FIXTURES } from '@arrival-atlas/modules/life-event';
import {
  createLifeEventSchemaLabelResolver,
  lifeEventModuleDescription,
  lifeEventModuleTitle,
  lifeEventNodeDescription,
  lifeEventNodeTitle,
} from '@/lib/life-event/content-labels';

function localeT(language: 'en' | 'de' | 'ru' | 'ua') {
  const bundle = getTranslations(language);
  return (key: string) => bundle[key] ?? key;
}

describe('L10-A2 life event content localization', () => {
  it('localizes g1-complete-anmeldung node title and description', () => {
    const t = localeT('de');
    const node = {
      id: 'g1-complete-anmeldung',
      title: 'Complete Anmeldung',
      description: 'Book a Bürgeramt appointment and register your address within the legal deadline.',
    };

    expect(lifeEventNodeTitle(t, node)).toBe('Anmeldung abschließen');
    expect(lifeEventNodeDescription(t, node)).toBe(
      'Buchen Sie einen Termin beim Bürgeramt und melden Sie Ihre Adresse innerhalb der gesetzlichen Frist an.'
    );
  });

  it('falls back to planner text when translation is missing', () => {
    const t = (key: string) => key;
    const node = {
      id: 'unknown-node-id',
      title: 'Planner-owned title',
      description: 'Planner-owned description',
    };

    expect(lifeEventNodeTitle(t, node)).toBe('Planner-owned title');
    expect(lifeEventNodeDescription(t, node)).toBe('Planner-owned description');
  });

  it('localizes scenario explorer schema labels', () => {
    const t = localeT('de');
    const resolver = createLifeEventSchemaLabelResolver(t);

    expect(resolver.fieldLabel({ name: 'event', type: 'string' }, 'event')).toBe('Ereignis');
    expect(resolver.enumLabel({ name: 'event', type: 'string' }, 'event', 'arrival')).toBe('Ankunft');
    expect(resolver.fieldLabel({ name: 'hasPartner', type: 'boolean' }, 'hasPartner')).toBe('Partner');
    expect(resolver.fieldLabel({ name: 'hasChildren', type: 'boolean' }, 'hasChildren')).toBe('Kinder');
    expect(
      resolver.fieldLabel({ name: 'employed', type: 'boolean' }, 'currentStatus.employed')
    ).toBe('Beschäftigt');
  });

  it('localizes module title and description', () => {
    const t = localeT('ru');
    expect(
      lifeEventModuleTitle(t, 'Life Event Module')
    ).toBe('Модуль жизненных событий');
    expect(
      lifeEventModuleDescription(
        t,
        'Scenario-based guidance and action plans for major life changes in Germany'
      )
    ).toBe('Сценарная помощь и планы действий при важных жизненных изменениях в Германии');
  });

  it('does not modify LifeEventPlanV1 planner output', () => {
    const fixture = CLASSIFIER_FIXTURES[0]!;
    const plan = buildLifeEventPlan({
      userContext: fixture.userContext,
      generatedAt: '2026-06-20T12:00:00.000Z',
    });

    expect(plan.currentFocus.title).toBeTruthy();
    expect(plan.reasoning.whyThisNow.length).toBeGreaterThan(0);
    expect(plan.currentFocus.title).toMatch(/[A-Za-z]/);
    expect(plan.reasoning).toEqual(
      buildLifeEventPlan({
        userContext: fixture.userContext,
        generatedAt: '2026-06-20T12:00:00.000Z',
      }).reasoning
    );
  });
});
