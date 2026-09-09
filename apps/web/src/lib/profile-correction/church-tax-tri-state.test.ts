import { describe, expect, it } from 'vitest';
import type { UserProfileViewV1 } from '@/lib/product-contract';
import { buildDomainCorrectionRequests } from './mutation-request-builder.js';
import {
  buildInitialDraft,
  getDomainEditSection,
  normalizeDraftFieldValue,
  readDraftValueFromProfile,
} from './domain-field-definitions.js';
import { buildTaxAdministrationViewModel } from '../finance/build-tax-administration-view-model';

const section = getDomainEditSection('work-income');
const churchTaxField = section.fields.find((field) => field.formKey === 'churchTax')!;

function profileWith(
  employment: Record<string, unknown> = {},
  income: Record<string, unknown> = {}
): UserProfileViewV1 {
  return {
    schemaVersion: '1.0.0',
    preferences: {},
    completeness: { score: 0, missingDomains: [] },
    domains: {
      employment: { ...employment },
      income: { ...income },
    },
  } as UserProfileViewV1;
}

describe('churchTax tri-state semantic hardening', () => {
  it('1 — undefined initializes as unknown (not false)', () => {
    const draft = buildInitialDraft(section, profileWith());
    expect(draft.churchTax).toBe('');
    expect(draft.churchTax).not.toBe(false);
    expect(normalizeDraftFieldValue(churchTaxField, draft.churchTax)).toBeUndefined();
  });

  it('2 — true initializes as yes', () => {
    const draft = buildInitialDraft(section, profileWith({ churchTax: true }));
    expect(draft.churchTax).toBe('true');
    expect(normalizeDraftFieldValue(churchTaxField, draft.churchTax)).toBe(true);
  });

  it('3 — false initializes as no', () => {
    const draft = buildInitialDraft(section, profileWith({ churchTax: false }));
    expect(draft.churchTax).toBe('false');
    expect(normalizeDraftFieldValue(churchTaxField, draft.churchTax)).toBe(false);
  });

  it('4 — unrelated save preserves undefined', () => {
    const profile = profileWith({ employmentStatus: 'employed' }, { grossMonthlyIncome: 2000 });
    const draft = buildInitialDraft(section, profile);
    draft.grossMonthlyIncome = 2200;
    expect(normalizeDraftFieldValue(churchTaxField, draft.churchTax)).toBeUndefined();

    const requests = buildDomainCorrectionRequests(section, draft, profile, 1);
    const employment = requests.find((request) => request.domain === 'employment');
    const fields =
      employment?.payload && 'fields' in employment.payload
        ? (employment.payload.fields as Record<string, unknown>)
        : {};
    expect(fields).not.toHaveProperty('churchTax');
    expect(requests.some((request) => request.domain === 'income')).toBe(true);
  });

  it('5 — explicit undefined → true', () => {
    const profile = profileWith();
    const draft = buildInitialDraft(section, profile);
    draft.churchTax = 'true';
    const requests = buildDomainCorrectionRequests(section, draft, profile, 1);
    const employment = requests.find((request) => request.domain === 'employment');
    expect(employment?.payload).toMatchObject({
      fields: { churchTax: true },
    });
  });

  it('6 — explicit undefined → false', () => {
    const profile = profileWith();
    const draft = buildInitialDraft(section, profile);
    draft.churchTax = 'false';
    const requests = buildDomainCorrectionRequests(section, draft, profile, 1);
    expect(requests.find((request) => request.domain === 'employment')?.payload).toMatchObject({
      fields: { churchTax: false },
    });
  });

  it('7 — explicit true → false', () => {
    const profile = profileWith({ churchTax: true });
    const draft = buildInitialDraft(section, profile);
    draft.churchTax = 'false';
    const requests = buildDomainCorrectionRequests(section, draft, profile, 2);
    expect(requests.find((request) => request.domain === 'employment')?.payload).toMatchObject({
      fields: { churchTax: false },
    });
  });

  it('8 — explicit false → true', () => {
    const profile = profileWith({ churchTax: false });
    const draft = buildInitialDraft(section, profile);
    draft.churchTax = 'true';
    const requests = buildDomainCorrectionRequests(section, draft, profile, 2);
    expect(requests.find((request) => request.domain === 'employment')?.payload).toMatchObject({
      fields: { churchTax: true },
    });
  });

  it('9 — Tax Admin READY with known taxClass for true/false/undefined churchTax', () => {
    for (const churchTax of [undefined, true, false] as const) {
      const employment =
        churchTax === undefined ? { taxClass: 3 as const } : { taxClass: 3 as const, churchTax };
      const vm = buildTaxAdministrationViewModel(profileWith(employment));
      expect(vm.state).toBe('READY');
    }
  });

  it('10 — taxClass undefined remains INCOMPLETE even if churchTax known', () => {
    const vm = buildTaxAdministrationViewModel(profileWith({ churchTax: true }));
    expect(vm.state).toBe('INCOMPLETE');
  });

  it('readDraftValueFromProfile maps boolean churchTax to select strings', () => {
    expect(
      readDraftValueFromProfile('churchTax', 'employment', profileWith({ churchTax: true }))
    ).toBe('true');
    expect(
      readDraftValueFromProfile('churchTax', 'employment', profileWith({ churchTax: false }))
    ).toBe('false');
    expect(readDraftValueFromProfile('churchTax', 'employment', profileWith())).toBeUndefined();
  });

  it('saving unchanged true/false does not re-emit churchTax', () => {
    for (const churchTax of [true, false] as const) {
      const profile = profileWith({ churchTax, taxClass: 1 });
      const draft = buildInitialDraft(section, profile);
      const requests = buildDomainCorrectionRequests(section, draft, profile, 1);
      expect(requests).toHaveLength(0);
    }
  });

  it('churchTax field is select tri-state, not boolean checkbox', () => {
    expect(churchTaxField.type).toBe('select');
    expect(churchTaxField.options?.map((option) => option.value)).toEqual(['true', 'false']);
    expect(churchTaxField.placeholderKey).toBe('profile.options.churchTax.unspecified');
  });
});
