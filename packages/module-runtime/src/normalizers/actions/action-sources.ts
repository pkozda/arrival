import type { ActionKind, ActionPriority } from '../../types/ActionItem.js';
import { asRecord } from '../shared.js';

export type ActionSource = {
  sourceModule: string;
  sourceRecord: string;
  sourceId: string;
  rawAction: string;
  priority: string;
  title?: string;
  description?: string;
  target?: string;
};

const PRIORITY_RANK: Record<ActionPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function resolveActionPriority(priority: string): ActionPriority {
  if (priority === 'critical' || priority === 'high') {
    return 'high';
  }

  if (priority === 'low') {
    return 'low';
  }

  return 'medium';
}

export function compareActionPriority(a: ActionPriority, b: ActionPriority): number {
  return PRIORITY_RANK[a] - PRIORITY_RANK[b];
}

export function mapActionKind(rawAction: string): ActionKind {
  const lower = rawAction.toLowerCase();

  if (/upload|provide|document|collect/.test(lower)) {
    return 'collect-documents';
  }

  if (/schedule|book|appointment/.test(lower)) {
    return 'schedule';
  }

  if (/contact|call|reach/.test(lower)) {
    return 'contact';
  }

  if (/apply|request|submit/.test(lower)) {
    return 'apply';
  }

  return 'custom';
}

export function normalizeActionTitle(rawAction: string): string {
  const trimmed = rawAction.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function readOptionalString(
  record: Record<string, unknown>,
  key: string
): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function readRawAction(record: Record<string, unknown>): string | undefined {
  const action = record.action;
  if (typeof action !== 'string') {
    return undefined;
  }

  const trimmed = action.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function extractFinancialRealityActionSources(
  moduleId: string,
  payload: unknown
): ActionSource[] {
  const record = asRecord(payload);
  if (!record || !Array.isArray(record.decisions)) {
    return [];
  }

  const sources: ActionSource[] = [];

  record.decisions.forEach((entry, index) => {
    const decision = asRecord(entry);
    if (!decision) {
      return;
    }

    const rawAction = readRawAction(decision);
    if (!rawAction) {
      return;
    }

    sources.push({
      sourceModule: moduleId,
      sourceRecord: 'decisions',
      sourceId:
        typeof decision.id === 'string' ? decision.id : `financial-decision-${index}`,
      rawAction,
      priority: typeof decision.priority === 'string' ? decision.priority : 'medium',
      title: readOptionalString(decision, 'title'),
      description: readOptionalString(decision, 'description'),
      target: readOptionalString(decision, 'target'),
    });
  });

  return sources;
}

export function extractBenefitsSimulatorActionSources(
  moduleId: string,
  payload: unknown
): ActionSource[] {
  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  const sources: ActionSource[] = [];

  if (Array.isArray(record.riskWarnings)) {
    record.riskWarnings.forEach((entry, index) => {
      const warning = asRecord(entry);
      if (!warning) {
        return;
      }

      const rawAction = readRawAction(warning);
      if (!rawAction) {
        return;
      }

      sources.push({
        sourceModule: moduleId,
        sourceRecord: 'riskWarnings',
        sourceId: typeof warning.id === 'string' ? warning.id : `benefits-risk-${index}`,
        rawAction,
        priority: typeof warning.severity === 'string' ? warning.severity : 'medium',
        title: readOptionalString(warning, 'title'),
        description: readOptionalString(warning, 'description'),
        target: readOptionalString(warning, 'institution'),
      });
    });
  }

  if (Array.isArray(record.recommendations)) {
    record.recommendations.forEach((entry, index) => {
      const recommendation = asRecord(entry);
      if (!recommendation) {
        return;
      }

      const rawAction = readRawAction(recommendation);
      if (!rawAction) {
        return;
      }

      sources.push({
        sourceModule: moduleId,
        sourceRecord: 'recommendations',
        sourceId:
          typeof recommendation.id === 'string'
            ? recommendation.id
            : `benefits-recommendation-${index}`,
        rawAction,
        priority:
          typeof recommendation.priority === 'string' ? recommendation.priority : 'medium',
        title: readOptionalString(recommendation, 'title'),
        description: readOptionalString(recommendation, 'description'),
      });
    });
  }

  return sources;
}
