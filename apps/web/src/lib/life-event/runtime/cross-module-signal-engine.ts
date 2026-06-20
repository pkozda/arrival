import type { CrossModuleSignalV1, ModuleRuntimeEventV1 } from './types';

type SignalRule = {
  matches: (event: ModuleRuntimeEventV1) => boolean;
  build: (event: ModuleRuntimeEventV1) => CrossModuleSignalV1;
};

function metadataDomain(event: ModuleRuntimeEventV1): string | undefined {
  const domain = event.execution.metadata?.domain;
  return typeof domain === 'string' ? domain : undefined;
}

const SIGNAL_RULES: SignalRule[] = [
  {
    matches: (event) =>
      event.execution.status === 'success' &&
      (event.execution.moduleId === 'financial-reality' || metadataDomain(event) === 'housing'),
    build: (event) => ({
      signalType: 'dependency_unlocked',
      sourceModuleId: event.execution.moduleId,
      targetModuleId: 'benefits-simulator',
      actionId: event.execution.actionId,
      message: 'Housing context updated — benefits tools may now be more relevant.',
      messageKey: 'life-event.runtime.signal.housingBenefitsUnlock',
      advisoryOnly: true,
    }),
  },
  {
    matches: (event) =>
      event.execution.status === 'success' &&
      (event.execution.moduleId === 'life-event' || metadataDomain(event) === 'registration'),
    build: (event) => ({
      signalType: 'dependency_unlocked',
      sourceModuleId: event.execution.moduleId,
      targetModuleId: 'healthcare-navigation',
      actionId: event.execution.actionId,
      message: 'Registration progress may unlock insurance guidance.',
      messageKey: 'life-event.runtime.signal.registrationInsuranceUnlock',
      advisoryOnly: true,
    }),
  },
  {
    matches: (event) =>
      event.execution.status === 'success' &&
      (event.execution.moduleId === 'healthcare-navigation' || metadataDomain(event) === 'insurance'),
    build: (event) => ({
      signalType: 'partial_resolution',
      sourceModuleId: event.execution.moduleId,
      targetModuleId: 'financial-reality',
      actionId: event.execution.actionId,
      message: 'Insurance update may soften economic setup pressure.',
      messageKey: 'life-event.runtime.signal.insuranceSoftenEconomic',
      advisoryOnly: true,
    }),
  },
  {
    matches: (event) =>
      event.execution.status === 'failed' &&
      (event.execution.moduleId === 'healthcare-navigation' || metadataDomain(event) === 'insurance'),
    build: (event) => ({
      signalType: 'regression_detected',
      sourceModuleId: event.execution.moduleId,
      targetModuleId: 'financial-reality',
      actionId: event.execution.actionId,
      message: 'Insurance step did not complete — economic setup may remain blocked.',
      messageKey: 'life-event.runtime.signal.insuranceFailedBlock',
      advisoryOnly: true,
    }),
  },
  {
    matches: (event) =>
      event.execution.status === 'success' &&
      (event.execution.moduleId === 'financial-reality' || metadataDomain(event) === 'employment'),
    build: (event) => ({
      signalType: 'stabilization_hint',
      sourceModuleId: event.execution.moduleId,
      actionId: event.execution.actionId,
      message: 'Employment or income update completed — situation may trend toward stability.',
      messageKey: 'life-event.runtime.signal.employmentStability',
      advisoryOnly: true,
    }),
  },
  {
    matches: (event) => event.execution.status === 'success',
    build: (event) => ({
      signalType: 'completion_signal',
      sourceModuleId: event.execution.moduleId,
      actionId: event.execution.actionId,
      message: `Module ${event.execution.moduleId} action completed.`,
      messageKey: 'life-event.runtime.signal.moduleCompleted',
      messageParams: { moduleId: event.execution.moduleId },
      advisoryOnly: true,
    }),
  },
];

export function generateCrossModuleSignals(event: ModuleRuntimeEventV1): CrossModuleSignalV1[] {
  const signals: CrossModuleSignalV1[] = [];
  const seen = new Set<string>();

  for (const rule of SIGNAL_RULES) {
    if (!rule.matches(event)) {
      continue;
    }

    const signal = rule.build(event);
    const key = `${signal.signalType}:${signal.sourceModuleId}:${signal.targetModuleId ?? 'none'}:${signal.actionId}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    signals.push(signal);
  }

  return signals.sort((left, right) =>
    `${left.signalType}:${left.sourceModuleId}`.localeCompare(
      `${right.signalType}:${right.sourceModuleId}`
    )
  );
}
