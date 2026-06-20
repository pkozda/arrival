import type {
  LifeEventPlanNode,
  MissingContextHint,
  ProfileMirrorDomainSlug,
} from '@/lib/product-contract';
import type { ModuleSuggestion } from '@/lib/situation-utils';
import type { ActionSurfaceV1 } from './actions';

export type SemanticIdentityKey = `module:${string}` | `mirror:${string}` | `domain:${string}`;

const MIRROR_DOMAIN_KEYS: Record<ProfileMirrorDomainSlug, SemanticIdentityKey[]> = {
  'move-to-germany': ['domain:migration'],
  'where-you-live': ['domain:housing'],
  'household-family': ['domain:household'],
  'work-income': ['domain:employment', 'domain:income'],
  'health-insurance': ['domain:healthInsurance'],
  'benefits-support': ['domain:benefits'],
  'language-display': ['domain:preferences'],
};

export function semanticKeysFromNode(node: LifeEventPlanNode): SemanticIdentityKey[] {
  const keys = new Set<SemanticIdentityKey>();

  for (const action of node.actions) {
    if (action.moduleId) {
      keys.add(`module:${action.moduleId}`);
    }
    if (action.profileMirrorSlug) {
      keys.add(`mirror:${action.profileMirrorSlug}`);
      for (const domainKey of MIRROR_DOMAIN_KEYS[action.profileMirrorSlug as ProfileMirrorDomainSlug] ?? []) {
        keys.add(domainKey);
      }
    }
  }

  return [...keys];
}

export function semanticKeysFromHint(hint: MissingContextHint): SemanticIdentityKey[] {
  const keys = new Set<SemanticIdentityKey>([`domain:${hint.domain}`]);

  if (hint.mirrorSlug) {
    keys.add(`mirror:${hint.mirrorSlug}`);
    for (const domainKey of MIRROR_DOMAIN_KEYS[hint.mirrorSlug] ?? []) {
      keys.add(domainKey);
    }
  }

  if (hint.ctaModuleId) {
    keys.add(`module:${hint.ctaModuleId}`);
  }

  return [...keys];
}

export function semanticKeysFromModuleSuggestion(
  suggestion: ModuleSuggestion
): SemanticIdentityKey[] {
  return [`module:${suggestion.module.id}`];
}

export function collectActionSurfaceSemanticKeys(surface: ActionSurfaceV1): Set<SemanticIdentityKey> {
  const keys = new Set<SemanticIdentityKey>();
  const nodes = [
    surface.primaryAction,
    ...surface.secondaryActions,
    ...surface.blockedActions,
    ...surface.contextualActions,
  ].filter((node): node is LifeEventPlanNode => node !== null);

  for (const node of nodes) {
    for (const key of semanticKeysFromNode(node)) {
      keys.add(key);
    }
  }

  return keys;
}

export function overlapsSemanticIdentity(
  planKeys: ReadonlySet<SemanticIdentityKey>,
  candidateKeys: readonly SemanticIdentityKey[]
): boolean {
  return candidateKeys.some((key) => planKeys.has(key));
}
