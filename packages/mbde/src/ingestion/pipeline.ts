import { createHash } from 'node:crypto';
import type { BenefitNode, BenefitNodeVersion } from '../types/benefit-node.js';
import { BenefitNodeSchema } from '../types/benefit-node.js';
import type {
  IngestionBatchResult,
  LlmNormalizerPort,
  RawBenefitDocument,
  UpdateLogEntry,
  UpdateScheduleTier,
} from '../types/ingestion.js';
import { heuristicNormalizeToBenefitNode } from './normalizer.js';
import { detectBenefitChanges } from './change-detection.js';

export type BenefitGraphStorePort = {
  listActive(): BenefitNode[];
  listAll(): BenefitNode[];
  getById(id: string): BenefitNode | undefined;
  upsert(node: BenefitNode): BenefitNode;
  deprecate(id: string, replacedById?: string): BenefitNode | undefined;
  appendVersion(version: BenefitNodeVersion): void;
  listVersions(nodeId: string): BenefitNodeVersion[];
  appendUpdateLog(entry: UpdateLogEntry): void;
  listUpdateLogs(limit?: number): UpdateLogEntry[];
};

export type IngestionPipelineOptions = {
  llmNormalizer?: LlmNormalizerPort;
  defaultLayer?: RawBenefitDocument['layer'];
};

export function hashBenefitNode(node: BenefitNode): string {
  return createHash('sha256').update(JSON.stringify(node)).digest('hex').slice(0, 16);
}

export async function ingestRawDocuments(
  store: BenefitGraphStorePort,
  documents: RawBenefitDocument[],
  options: IngestionPipelineOptions = {}
): Promise<IngestionBatchResult> {
  const result: IngestionBatchResult = {
    ingested: 0,
    updated: 0,
    deprecated: 0,
    failed: 0,
    warnings: [],
  };

  for (const document of documents) {
    try {
      const normalized = options.llmNormalizer
        ? await options.llmNormalizer(document)
        : heuristicNormalizeToBenefitNode(document);

      const node = BenefitNodeSchema.parse(normalized.node);
      const existing = node.id ? store.getById(node.id) : undefined;
      const change = detectBenefitChanges(existing, node);

      if (!change.changed) {
        continue;
      }

      const saved = store.upsert({
        ...node,
        version: existing ? existing.version + 1 : 1,
        status: 'active',
      });

      store.appendVersion({
        nodeId: saved.id,
        version: saved.version,
        status: saved.status,
        snapshot: saved,
        contentHash: hashBenefitNode(saved),
        recordedAt: new Date().toISOString(),
      });

      if (existing) {
        result.updated += 1;
      } else {
        result.ingested += 1;
      }

      result.warnings.push(...normalized.warnings);
    } catch (error) {
      result.failed += 1;
      result.warnings.push(
        error instanceof Error ? error.message : `Failed to ingest document from ${document.sourceUrl}`
      );
    }
  }

  return result;
}

export async function runScheduledIngestion(
  store: BenefitGraphStorePort,
  tier: UpdateScheduleTier,
  documents: RawBenefitDocument[],
  options: IngestionPipelineOptions = {}
): Promise<IngestionBatchResult> {
  const logId = `update_${Date.now()}`;
  const startedAt = new Date().toISOString();

  store.appendUpdateLog({
    id: logId,
    tier,
    startedAt,
    ingested: 0,
    updated: 0,
    deprecated: 0,
    failed: 0,
    trigger: 'scheduler',
  });

  const result = await ingestRawDocuments(store, documents, options);

  store.appendUpdateLog({
    id: logId,
    tier,
    startedAt,
    completedAt: new Date().toISOString(),
    ...result,
    trigger: 'scheduler',
  });

  return result;
}
