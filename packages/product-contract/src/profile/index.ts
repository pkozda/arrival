export {
  PROFILE_DOMAINS,
  ProfileDomainSchema,
  PROFILE_DOMAIN_REGISTRY,
  isProfileDomain,
  type ProfileDomain,
  type ProfileDomainRegistryEntry,
} from './domains.js';

export {
  FACT_MUTATION_TYPES,
  META_MUTATION_TYPES,
  PREF_MUTATION_TYPES,
  MUTATION_TYPES,
  FactMutationTypeSchema,
  MetaMutationTypeSchema,
  PrefMutationTypeSchema,
  MutationTypeSchema,
  MUTATION_TYPE_REGISTRY,
  isFactMutationType,
  isMetaMutationType,
  isPersistentMutationType,
  type FactMutationType,
  type MetaMutationType,
  type PrefMutationType,
  type MutationType,
  type MutationTypeRegistryEntry,
} from './mutation-types.js';

export {
  MUTATION_INTENTS,
  MutationIntentSchema,
  MUTATION_INTENT_REGISTRY,
  MUTATION_TYPE_DEFAULT_INTENT,
  isMutationIntent,
  type MutationIntent,
  type MutationIntentRegistryEntry,
} from './mutation-intents.js';

export {
  MutationSourceKindSchema,
  SystemMutationReasonSchema,
  HeaderPrefFieldSchema,
  MutationSourceSchema,
  MUTATION_SOURCE_REGISTRY,
  type MutationSourceKind,
  type SystemMutationReason,
  type HeaderPrefField,
  type MutationSource,
  type MutationSourceRegistryEntry,
} from './mutation-source.js';

export {
  SCENARIO_FIELD_IDS,
  ScenarioFieldIdSchema,
  SCENARIO_FIELD_REGISTRY,
  isScenarioFieldId,
  type ScenarioFieldId,
  type ScenarioFieldDefinition,
  type ScenarioFieldValueMap,
} from './scenario-fields.js';

export {
  FieldSensitivitySchema,
  PERSISTENT_FACT_FIELD_IDS,
  PersistentFactFieldIdSchema,
  PERSISTENT_FACT_FIELD_REGISTRY,
  isPersistentFactFieldId,
  getFieldDefinition,
  getFieldsForDomain,
  type FieldSensitivity,
  type PersistentFactFieldId,
  type PersistentFactFieldDefinition,
} from './field-registry.js';

export {
  ResidencyStatusSchema,
  EmploymentStatusSchema,
  MaritalStatusSchema,
  InsuranceTypeSchema,
  TaxClassSchema,
  ChildAgeSchema,
  MigrationDomainFieldsSchema,
  HousingDomainFieldsSchema,
  HouseholdDomainFieldsSchema,
  EmploymentDomainFieldsSchema,
  IncomeDomainFieldsSchema,
  HealthInsuranceDomainFieldsSchema,
  BenefitsDomainFieldsSchema,
  PreferencesDomainFieldsSchema,
  ProfileDomainFieldsSchemaByDomain,
  DomainFactPayloadSchema,
  PrefMutationPayloadSchema,
  MutationRequestPayloadSchema,
  type ResidencyStatus,
  type EmploymentStatus,
  type MaritalStatus,
  type InsuranceType,
  type TaxClass,
  type ChildAge,
  type MigrationDomainFields,
  type HousingDomainFields,
  type HouseholdDomainFields,
  type EmploymentDomainFields,
  type IncomeDomainFields,
  type HealthInsuranceDomainFields,
  type BenefitsDomainFields,
  type PreferencesDomainFields,
  type ProfileDomainFieldsMap,
  type PrefFieldId,
  type PrefMutationPayload,
  type DomainFactPayload,
  type MutationRequestPayload,
} from './domain-field-types.js';

export {
  MutationRequestSchema,
  parseMutationRequest,
  safeParseMutationRequest,
  type MutationRequest,
  type ValidatedMutationRequest,
} from './mutation-request.js';

export {
  FieldDeltaOperationSchema,
  FieldDeltaSchema,
  MutationEventSchema,
  MutationEventLogSchema,
  parseMutationEvent,
  safeParseMutationEvent,
  type FieldDeltaOperation,
  type FieldDelta,
  type MutationEvent,
  type MutationEventLog,
} from './mutation-event.js';

export {
  ProfileRevisionFieldChangeSchema,
  ProfileRevisionSchema,
  parseProfileRevision,
  safeParseProfileRevision,
  type ProfileRevisionFieldChange,
  type ProfileRevision,
} from './profile-revision.js';

export {
  USER_PROFILE_VIEW_SCHEMA_VERSION,
  UserProfileViewSchemaVersionSchema,
  ProfileCompletenessSchema,
  UserProfileDomainViewsSchema,
  UserProfilePreferencesViewSchema,
  UserProfileViewV1Schema,
  UserContextV1Schema,
  parseUserProfileViewV1,
  safeParseUserProfileViewV1,
  parseUserContextV1,
  type ProfileCompleteness,
  type UserProfileDomainViews,
  type UserProfilePreferencesView,
  type UserProfileViewV1,
  type UserContextV1,
} from './user-profile-view.js';

export {
  PROFILE_INSIGHT_VIEW_SCHEMA_VERSION,
  ProfileInsightViewSchemaVersionSchema,
  ConfidenceLevelSchema,
  DomainConfidenceSchema,
  ProfileMirrorDomainSlugSchema,
  AdvisorySuggestionActionSchema,
  AdvisorySuggestionSchema,
  MissingContextHintSchema,
  DomainInsightSchema,
  ProfileInsightViewV1Schema,
  parseProfileInsightViewV1,
  safeParseProfileInsightViewV1,
  type ConfidenceLevel,
  type DomainConfidence,
  type ProfileMirrorDomainSlug,
  type AdvisorySuggestionAction,
  type AdvisorySuggestion,
  type MissingContextHint,
  type DomainInsight,
  type ProfileInsightViewV1,
} from './profile-insight-view.js';

export {
  validatePersistentPayloadFields,
  extractDomainFactFieldKeys,
  assertPersistentFactFieldId,
  type MutationValidationIssue,
  type MutationValidationResult,
} from './validation.js';
