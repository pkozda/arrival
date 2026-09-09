import { z } from 'zod';
import { SupportedLanguageSchema, ThemePreferenceSchema } from '../ui/index.js';

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

export const TaxClassSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export const ChildAgeSchema = z.object({
  age: z.number().int().min(0).max(25),
});

export type ResidencyStatus = z.infer<typeof ResidencyStatusSchema>;
export type EmploymentStatus = z.infer<typeof EmploymentStatusSchema>;
export type MaritalStatus = z.infer<typeof MaritalStatusSchema>;
export type InsuranceType = z.infer<typeof InsuranceTypeSchema>;
export type TaxClass = z.infer<typeof TaxClassSchema>;
export type ChildAge = z.infer<typeof ChildAgeSchema>;

/** Typed field values per domain — keys are PersistentFactFieldId subsets. */
export type MigrationDomainFields = {
  countryOfOrigin?: string;
  residencyStatus?: ResidencyStatus;
  arrivedAt?: string;
  /**
   * Explicit user confirmation that external Anmeldung was completed.
   * Distinct from address / residency heuristics — PD-001 authoritative fact.
   */
  municipalRegistrationConfirmed?: boolean;
};

export type HousingDomainFields = {
  bundesland?: string;
  city?: string;
  monthlyColdRent?: number;
  monthlyUtilities?: number;
};

export type HouseholdDomainFields = {
  householdSize?: number;
  maritalStatus?: MaritalStatus;
  children?: ChildAge[];
};

export type EmploymentDomainFields = {
  employmentStatus?: EmploymentStatus;
  taxClass?: TaxClass;
  churchTax?: boolean;
};

export type IncomeDomainFields = {
  grossMonthlyIncome?: number;
};

export type HealthInsuranceDomainFields = {
  insuranceType?: InsuranceType;
  hasCoverage?: boolean;
};

export const SupportApplicationPendingSchema = z.enum(['jobcenter', 'sozialamt']);

export type SupportApplicationPending = z.infer<typeof SupportApplicationPendingSchema>;

export type BenefitsDomainFields = {
  receivingBuergergeld?: boolean;
  receivingAlg1?: boolean;
  receivingWohngeld?: boolean;
  receivingKindergeld?: boolean;
  receivingSozialamtSupport?: boolean;
  supportApplicationPending?: SupportApplicationPending;
  savingsDepleted?: boolean;
  benefitReportingOverdue?: boolean;
  benefitApplicationIntent?: boolean;
  daysInGermany?: number;
};

export type PreferencesDomainFields = {
  preferredLanguage?: z.infer<typeof SupportedLanguageSchema>;
  theme?: z.infer<typeof ThemePreferenceSchema>;
  uiDensity?: 'comfortable' | 'compact';
};

export type ProfileDomainFieldsMap = {
  migration: MigrationDomainFields;
  housing: HousingDomainFields;
  household: HouseholdDomainFields;
  employment: EmploymentDomainFields;
  income: IncomeDomainFields;
  healthInsurance: HealthInsuranceDomainFields;
  benefits: BenefitsDomainFields;
  preferences: PreferencesDomainFields;
};

export const MigrationDomainFieldsSchema = z
  .object({
    countryOfOrigin: z.string().length(2).optional(),
    residencyStatus: ResidencyStatusSchema.optional(),
    arrivedAt: z.string().datetime().optional(),
    municipalRegistrationConfirmed: z.boolean().optional(),
  })
  .strict();

export const HousingDomainFieldsSchema = z
  .object({
    bundesland: z.string().length(2).optional(),
    city: z.string().max(100).optional(),
    monthlyColdRent: z.number().nonnegative().optional(),
    monthlyUtilities: z.number().nonnegative().optional(),
  })
  .strict();

export const HouseholdDomainFieldsSchema = z
  .object({
    householdSize: z.number().int().min(1).max(20).optional(),
    maritalStatus: MaritalStatusSchema.optional(),
    children: z.array(ChildAgeSchema).max(10).optional(),
  })
  .strict();

export const EmploymentDomainFieldsSchema = z
  .object({
    employmentStatus: EmploymentStatusSchema.optional(),
    taxClass: TaxClassSchema.optional(),
    churchTax: z.boolean().optional(),
  })
  .strict();

export const IncomeDomainFieldsSchema = z
  .object({
    grossMonthlyIncome: z.number().nonnegative().optional(),
  })
  .strict();

export const HealthInsuranceDomainFieldsSchema = z
  .object({
    insuranceType: InsuranceTypeSchema.optional(),
    hasCoverage: z.boolean().optional(),
  })
  .strict();

export const BenefitsDomainFieldsSchema = z
  .object({
    receivingBuergergeld: z.boolean().optional(),
    receivingAlg1: z.boolean().optional(),
    receivingWohngeld: z.boolean().optional(),
    receivingKindergeld: z.boolean().optional(),
    receivingSozialamtSupport: z.boolean().optional(),
    supportApplicationPending: SupportApplicationPendingSchema.optional(),
    savingsDepleted: z.boolean().optional(),
    benefitReportingOverdue: z.boolean().optional(),
    benefitApplicationIntent: z.boolean().optional(),
    daysInGermany: z.number().int().nonnegative().optional(),
  })
  .strict();

export const PreferencesDomainFieldsSchema = z
  .object({
    preferredLanguage: SupportedLanguageSchema.optional(),
    theme: ThemePreferenceSchema.optional(),
    uiDensity: z.enum(['comfortable', 'compact']).optional(),
  })
  .strict();

export const ProfileDomainFieldsSchemaByDomain = {
  migration: MigrationDomainFieldsSchema,
  housing: HousingDomainFieldsSchema,
  household: HouseholdDomainFieldsSchema,
  employment: EmploymentDomainFieldsSchema,
  income: IncomeDomainFieldsSchema,
  healthInsurance: HealthInsuranceDomainFieldsSchema,
  benefits: BenefitsDomainFieldsSchema,
  preferences: PreferencesDomainFieldsSchema,
} as const;

export type PrefFieldId = 'preferredLanguage' | 'theme' | 'uiDensity';

export type PrefMutationPayload = {
  kind: 'pref';
  field: PrefFieldId;
  value: PreferencesDomainFields[PrefFieldId];
};

export const PrefMutationPayloadSchema = z.discriminatedUnion('field', [
  z.object({ kind: z.literal('pref'), field: z.literal('preferredLanguage'), value: SupportedLanguageSchema }),
  z.object({ kind: z.literal('pref'), field: z.literal('theme'), value: ThemePreferenceSchema }),
  z.object({
    kind: z.literal('pref'),
    field: z.literal('uiDensity'),
    value: z.enum(['comfortable', 'compact']),
  }),
]);

/**
 * Domain fact payloads may carry typed values (set/correct) or explicit nulls
 * (fact.invalidate clear markers). Engine normalize ignores values for invalidate
 * and clears by field key presence.
 */
export type DomainFactPayload<D extends keyof ProfileDomainFieldsMap = keyof ProfileDomainFieldsMap> = {
  kind: 'domain_facts';
  domain: D;
  fields: Partial<{
    [K in keyof ProfileDomainFieldsMap[D]]: ProfileDomainFieldsMap[D][K] | null;
  }>;
};

export type MutationRequestPayload =
  | DomainFactPayload<'migration'>
  | DomainFactPayload<'housing'>
  | DomainFactPayload<'household'>
  | DomainFactPayload<'employment'>
  | DomainFactPayload<'income'>
  | DomainFactPayload<'healthInsurance'>
  | DomainFactPayload<'benefits'>
  | DomainFactPayload<'preferences'>
  | PrefMutationPayload
  | { kind: 'empty' };

export const DomainFactPayloadSchema = z.discriminatedUnion('domain', [
  z.object({
    kind: z.literal('domain_facts'),
    domain: z.literal('migration'),
    fields: MigrationDomainFieldsSchema,
  }),
  z.object({
    kind: z.literal('domain_facts'),
    domain: z.literal('housing'),
    fields: HousingDomainFieldsSchema,
  }),
  z.object({
    kind: z.literal('domain_facts'),
    domain: z.literal('household'),
    fields: HouseholdDomainFieldsSchema,
  }),
  z.object({
    kind: z.literal('domain_facts'),
    domain: z.literal('employment'),
    fields: EmploymentDomainFieldsSchema,
  }),
  z.object({
    kind: z.literal('domain_facts'),
    domain: z.literal('income'),
    fields: IncomeDomainFieldsSchema,
  }),
  z.object({
    kind: z.literal('domain_facts'),
    domain: z.literal('healthInsurance'),
    fields: HealthInsuranceDomainFieldsSchema,
  }),
  z.object({
    kind: z.literal('domain_facts'),
    domain: z.literal('benefits'),
    fields: BenefitsDomainFieldsSchema,
  }),
  z.object({
    kind: z.literal('domain_facts'),
    domain: z.literal('preferences'),
    fields: PreferencesDomainFieldsSchema,
  }),
]);

/** fact.invalidate payloads: field keys present with null = clear (not typed domain values). */
export const InvalidateDomainFactPayloadSchema = z.discriminatedUnion('domain', [
  z.object({
    kind: z.literal('domain_facts'),
    domain: z.literal('migration'),
    fields: z
      .object({
        countryOfOrigin: z.null().optional(),
        residencyStatus: z.null().optional(),
        arrivedAt: z.null().optional(),
        municipalRegistrationConfirmed: z.null().optional(),
      })
      .strict(),
  }),
  z.object({
    kind: z.literal('domain_facts'),
    domain: z.literal('housing'),
    fields: z
      .object({
        bundesland: z.null().optional(),
        city: z.null().optional(),
        monthlyColdRent: z.null().optional(),
        monthlyUtilities: z.null().optional(),
      })
      .strict(),
  }),
  z.object({
    kind: z.literal('domain_facts'),
    domain: z.literal('household'),
    fields: z
      .object({
        householdSize: z.null().optional(),
        maritalStatus: z.null().optional(),
        children: z.null().optional(),
      })
      .strict(),
  }),
  z.object({
    kind: z.literal('domain_facts'),
    domain: z.literal('employment'),
    fields: z
      .object({
        employmentStatus: z.null().optional(),
        taxClass: z.null().optional(),
        churchTax: z.null().optional(),
      })
      .strict(),
  }),
  z.object({
    kind: z.literal('domain_facts'),
    domain: z.literal('income'),
    fields: z.object({ grossMonthlyIncome: z.null().optional() }).strict(),
  }),
  z.object({
    kind: z.literal('domain_facts'),
    domain: z.literal('healthInsurance'),
    fields: z
      .object({
        insuranceType: z.null().optional(),
        hasCoverage: z.null().optional(),
      })
      .strict(),
  }),
  z.object({
    kind: z.literal('domain_facts'),
    domain: z.literal('benefits'),
    fields: z
      .object({
        receivingBuergergeld: z.null().optional(),
        receivingAlg1: z.null().optional(),
        receivingWohngeld: z.null().optional(),
        receivingKindergeld: z.null().optional(),
        receivingSozialamtSupport: z.null().optional(),
        supportApplicationPending: z.null().optional(),
        savingsDepleted: z.null().optional(),
        benefitReportingOverdue: z.null().optional(),
        benefitApplicationIntent: z.null().optional(),
        daysInGermany: z.null().optional(),
      })
      .strict(),
  }),
  z.object({
    kind: z.literal('domain_facts'),
    domain: z.literal('preferences'),
    fields: z
      .object({
        preferredLanguage: z.null().optional(),
        theme: z.null().optional(),
        uiDensity: z.null().optional(),
      })
      .strict(),
  }),
]);

export const MutationRequestPayloadSchema = z.union([
  DomainFactPayloadSchema,
  InvalidateDomainFactPayloadSchema,
  PrefMutationPayloadSchema,
  z.object({ kind: z.literal('empty') }),
]);
