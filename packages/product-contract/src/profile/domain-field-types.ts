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

export type BenefitsDomainFields = {
  receivingBuergergeld?: boolean;
  receivingAlg1?: boolean;
  receivingWohngeld?: boolean;
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

export type DomainFactPayload<D extends keyof ProfileDomainFieldsMap = keyof ProfileDomainFieldsMap> = {
  kind: 'domain_facts';
  domain: D;
  fields: Partial<ProfileDomainFieldsMap[D]>;
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

export const MutationRequestPayloadSchema = z.union([
  DomainFactPayloadSchema,
  PrefMutationPayloadSchema,
  z.object({ kind: z.literal('empty') }),
]);
