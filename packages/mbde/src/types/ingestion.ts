import type { BenefitNode } from './benefit-node.js';

export type IngestionLayer = 'official' | 'scraped' | 'curated' | 'llm-normalized';

export type RawBenefitDocument = {
  id?: string;
  title?: string;
  rawText: string;
  sourceUrl: string;
  authority?: string;
  geography?: BenefitNode['geography'];
  category?: BenefitNode['category'];
  fetchedAt?: string;
  layer: IngestionLayer;
};

export type NormalizationResult = {
  node: BenefitNode;
  warnings: string[];
  confidence: number;
};

export type LlmNormalizerPort = (document: RawBenefitDocument) => Promise<NormalizationResult>;

export type IngestionBatchResult = {
  ingested: number;
  updated: number;
  deprecated: number;
  failed: number;
  warnings: string[];
};

export type UpdateScheduleTier = 'daily' | 'weekly' | 'monthly' | 'event';

export type UpdateLogEntry = {
  id: string;
  tier: UpdateScheduleTier;
  startedAt: string;
  completedAt?: string;
  ingested: number;
  updated: number;
  deprecated: number;
  failed: number;
  trigger: 'scheduler' | 'manual' | 'policy-event';
};
