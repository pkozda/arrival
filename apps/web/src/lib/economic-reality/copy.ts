import type { SupportedLanguage } from '@/lib/product-contract';
import { resolveCopy, type CopyResolveContext } from '@arrival-atlas/modules/i18n';

export function resolveEconomicCopy(
  key: string,
  locale: SupportedLanguage,
  context?: CopyResolveContext
): string {
  return resolveCopy(key, locale, context);
}
