import { describe, expect, it } from 'vitest';
import type { PublicModuleContract } from '@/lib/product-contract';
import {
  DEFAULT_MODULE_CATEGORY,
  capabilityVisibilityFromContract,
  groupModulesByCategory,
  resolveModuleCategory,
} from './module-catalog-utils';

function makeModule(
  overrides: Partial<PublicModuleContract> & Pick<PublicModuleContract, 'id' | 'title'>
): PublicModuleContract {
  return {
    description: '',
    version: '1.0.0',
    status: 'available',
    capabilities: {
      supports: {
        recommendations: true,
        actions: true,
        explanation: true,
        riskModel: false,
      },
    },
    metadata: {},
    ...overrides,
  };
}

describe('resolveModuleCategory', () => {
  it('defaults missing category to General', () => {
    expect(resolveModuleCategory(makeModule({ id: 'a', title: 'A' }))).toBe(DEFAULT_MODULE_CATEGORY);
  });

  it('preserves contract category values', () => {
    expect(
      resolveModuleCategory(
        makeModule({ id: 'a', title: 'A', metadata: { category: 'healthcare' } })
      )
    ).toBe('healthcare');
  });
});

describe('groupModulesByCategory', () => {
  it('groups available modules and sorts categories and titles', () => {
    const grouped = groupModulesByCategory([
      makeModule({ id: 'b', title: 'Beta', metadata: { category: 'finance' } }),
      makeModule({ id: 'a', title: 'Alpha', metadata: { category: 'finance' } }),
      makeModule({ id: 'c', title: 'Care', metadata: { category: 'healthcare' } }),
      makeModule({ id: 'd', title: 'Disabled', status: 'disabled' }),
    ]);

    expect(grouped.map((entry) => entry.category)).toEqual(['finance', 'healthcare']);
    expect(grouped[0]?.modules.map((module) => module.id)).toEqual(['a', 'b']);
  });
});

describe('capabilityVisibilityFromContract', () => {
  it('maps contract capability flags directly', () => {
    expect(
      capabilityVisibilityFromContract(
        makeModule({
          id: 'a',
          title: 'A',
          capabilities: {
            supports: {
              recommendations: false,
              actions: true,
              explanation: false,
              riskModel: true,
            },
          },
        })
      )
    ).toEqual({
      showRecommendations: false,
      showActions: true,
      showExplanation: false,
      showRiskModel: true,
    });
  });
});
