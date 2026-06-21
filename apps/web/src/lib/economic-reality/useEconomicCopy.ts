'use client';

import { useCallback } from 'react';
import { useApp } from '@/components/AppProvider';
import type { CopyResolveContext } from '@arrival-atlas/modules/i18n';
import { resolveEconomicCopy } from './copy';

export function useEconomicCopy() {
  const { language } = useApp();

  return useCallback(
    (key: string, context?: CopyResolveContext) => resolveEconomicCopy(key, language, context),
    [language]
  );
}
