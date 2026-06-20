import { describe, expect, it } from 'vitest';
import {
  MUTATION_TYPES,
  PROFILE_DOMAINS,
  PERSISTENT_FACT_FIELD_IDS,
  SCENARIO_FIELD_IDS,
  MutationRequestSchema,
  MutationEventSchema,
  ProfileRevisionSchema,
  UserProfileViewV1Schema,
  validatePersistentPayloadFields,
  isScenarioFieldId,
  isPersistentFactFieldId,
  getFieldsForDomain,
} from './index.js';

describe('profile mutation contract', () => {
  it('exposes canonical domain registry', () => {
    expect(PROFILE_DOMAINS).toEqual([
      'migration',
      'housing',
      'household',
      'employment',
      'income',
      'healthInsurance',
      'benefits',
      'preferences',
    ]);
  });

  it('exposes typed mutation type union', () => {
    expect(MUTATION_TYPES).toContain('fact.correct');
    expect(MUTATION_TYPES).toContain('pref.update');
    expect(MUTATION_TYPES).toHaveLength(7);
  });

  it('separates persistent and scenario field identifiers', () => {
    for (const scenarioId of SCENARIO_FIELD_IDS) {
      expect(isScenarioFieldId(scenarioId)).toBe(true);
      expect(isPersistentFactFieldId(scenarioId)).toBe(false);
    }

    for (const fieldId of PERSISTENT_FACT_FIELD_IDS) {
      expect(isPersistentFactFieldId(fieldId)).toBe(true);
      expect(isScenarioFieldId(fieldId)).toBe(false);
    }
  });

  it('maps fields to domains in registry', () => {
    const incomeFields = getFieldsForDomain('income');
    expect(incomeFields.map((field) => field.id)).toEqual(['grossMonthlyIncome']);
    expect(incomeFields[0]?.confirmationRequired).toBe(true);
  });

  it('parses MutationRequest with typed domain payload', () => {
    const parsed = MutationRequestSchema.parse({
      id: 'req_1',
      requestId: 'req_1',
      timestamp: '2026-06-19T12:00:00.000Z',
      type: 'fact.correct',
      intent: 'correction',
      domain: 'housing',
      source: { kind: 'profile_ui', domain: 'housing' },
      payload: {
        kind: 'domain_facts',
        domain: 'housing',
        fields: { monthlyColdRent: 850 },
      },
      confidence: 1,
      userConfirmationRequired: true,
      expectedHeadRevision: 3,
    });

    expect(parsed.payload.kind).toBe('domain_facts');
    if (parsed.payload.kind === 'domain_facts' && parsed.payload.domain === 'housing') {
      expect(parsed.payload.fields.monthlyColdRent).toBe(850);
    }
  });

  it('rejects scenario fields in persistent payload validation', () => {
    const result = validatePersistentPayloadFields({
      kind: 'domain_facts',
      domain: 'income',
      fields: { proposedGrossIncome: 4000 } as never,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('SCENARIO_FIELD_IN_PAYLOAD');
    }
  });

  it('parses MutationEvent append-only shape', () => {
    const parsed = MutationEventSchema.parse({
      eventId: 'evt_1',
      mutationId: 'req_1',
      profileId: 'prof_1',
      sequence: 1,
      revision: 1,
      timestamp: '2026-06-19T12:00:00.000Z',
      committedAt: '2026-06-19T12:00:01.000Z',
      type: 'fact.update',
      intent: 'capture',
      domain: 'income',
      payload: {
        kind: 'domain_facts',
        domain: 'income',
        fields: { grossMonthlyIncome: 3200 },
      },
      fieldDeltas: [
        {
          fieldId: 'grossMonthlyIncome',
          before: null,
          after: 3200,
          operation: 'set',
        },
      ],
      source: { kind: 'module', moduleId: 'financial-reality', executionId: 'exec_1' },
      confidence: 1,
      reason: 'Updated when you used Financial Reality',
    });

    expect(parsed.fieldDeltas).toHaveLength(1);
  });

  it('parses ProfileRevision field-level audit metadata', () => {
    const parsed = ProfileRevisionSchema.parse({
      id: 'rev_1',
      profileId: 'prof_1',
      revision: 2,
      mutationId: 'req_2',
      eventId: 'evt_2',
      domain: 'housing',
      mutationType: 'fact.correct',
      changes: [{ fieldId: 'monthlyColdRent', before: 800, after: 850 }],
      source: { kind: 'profile_ui', domain: 'housing' },
      reason: 'You updated this in Your situation',
      timestamp: '2026-06-19T12:05:00.000Z',
    });

    expect(parsed.changes[0]?.fieldId).toBe('monthlyColdRent');
  });

  it('parses UserProfileViewV1 without internal structures', () => {
    const parsed = UserProfileViewV1Schema.parse({
      schemaVersion: '1.0.0',
      preferences: { preferredLanguage: 'en', theme: 'light' },
      completeness: { score: 40, missingDomains: ['benefits', 'healthInsurance'] },
      domains: {
        housing: { city: 'Berlin', monthlyColdRent: 850 },
        employment: { employmentStatus: 'employed' },
      },
    });

    expect(parsed.domains.housing?.city).toBe('Berlin');
    expect(parsed.completeness.missingDomains).toContain('benefits');
  });
});
