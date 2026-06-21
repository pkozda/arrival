import { describe, expect, it } from 'vitest';
import { buildMutationRequestsFromModuleExecution } from '../src/module/build-mutation-requests-from-module.js';

describe('buildMutationRequestsFromModuleExecution — life-event', () => {
  it('maps scenario explorer input to persistent profile facts', () => {
    const requests = buildMutationRequestsFromModuleExecution({
      moduleId: 'life-event',
      executionId: 'exec-1',
      input: {
        event: 'arrival',
        currentStatus: { employed: false, insured: false, registered: false },
        hasPartner: false,
        hasChildren: false,
      },
      existingFieldIds: new Set(),
      preferredLanguage: 'ru',
    });

    expect(requests.some((request) => request.domain === 'migration')).toBe(true);
    expect(requests.some((request) => request.domain === 'employment')).toBe(true);
    expect(requests.some((request) => request.domain === 'healthInsurance')).toBe(true);
    expect(requests.some((request) => request.type === 'pref.update')).toBe(true);
  });
});
