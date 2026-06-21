import type { EconomicActionV1 } from '@/lib/product-contract';
import { resolveModuleFromOpenAction } from '@/app-shell/modules/router';

const PROFILE_KEY_TO_SLUG: Record<string, string> = {
  'where-you-live': 'where-you-live',
  'move-to-germany': 'move-to-germany',
  'work-income': 'work-income',
  'benefits-support': 'benefits-support',
  'health-insurance': 'health-insurance',
};

export function resolveProfileEditHref(action: EconomicActionV1): string | null {
  const href = action.payload.href;
  if (href?.startsWith('/profile/')) {
    return href;
  }

  const profileKey = action.payload.profileKey;
  if (profileKey && PROFILE_KEY_TO_SLUG[profileKey]) {
    return `/profile/${PROFILE_KEY_TO_SLUG[profileKey]}/edit`;
  }

  return null;
}

export function resolveOpenModuleHref(action: EconomicActionV1): string | null {
  const resolved = resolveModuleFromOpenAction({
    moduleId: action.payload.moduleId,
    entrypoint: action.payload.entrypoint,
    href: action.payload.href,
  });

  return resolved?.route ?? action.payload.href ?? null;
}

export function resolveExternalResourceHref(action: EconomicActionV1): string | null {
  return action.payload.href ?? null;
}
