import { describe, expect, it } from 'vitest';
import type { EconomicActionV1 } from '@/lib/product-contract';
import {
  resolveExternalResourceHref,
  resolveOpenModuleHref,
  resolveProfileEditHref,
} from './resolve-action-route';

function action(partial: Partial<EconomicActionV1> & Pick<EconomicActionV1, 'type'>): EconomicActionV1 {
  return {
    id: 'test-action',
    sourceNodeId: 'g1-node',
    labelKey: 'ER.ACTION.TEST',
    payload: {},
    constraints: {},
    origin: { graphId: 'G1', nodeId: 'g1-node' },
    ...partial,
  };
}

describe('resolve-action-route', () => {
  it('resolves profile edit href from profileKey', () => {
    const href = resolveProfileEditHref(
      action({
        type: 'update_profile',
        payload: { profileKey: 'work-income' },
      })
    );
    expect(href).toBe('/profile/work-income/edit');
  });

  it('prefers explicit profile href from payload', () => {
    const href = resolveProfileEditHref(
      action({
        type: 'update_profile',
        payload: { profileKey: 'work-income', href: '/profile/work-income/edit' },
      })
    );
    expect(href).toBe('/profile/work-income/edit');
  });

  it('resolves catalog-backed open_module route', () => {
    const href = resolveOpenModuleHref(
      action({
        type: 'open_module',
        payload: {
          moduleId: 'economic-reality',
          entrypoint: 'CRISIS',
          href: '/modules/economic-reality',
        },
      })
    );
    expect(href).toBe('/modules/economic-reality?entry=CRISIS');
  });

  it('resolves external resource href', () => {
    const href = resolveExternalResourceHref(
      action({
        type: 'external_resource',
        payload: { href: '/resources/jobcenter/intake' },
      })
    );
    expect(href).toBe('/resources/jobcenter/intake');
  });
});
