import type { SupportedLanguage } from '@arrival-atlas/ui-contract';
import {
  ECONOMIC_REALITY_COPY_DE,
  ECONOMIC_REALITY_COPY_EN,
  ECONOMIC_REALITY_COPY_RU,
  ER_COPY_KEYS,
  SECTION_TYPE_COPY_KEYS,
  SYSTEM_INTENT_COPY_KEYS,
  type EconomicRealityCopyKey,
} from '@arrival-atlas/product-contract';

export type CopyResolveContext = {
  economicStateCode?: string;
  systemIntent?: keyof typeof SYSTEM_INTENT_COPY_KEYS;
  sectionType?: keyof typeof SECTION_TYPE_COPY_KEYS;
};

const COPY_BUNDLES: Record<SupportedLanguage, Record<string, string>> = {
  en: ECONOMIC_REALITY_COPY_EN,
  de: ECONOMIC_REALITY_COPY_DE,
  ru: ECONOMIC_REALITY_COPY_RU,
  ua: ECONOMIC_REALITY_COPY_EN,
};

export class EconomicCopyResolutionError extends Error {
  readonly key: string;
  readonly locale: SupportedLanguage;

  constructor(key: string, locale: SupportedLanguage) {
    super(`Missing economic reality copy key: ${key} (${locale})`);
    this.name = 'EconomicCopyResolutionError';
    this.key = key;
    this.locale = locale;
  }
}

function resolveContextualKey(key: string, context: CopyResolveContext): string {
  if (key === ER_COPY_KEYS.SYSTEM_CRISIS_WARNING && context.economicStateCode === 'E7') {
    return ER_COPY_KEYS.SYSTEM_CRISIS_WARNING;
  }

  if (context.systemIntent && key === ER_COPY_KEYS.ACTION_OPEN_MODULE) {
    return SYSTEM_INTENT_COPY_KEYS[context.systemIntent];
  }

  if (context.sectionType) {
    return SECTION_TYPE_COPY_KEYS[context.sectionType];
  }

  return key;
}

export function resolveCopy(
  key: string,
  locale: SupportedLanguage,
  context: CopyResolveContext = {}
): string {
  const resolvedKey = resolveContextualKey(key, context);
  const bundle = COPY_BUNDLES[locale] ?? ECONOMIC_REALITY_COPY_EN;
  const localized = bundle[resolvedKey] ?? ECONOMIC_REALITY_COPY_EN[resolvedKey as EconomicRealityCopyKey];

  if (!localized) {
    if (process.env.NODE_ENV !== 'production') {
      throw new EconomicCopyResolutionError(resolvedKey, locale);
    }
    return resolvedKey;
  }

  return localized;
}

export function listRegisteredCopyKeys(): string[] {
  return Object.keys(ECONOMIC_REALITY_COPY_EN);
}
