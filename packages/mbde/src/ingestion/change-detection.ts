import type { BenefitNode } from '../types/benefit-node.js';
import { hashBenefitNode } from './pipeline.js';

export type BenefitChangeDetection = {
  changed: boolean;
  previousHash?: string;
  nextHash: string;
  fieldsChanged: string[];
};

export function detectBenefitChanges(
  previous: BenefitNode | undefined,
  next: BenefitNode
): BenefitChangeDetection {
  const nextHash = hashBenefitNode(next);

  if (!previous) {
    return { changed: true, nextHash, fieldsChanged: ['created'] };
  }

  const previousHash = hashBenefitNode(previous);
  if (previousHash === nextHash) {
    return { changed: false, previousHash, nextHash, fieldsChanged: [] };
  }

  const fieldsChanged: string[] = [];
  const keys: (keyof BenefitNode)[] = [
    'title',
    'description',
    'category',
    'geography',
    'eligibilityRules',
    'benefitType',
    'valueEstimate',
    'source',
    'tags',
    'status',
  ];

  for (const key of keys) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) {
      fieldsChanged.push(key);
    }
  }

  return {
    changed: true,
    previousHash,
    nextHash,
    fieldsChanged,
  };
}

export function shouldDeprecateNode(previous: BenefitNode, next: BenefitNode): boolean {
  return (
    previous.status === 'active' &&
    next.status === 'deprecated' &&
    detectBenefitChanges(previous, next).changed
  );
}
