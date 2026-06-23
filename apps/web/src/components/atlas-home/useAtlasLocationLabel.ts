'use client';

import { useApp } from '@/components/AppProvider';
import { selectUserContextProfile } from '@/lib/user-context';

const DEFAULT_LOCATION = 'Berlin · Week 2';
const LOADING_LOCATION = 'Locating · Week 2';

export function useAtlasLocationLabel(): string {
  const { userContext, userContextLoading, bootstrapLoading } = useApp();
  const city = selectUserContextProfile(userContext)?.domains?.housing?.city?.trim();

  if (city) {
    return `${city} · Week 2`;
  }

  if (userContextLoading || bootstrapLoading) {
    return LOADING_LOCATION;
  }

  return DEFAULT_LOCATION;
}
