import { describe, expect, it } from 'vitest';
import type { PublicModuleContract, UserProfileViewV1 } from '@/lib/product-contract';
import {
  buildProfileMirrorDomains,
  buildProfileMirrorHeadline,
  findProfileMirrorDomain,
  formatDomainStatus,
} from './profile-mirror-utils';
import { makeSnapshot } from './test-fixtures/ui-snapshot.js';

function makeModule(id: string, title: string): PublicModuleContract {
  return {
    id,
    title,
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
  };
}

function makeProfile(overrides: Partial<UserProfileViewV1['domains']> = {}): UserProfileViewV1 {
  return {
    schemaVersion: '1.0.0',
    preferences: { preferredLanguage: 'en' },
    completeness: { score: 0, missingDomains: [] },
    domains: overrides,
  };
}

describe('buildProfileMirrorHeadline', () => {
  it('returns empty guidance when profile has no situation data', () => {
    expect(buildProfileMirrorHeadline(null, 'en')).toContain('Nothing saved yet');
  });

  it('returns human-readable headline', () => {
    expect(
      buildProfileMirrorHeadline(
        makeProfile({
          housing: { city: 'Berlin' },
          employment: { employmentStatus: 'employed' },
          household: { householdSize: 2 },
        }),
        'en'
      )
    ).toBe('Berlin · Employed · Household of 2');
  });
});

describe('buildProfileMirrorDomains', () => {
  const modules = [
    makeModule('financial-reality', 'Financial Reality'),
    makeModule('healthcare-navigation', 'Healthcare Navigation'),
  ];

  it('builds seven read-only domain sections', () => {
    const domains = buildProfileMirrorDomains(makeSnapshot(), modules, null);
    expect(domains).toHaveLength(7);
    expect(domains.map((domain) => domain.title)).toContain('Where you live');
  });

  it('formats work and income without exposing schema keys', () => {
    const domain = findProfileMirrorDomain(
      makeSnapshot({
        executionsByModuleId: {
          'financial-reality': [
            {
              executionId: 'e1',
              moduleId: 'financial-reality',
              createdAt: '2026-06-01T12:00:00.000Z',
              projection: { title: 'Financial Reality', status: 'success' } as never,
            },
          ],
        },
      }),
      modules,
      'work-income',
      makeProfile({
        employment: { employmentStatus: 'employed' },
        income: { grossMonthlyIncome: 2500 },
      })
    );

    expect(domain?.fields.some((field) => field.label === 'Employment')).toBe(true);
    expect(domain?.fields.some((field) => field.label === 'grossMonthlyIncome')).toBe(false);
    expect(domain?.provenanceModuleTitle).toBe('Financial Reality');
  });

  it('includes module CTA title for empty domains', () => {
    const domain = findProfileMirrorDomain(makeSnapshot(), modules, 'health-insurance', null);
    expect(domain?.status).toBe('not_added');
    expect(domain?.ctaModuleId).toBe('healthcare-navigation');
  });
});

describe('formatDomainStatus', () => {
  it('maps status to user-facing labels', () => {
    expect(formatDomainStatus('complete')).toBe('Complete');
    expect(formatDomainStatus('needs_attention')).toBe('Needs attention');
    expect(formatDomainStatus('not_added')).toBe('Not added yet');
  });
});
