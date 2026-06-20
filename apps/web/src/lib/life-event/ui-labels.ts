export type TranslateFn = (key: string) => string;

export function lifeEventStateLabel(t: TranslateFn, state: string): string {
  return t(`life-event.state.${state}`);
}

export function lifeEventSeverityLabel(t: TranslateFn, severity: string): string {
  return t(`life-event.severity.${severity}`);
}

export function lifeEventPlanConfidenceLabel(t: TranslateFn, confidence: string): string {
  const key = `life-event.plan.confidence.${confidence}`;
  const label = t(key);
  return label === key ? t('life-event.plan.confidence.none') : label;
}

export function lifeEventKey(domain: string, id: string): string {
  return `life-event.${domain}.${id}`;
}
