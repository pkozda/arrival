import { z } from 'zod';

export const ThemePreferenceSchema = z.enum(['light', 'dark', 'system']);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;
