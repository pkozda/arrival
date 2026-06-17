import { SupportedLanguageSchema, type SupportedLanguage } from '@arrivalos/core';
import type { UiSnapshot } from '@/lib/api';

export function getSessionLanguage(snapshot: UiSnapshot | null): SupportedLanguage {
  const parsed = SupportedLanguageSchema.safeParse(snapshot?.session?.language);
  return parsed.success ? parsed.data : 'en';
}
