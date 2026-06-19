import type { ModuleExecutionResult } from '@arrival-atlas/core';
import type { ModuleResult } from '../types/ModuleResult.js';
import {
  wrapLegacyExecutionResult,
  type WrapLegacyExecutionResultParams,
} from '../adapters/wrapLegacyExecutionResult.js';
import { isMrcEnvelopeEnabled } from '../config/mrc-envelope.js';
import { isMrcExplanationEnabled } from '../config/mrc-explanation.js';
import {
  enrichModuleResultSemantics,
  type SemanticEnrichmentContext,
} from './enrichModuleResult.js';
import { enrichModuleResultActions } from './enrichModuleResultActions.js';
import { sealModuleResult } from './sealModuleResult.js';

export function buildModuleResultEnvelope(
  legacy: ModuleExecutionResult,
  params: WrapLegacyExecutionResultParams,
  semanticContext?: SemanticEnrichmentContext
): ModuleResult | undefined {
  if (!isMrcEnvelopeEnabled()) {
    return undefined;
  }

  let envelope = wrapLegacyExecutionResult(legacy, params);

  if (semanticContext && isMrcExplanationEnabled()) {
    envelope = enrichModuleResultSemantics(envelope, legacy, semanticContext);
    envelope = enrichModuleResultActions(envelope, legacy, {
      moduleId: semanticContext.moduleId,
      governedRegistry: semanticContext.governedRegistry,
    });
  }

  return sealModuleResult(envelope, legacy.data);
}
