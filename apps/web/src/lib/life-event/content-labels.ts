import type { LifeActionRef, LifeEventPlanNode, LifeEventPlanV1 } from '@/lib/product-contract';
import type { ScenarioId } from '@/lib/life-event/scenarios';
import type { CrossModuleSignalV1 } from '@/lib/life-event/runtime';
import type { SchemaField } from '@/lib/product-contract';
import { humanizeEnumValue, humanizeFieldName } from '@/lib/ux-labels';
import type { TranslateFn } from '@/lib/life-event/ui-labels';

export function resolveLocalized(t: TranslateFn, key: string, fallback: string): string {
  const value = t(key);
  return value === key ? fallback : value;
}

export function lifeEventNodeTitle(t: TranslateFn, node: Pick<LifeEventPlanNode, 'id' | 'title'>): string {
  return resolveLocalized(t, `life-event.node.${node.id}.title`, node.title);
}

export function lifeEventNodeDescription(
  t: TranslateFn,
  node: Pick<LifeEventPlanNode, 'id' | 'description'>
): string {
  return resolveLocalized(t, `life-event.node.${node.id}.description`, node.description);
}

export function lifeEventActionLabel(t: TranslateFn, action: LifeActionRef): string {
  const key =
    action.kind === 'correct_in_profile' && action.profileMirrorSlug
      ? `life-event.action.profile.${action.profileMirrorSlug}`
      : action.kind === 'open_module' && action.moduleId
        ? `life-event.action.module.${action.moduleId}`
        : action.kind === 'explore_scenario' && action.scenarioEvent
          ? `life-event.action.scenario.${action.scenarioEvent}`
          : null;

  return key ? resolveLocalized(t, key, action.label) : action.label;
}

export function lifeEventModuleTitle(t: TranslateFn, fallback: string): string {
  return resolveLocalized(t, 'life-event.module.title', fallback);
}

export function lifeEventModuleDescription(t: TranslateFn, fallback: string): string {
  return resolveLocalized(t, 'life-event.module.description', fallback);
}

export function localizeWhyThisNow(plan: LifeEventPlanV1, t: TranslateFn): string[] {
  const plannerLines = plan.reasoning.whyThisNow;
  const graphIntent = resolveLocalized(
    t,
    `life-event.graph.${plan.currentLifeState}.intent`,
    plannerLines[0] ?? ''
  );
  const focusRationale = resolveLocalized(
    t,
    `life-event.node.${plan.currentFocus.id}.rationale`,
    plannerLines[1] ?? plan.currentFocus.description
  );

  return [graphIntent, focusRationale].filter(
    (line, index, array) => line.length > 0 && array.indexOf(line) === index
  );
}

function localizeBlockerWaiting(
  t: TranslateFn,
  block: Pick<LifeEventPlanNode, 'id' | 'title'>,
  plannerFallback: string
): string {
  const localizedTitle = lifeEventNodeTitle(t, block);
  const template = t('life-event.reasoning.blocker.waiting');
  if (template === 'life-event.reasoning.blocker.waiting') {
    return plannerFallback;
  }
  return template.replace('{title}', localizedTitle);
}

export function localizeWhatIsBlocking(plan: LifeEventPlanV1, t: TranslateFn): string[] {
  const result: string[] = [];
  const plannerLines = plan.reasoning.whatIsBlocking;
  let plannerIndex = 0;

  for (const block of plan.activeBlocks) {
    const plannerFallback =
      plannerLines[plannerIndex] ?? `${block.title} is waiting on earlier steps.`;
    result.push(localizeBlockerWaiting(t, block, plannerFallback));
    plannerIndex += 1;
  }

  for (const condition of plan.secondaryConditions) {
    const plannerFallback = plannerLines[plannerIndex] ?? '';
    const localized = resolveLocalized(
      t,
      `life-event.reasoning.secondary.${condition}`,
      plannerFallback
    );
    if (localized && !result.includes(localized)) {
      result.push(localized);
    }
    plannerIndex += 1;
  }

  if (result.length === 0 && !plan.currentFocus.satisfied) {
    result.push(lifeEventNodeDescription(t, plan.currentFocus));
  }

  return result;
}

export function localizeScenarioReasoning(
  t: TranslateFn,
  scenarioId: ScenarioId | string,
  plannerFallback: string
): string {
  return resolveLocalized(t, `life-event.scenario.${scenarioId}.reasoning`, plannerFallback);
}

export function localizeRuntimeSignal(t: TranslateFn, signal: CrossModuleSignalV1): string {
  if (signal.messageKey) {
    const template = t(signal.messageKey);
    if (template !== signal.messageKey) {
      return Object.entries(signal.messageParams ?? {}).reduce(
        (text, [param, value]) => text.replace(`{${param}}`, value),
        template
      );
    }
  }
  return signal.message;
}

export function createLifeEventSchemaLabelResolver(t: TranslateFn) {
  return {
    fieldLabel(field: SchemaField, path: string): string {
      const key = `life-event.schema.field.${path}`;
      return resolveLocalized(t, key, humanizeFieldName(field.name));
    },
    enumLabel(_field: SchemaField, path: string, value: unknown): string {
      const key = `life-event.schema.enum.${path}.${String(value)}`;
      return resolveLocalized(t, key, humanizeEnumValue(value));
    },
  };
}
