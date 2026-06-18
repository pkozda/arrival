import { z } from 'zod';

export const SupportedLanguageSchema = z.enum(['ru', 'ua', 'de', 'en']);
export type SupportedLanguage = z.infer<typeof SupportedLanguageSchema>;

export const SUPPORTED_LANGUAGES = SupportedLanguageSchema.options;
