import type { NodeStateV1 } from '@arrival-atlas/product-contract';

export function computeProgressRatio(nodes: Record<string, NodeStateV1>): number {
  const values = Object.values(nodes);
  const countable = values.filter(
    (node) => node.status !== 'skipped' && node.status !== 'locked'
  );

  if (countable.length === 0) {
    return 0;
  }

  const completed = countable.filter((node) => node.status === 'completed').length;
  return completed / countable.length;
}
