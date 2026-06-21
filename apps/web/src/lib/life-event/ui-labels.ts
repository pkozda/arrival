export type TranslateFn = (key: string) => string;

function resolveLifeEventLabel(t: TranslateFn, key: string, fallbackKey: string): string {
  const label = t(key);
  return label === key ? t(fallbackKey) : label;
}

export function lifeEventStateLabel(t: TranslateFn, state: string): string {
  return resolveLifeEventLabel(t, `life-event.state.${state}`, 'life-event.state.unknown');
}

export function lifeEventSeverityLabel(t: TranslateFn, severity: string): string {
  return resolveLifeEventLabel(t, `life-event.severity.${severity}`, 'life-event.severity.unknown');
}

export function lifeEventScenarioLabel(t: TranslateFn, scenarioId: string): string {
  const key = `life-event.scenario.${scenarioId}.label`;
  const label = t(key);
  return label === key ? t('life-event.scenario.contextShiftTitle') : label;
}

export function lifeEventPlanConfidenceLabel(t: TranslateFn, confidence: string): string {
  const key = `life-event.plan.confidence.${confidence}`;
  const label = t(key);
  return label === key ? t('life-event.plan.confidence.none') : label;
}

export function lifeEventKey(domain: string, id: string): string {
  return `life-event.${domain}.${id}`;
}
