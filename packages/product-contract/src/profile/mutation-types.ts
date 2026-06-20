import { z } from 'zod';

/** Fact-level mutation types (persistent when committed). */
export const FACT_MUTATION_TYPES = [
  'fact.create',
  'fact.update',
  'fact.correct',
  'fact.invalidate',
] as const;

/** Meta mutation types (ephemeral until promoted). */
export const META_MUTATION_TYPES = [
  'fact.suggest_correction',
  'fact.propose_update',
] as const;

/** Preference mutation types (session plane). */
export const PREF_MUTATION_TYPES = ['pref.update'] as const;

export const MUTATION_TYPES = [
  ...FACT_MUTATION_TYPES,
  ...META_MUTATION_TYPES,
  ...PREF_MUTATION_TYPES,
] as const;

export const FactMutationTypeSchema = z.enum(FACT_MUTATION_TYPES);
export const MetaMutationTypeSchema = z.enum(META_MUTATION_TYPES);
export const PrefMutationTypeSchema = z.enum(PREF_MUTATION_TYPES);
export const MutationTypeSchema = z.enum(MUTATION_TYPES);

export type FactMutationType = z.infer<typeof FactMutationTypeSchema>;
export type MetaMutationType = z.infer<typeof MetaMutationTypeSchema>;
export type PrefMutationType = z.infer<typeof PrefMutationTypeSchema>;
export type MutationType = z.infer<typeof MutationTypeSchema>;

export type MutationTypeRegistryEntry = {
  type: MutationType;
  /** Whether committed events append to profile event log */
  persistent: boolean;
  /** Whether snapshot refresh expected after commit */
  triggersSnapshotUpdate: boolean;
  /** Default userConfirmationRequired when not explicitly set */
  defaultConfirmationRequired: boolean;
};

export const MUTATION_TYPE_REGISTRY: Readonly<Record<MutationType, MutationTypeRegistryEntry>> = {
  'fact.create': {
    type: 'fact.create',
    persistent: true,
    triggersSnapshotUpdate: true,
    defaultConfirmationRequired: false,
  },
  'fact.update': {
    type: 'fact.update',
    persistent: true,
    triggersSnapshotUpdate: true,
    defaultConfirmationRequired: false,
  },
  'fact.correct': {
    type: 'fact.correct',
    persistent: true,
    triggersSnapshotUpdate: true,
    defaultConfirmationRequired: true,
  },
  'fact.invalidate': {
    type: 'fact.invalidate',
    persistent: true,
    triggersSnapshotUpdate: true,
    defaultConfirmationRequired: true,
  },
  'fact.suggest_correction': {
    type: 'fact.suggest_correction',
    persistent: false,
    triggersSnapshotUpdate: false,
    defaultConfirmationRequired: true,
  },
  'fact.propose_update': {
    type: 'fact.propose_update',
    persistent: false,
    triggersSnapshotUpdate: false,
    defaultConfirmationRequired: true,
  },
  'pref.update': {
    type: 'pref.update',
    persistent: true,
    triggersSnapshotUpdate: true,
    defaultConfirmationRequired: false,
  },
};

export function isFactMutationType(value: MutationType): value is FactMutationType {
  return (FACT_MUTATION_TYPES as readonly string[]).includes(value);
}

export function isMetaMutationType(value: MutationType): value is MetaMutationType {
  return (META_MUTATION_TYPES as readonly string[]).includes(value);
}

export function isPersistentMutationType(value: MutationType): boolean {
  return MUTATION_TYPE_REGISTRY[value].persistent;
}
