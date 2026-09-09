import { describe, expect, it } from 'vitest';
import { t } from '@arrival-atlas/core';

describe('E12 Life Events localization integrity', () => {
  it('12 — EN/DE/RU/UA keys for blockers and banking honesty', () => {
    for (const lang of ['en', 'de', 'ru', 'ua'] as const) {
      expect(t('life-event.reasoning.blocker.waiting', lang)).not.toMatch(/^life-event\./);
      expect(t('life-event.inspector.noDirectConstraints', lang)).not.toMatch(/^life-event\./);
      expect(t('life-event.reasoning.secondary.banking_not_established', lang)).toMatch(
        /Atlas|Bank|Konto|счет|рахунок|не /i
      );
      expect(t('life-event.registration.inspector.blockedReason', lang).length).toBeGreaterThan(10);
    }
  });

  it('UA banking secondary does not equal RU', () => {
    expect(t('life-event.reasoning.secondary.banking_not_established', 'ua')).not.toBe(
      t('life-event.reasoning.secondary.banking_not_established', 'ru')
    );
    expect(t('life-event.inspector.noDirectConstraints', 'ua')).not.toBe(
      t('life-event.inspector.noDirectConstraints', 'ru')
    );
  });
});
