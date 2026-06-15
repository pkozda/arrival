import { z } from 'zod';
import type { AppContext, Module, ModuleRegistration } from '@arrivalos/core';
import {
  translateTerm,
  searchTerms,
  formatTranslation,
  getTermsByCategory,
} from '@arrivalos/shared-services';

export const SystemTranslationInputSchema = z.object({
  query: z.string().min(1).max(200),
  mode: z.enum(['lookup', 'search', 'category']).default('search'),
  category: z.enum([
    'administrative', 'financial', 'healthcare', 'employment', 'housing', 'general',
  ]).optional(),
});

export const SystemTranslationOutputSchema = z.object({
  results: z.array(z.object({
    term: z.string(),
    translation: z.string(),
    explanation: z.string(),
    category: z.string(),
    relatedTerms: z.array(z.string()),
  })),
  contextHint: z.string().optional(),
});

export type SystemTranslationInput = z.infer<typeof SystemTranslationInputSchema>;
export type SystemTranslationOutput = z.infer<typeof SystemTranslationOutputSchema>;

export function resolveSystemTranslationLanguage(context: AppContext): string {
  const preferredLanguage = (
    context.profileSlice as { preferredLanguage?: string } | undefined
  )?.preferredLanguage;

  return preferredLanguage ?? context.userProfile?.language ?? 'en';
}

export const systemTranslationModule: Module<SystemTranslationInput, SystemTranslationOutput> = {
  id: 'system-translation',
  name: 'System Translation Module',
  version: '1.0.0',
  description: 'Translates German administrative, financial, and healthcare terms into plain language',
  inputSchema: SystemTranslationInputSchema,
  outputSchema: SystemTranslationOutputSchema,

  async execute(input, context: AppContext): Promise<SystemTranslationOutput> {
    const language = resolveSystemTranslationLanguage(context) as Parameters<
      typeof translateTerm
    >[1];

    if (input.mode === 'lookup') {
      const entry = translateTerm(input.query, language);
      if (!entry) {
        return {
          results: [],
          contextHint: `No translation found for "${input.query}". Try searching with partial terms.`,
        };
      }
      return {
        results: [formatTranslation(entry, language)],
      };
    }

    if (input.mode === 'category' && input.category) {
      const entries = getTermsByCategory(input.category);
      return {
        results: entries.map((e) => formatTranslation(e, language)),
        contextHint: `Showing all ${input.category} terms`,
      };
    }

    const entries = searchTerms(input.query, language);
    return {
      results: entries.map((e) => formatTranslation(e, language)),
      contextHint: entries.length === 0
        ? `No matches for "${input.query}". Common terms: Anmeldung, Bürgergeld, Krankenkasse, Steuerklasse`
        : undefined,
    };
  },
};

export const systemTranslationRegistration: ModuleRegistration = {
  ...systemTranslationModule,
  enabled: true,
  featureFlags: { aiEnhancedTranslation: false },
  module: systemTranslationModule,
};
