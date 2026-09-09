import { describe, expect, it } from 'vitest';
import { buildDomainCorrectionRequests } from '@/lib/profile-correction/mutation-request-builder.js';
import { buildInitialDraft, getDomainEditSection } from '@/lib/profile-correction/domain-field-definitions.js';
import type { UserProfileViewV1 } from '@/lib/product-contract';

/**
 * E14 — Profile editor hydration / boolean revoke integrity.
 */
describe('E14 profile editor hydration gate', () => {
  it('boolean revoke emits fact.correct false when profile fact is known true', () => {
    const section = getDomainEditSection('benefits-support');
    const profile = {
      schemaVersion: '1.0.0',
      preferences: {},
      completeness: { score: 40, missingDomains: [] },
      domains: {
        benefits: { receivingWohngeld: true },
      },
    } as UserProfileViewV1;

    const draft = buildInitialDraft(section, profile);
    expect(draft.receivingWohngeld).toBe(true);
    draft.receivingWohngeld = false;
    const requests = buildDomainCorrectionRequests(section, draft, profile, 3);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.type).toBe('fact.correct');
    expect(requests[0]?.payload).toMatchObject({
      fields: { receivingWohngeld: false },
    });
  });

  it('unchecked defaults without profile fact do not invent a correction', () => {
    const section = getDomainEditSection('benefits-support');
    const profile = {
      schemaVersion: '1.0.0',
      preferences: {},
      completeness: { score: 10, missingDomains: [] },
      domains: {},
    } as UserProfileViewV1;

    const draft = buildInitialDraft(section, profile);
    expect(draft.receivingWohngeld).toBe(false);
    const requests = buildDomainCorrectionRequests(section, draft, profile, 1);
    expect(requests).toHaveLength(0);
  });
});
