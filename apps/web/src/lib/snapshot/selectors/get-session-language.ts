import { SupportedLanguageSchema, type SupportedLanguage } from '@/lib/product-contract';
import type { UiSnapshot } from '@/lib/product-contract';

export function getSessionLanguage(snapshot: UiSnapshot | null): SupportedLanguage {
  const parsed = SupportedLanguageSchema.safeParse(snapshot?.session?.language);
  return parsed.success ? parsed.data : 'en';
}
