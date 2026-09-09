'use client';

import { useApp } from '@/components/AppProvider';
import { selectUserContextProfile } from '@/lib/user-context';

/** Week suffix kept as intentional product framing; city is profile data. */
export function useAtlasLocationLabel(): string {
  const { t, userContext, userContextLoading, bootstrapLoading } = useApp();
  const city = selectUserContextProfile(userContext)?.domains?.housing?.city?.trim();

  if (city) {
    // Reuse berlinWeek2 pattern: "{city} · Week N" via replacing Berlin placeholder language-locally.
    return t('home.atlas.location.berlinWeek2').replace(/^Berlin|^Берлин|^Берлін/, city);
  }

  if (userContextLoading || bootstrapLoading) {
    return t('home.atlas.location.locatingWeek2');
  }

  return t('home.atlas.location.berlinWeek2');
}
