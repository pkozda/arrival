import type { LifeEventPlanNode } from '@/lib/product-contract';

export type LeSeverity = LifeEventPlanNode['priority'];

export function leSeverityClass(severity: string, prefix = 'le-severity'): string {
  const normalized = ['critical', 'high', 'medium', 'low'].includes(severity) ? severity : 'medium';
  return `${prefix}--${normalized}`;
}

export function leBadgeClass(severity: string): string {
  return `badge le-badge ${leSeverityClass(severity, 'le-badge')}`;
}

export function leConfidenceClass(confidence: string): string {
  const normalized = ['high', 'medium', 'low'].includes(confidence) ? confidence : 'none';
  return `le-confidence le-confidence--${normalized}`;
}
