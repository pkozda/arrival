import { z } from 'zod';
import {
  SupportedLanguageSchema,
  ThemePreferenceSchema,
  type SupportedLanguage,
  type ThemePreference,
} from '@arrivalos/ui-contract';

export { SupportedLanguageSchema, ThemePreferenceSchema, type SupportedLanguage, type ThemePreference };

export const UiPreferencesSchema = z.object({
  theme: ThemePreferenceSchema.default('light'),
});

export type UiPreferences = z.infer<typeof UiPreferencesSchema>;

export const UserProfileSchema = z.object({
  language: SupportedLanguageSchema.default('en'),
  residencyStatus: z.string().optional(),
  income: z.number().nonnegative().optional(),
  householdSize: z.number().int().positive().optional(),
  uiPreferences: UiPreferencesSchema.optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const SystemStateSchema = z.object({
  benefits: z.record(z.unknown()).optional(),
  insurance: z.record(z.unknown()).optional(),
  employmentStatus: z.record(z.unknown()).optional(),
});

export type SystemState = z.infer<typeof SystemStateSchema>;

export const DataProvenanceSourceSchema = z.enum(['input', 'profile', 'default', 'override']);
export type DataProvenanceSource = z.infer<typeof DataProvenanceSourceSchema>;

export const DataProvenanceEntrySchema = z.object({
  field: z.string(),
  source: DataProvenanceSourceSchema,
});

export type DataProvenanceEntry = z.infer<typeof DataProvenanceEntrySchema>;

export const AppContextSchema = z.object({
  userProfile: UserProfileSchema.optional(),
  location: z.string().optional(),
  systemState: SystemStateSchema.optional(),
  sessionId: z.string().optional(),
  profileId: z.string().optional(),
  profileVersion: z.number().int().optional(),
  profileSchemaVersion: z.string().optional(),
  profileSlice: z.record(z.unknown()).optional(),
  dataProvenance: z.array(DataProvenanceEntrySchema).optional(),
});

export type AppContext = z.infer<typeof AppContextSchema>;

export const ModuleMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string(),
  enabled: z.boolean().default(true),
  featureFlags: z.record(z.boolean()).default({}),
});

export type ModuleMetadata = z.infer<typeof ModuleMetadataSchema>;

export interface Module<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  version: string;
  description: string;
  inputSchema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  outputSchema: z.ZodType<TOutput, z.ZodTypeDef, unknown>;
  execute(input: TInput, context: AppContext): Promise<TOutput>;
}

export interface ModuleRegistration extends ModuleMetadata {
  module: Module;
}

export interface ModuleExecutionResult<T = unknown> {
  moduleId: string;
  version: string;
  success: boolean;
  data?: T;
  error?: string;
  executedAt: string;
}

export interface TrackedEvent {
  id: string;
  type: string;
  moduleId?: string;
  payload?: Record<string, unknown>;
  timestamp: string;
  sessionId?: string;
}

export interface Session {
  id: string;
  createdAt: string;
  lastActiveAt: string;
  context: AppContext;
}
