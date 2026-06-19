import { SupportedLanguageSchema } from '@arrival-atlas/core';
import { z } from 'zod';

export const PROFILE_SCHEMA_VERSION = '1.0.0';

export const TaxClassSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export const ResidencyStatusSchema = z.enum([
  'eu-citizen',
  'permanent-resident',
  'temporary-resident',
  'asylum-seeker',
  'student-visa',
  'work-visa',
  'tourist',
  'unknown',
]);

export const EmploymentStatusSchema = z.enum([
  'employed',
  'self-employed',
  'unemployed',
  'part-time',
  'student',
]);

export const MaritalStatusSchema = z.enum(['single', 'married', 'divorced', 'widowed']);

export const InsuranceTypeSchema = z.enum(['public', 'private', 'none']);

export const CoreProfileSchema = z.object({
  schemaVersion: z.string().default(PROFILE_SCHEMA_VERSION),
  preferredLanguage: SupportedLanguageSchema.default('en'),
  countryOfOrigin: z.string().length(2).optional(),
  location: z
    .object({
      bundesland: z.string().length(2).optional(),
      city: z.string().max(100).optional(),
    })
    .optional(),
  residency: z
    .object({
      status: ResidencyStatusSchema.optional(),
      arrivedAt: z.string().datetime().optional(),
    })
    .optional(),
  household: z
    .object({
      size: z.number().int().min(1).max(20).optional(),
      maritalStatus: MaritalStatusSchema.optional(),
      children: z
        .array(
          z.object({
            age: z.number().int().min(0).max(25),
          })
        )
        .max(10)
        .optional(),
    })
    .optional(),
  employment: z
    .object({
      status: EmploymentStatusSchema.optional(),
      grossMonthlyIncome: z.number().nonnegative().optional(),
      taxClass: TaxClassSchema.optional(),
      churchTax: z.boolean().optional(),
    })
    .optional(),
  housing: z
    .object({
      monthlyColdRent: z.number().nonnegative().optional(),
      monthlyUtilities: z.number().nonnegative().optional(),
    })
    .optional(),
  insurance: z
    .object({
      type: InsuranceTypeSchema.optional(),
      hasCoverage: z.boolean().optional(),
    })
    .optional(),
  benefits: z
    .object({
      receivingBuergergeld: z.boolean().optional(),
      receivingAlg1: z.boolean().optional(),
      receivingWohngeld: z.boolean().optional(),
      daysInGermany: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export const ProfileDocumentSchema = CoreProfileSchema.extend({
  extensions: z.record(z.string(), z.record(z.unknown())).default({}),
});

export type ProfileDocument = z.infer<typeof ProfileDocumentSchema>;

export const ProfilePatchSchema = ProfileDocumentSchema.deepPartial();
export type ProfilePatch = z.infer<typeof ProfilePatchSchema>;

export const ProfileCreateInputSchema = ProfileDocumentSchema.partial().extend({
  preferredLanguage: SupportedLanguageSchema.optional(),
});
export type ProfileCreateInput = z.infer<typeof ProfileCreateInputSchema>;
