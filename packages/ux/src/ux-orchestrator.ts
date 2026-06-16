export type UXSeverity = 'info' | 'warning' | 'critical';

export type UXSource =
  | 'financial-reality'
  | 'healthcare-navigation'
  | 'system-translation'
  | 'benefits-simulator'
  | 'life-event'
  | 'grocery-optimization';

export type UXNormalizedSignal = {
  domain: UXSource;
  ruleId: string;
  severity: UXSeverity;
  metadata?: Record<string, unknown>;
};

export type UXActionCard = {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  source: UXSource;
};

export type UXModuleOutput = {
  domain: UXSource;
  result: unknown;
};

export type UXActionPlan = {
  signals: UXNormalizedSignal[];
  actions: UXActionCard[];
  summary: string;
};

type ActionCardTemplate = Omit<UXActionCard, 'source'>;

const ACTION_CARD_TEMPLATES: Record<string, ActionCardTemplate> = {
  anmeldung_required: {
    id: 'anmeldung',
    title: 'Register your address (Anmeldung)',
    description:
      'You should register at the Bürgeramt as soon as possible based on your stay duration.',
    priority: 'high',
  },
  krankenkasse_required: {
    id: 'krankenkasse',
    title: 'Set up health insurance',
    description:
      'Health insurance is mandatory in Germany. Register with a public Krankenkasse or obtain eligible private coverage.',
    priority: 'high',
  },
  no_insurance: {
    id: 'choose-insurance',
    title: 'Choose health insurance provider',
    description:
      'You do not have active coverage yet. Compare public Krankenkassen and register to avoid gaps and fines.',
    priority: 'high',
  },
  buergergeld_eligible: {
    id: 'buergergeld',
    title: 'Check Bürgergeld eligibility',
    description:
      'Your income may qualify for Bürgergeld support. Contact your local Jobcenter for a Beratungsgespräch.',
    priority: 'high',
  },
  wohngeld_eligible: {
    id: 'wohngeld',
    title: 'Explore Wohngeld housing support',
    description:
      'Housing costs may exceed what your income can support. Apply for Wohngeld at your local Wohngeldstelle.',
    priority: 'medium',
  },
  term_lookup: {
    id: 'translation-info',
    title: 'Learn key administrative terms',
    description:
      'Review translated definitions to understand the terms affecting your next steps in Germany.',
    priority: 'low',
  },
};

/** Lower index = higher urgency in the action plan. */
const SIGNAL_PRIORITY_ORDER: string[] = [
  'anmeldung_required',
  'krankenkasse_required',
  'no_insurance',
  'buergergeld_eligible',
  'wohngeld_eligible',
  'term_lookup',
];

const INSURANCE_CARD_IDS = new Set(['krankenkasse', 'choose-insurance']);

function signalKey(signal: UXNormalizedSignal): string {
  return `${signal.domain}:${signal.ruleId}`;
}

function dedupeSignals(signals: UXNormalizedSignal[]): UXNormalizedSignal[] {
  const seen = new Set<string>();
  const deduped: UXNormalizedSignal[] = [];

  for (const signal of signals) {
    const key = signalKey(signal);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(signal);
  }

  return deduped;
}

function sortSignals(signals: UXNormalizedSignal[]): UXNormalizedSignal[] {
  return [...signals].sort((a, b) => {
    const aIndex = SIGNAL_PRIORITY_ORDER.indexOf(a.ruleId);
    const bIndex = SIGNAL_PRIORITY_ORDER.indexOf(b.ruleId);
    const aRank = aIndex === -1 ? SIGNAL_PRIORITY_ORDER.length : aIndex;
    const bRank = bIndex === -1 ? SIGNAL_PRIORITY_ORDER.length : bIndex;

    if (aRank !== bRank) return aRank - bRank;

    const severityRank: Record<UXSeverity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };

    return severityRank[a.severity] - severityRank[b.severity];
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function hasExplicitRule(result: Record<string, unknown>, ruleId: string): boolean {
  if (result.rule === ruleId) return true;

  const rules = result.rules;
  return Array.isArray(rules) && rules.includes(ruleId);
}

function normalizeFinancialReality(result: unknown): UXNormalizedSignal[] {
  const data = asRecord(result);
  if (!data) return [];

  const signals: UXNormalizedSignal[] = [];

  if (hasExplicitRule(data, 'anmeldung_required')) {
    signals.push({
      domain: 'financial-reality',
      ruleId: 'anmeldung_required',
      severity: 'critical',
      metadata: { daysInGermany: data.daysInGermany },
    });
  }

  if (hasExplicitRule(data, 'krankenkasse_required')) {
    signals.push({
      domain: 'financial-reality',
      ruleId: 'krankenkasse_required',
      severity: 'critical',
    });
  }

  const adminRules = data.adminRules;
  if (Array.isArray(adminRules)) {
    for (const rule of adminRules) {
      if (typeof rule !== 'string') continue;

      if (rule.includes('Anmeldung')) {
        signals.push({
          domain: 'financial-reality',
          ruleId: 'anmeldung_required',
          severity: 'critical',
        });
      }

      if (rule.includes('Krankenversicherung') || rule.includes('Krankenkasse')) {
        signals.push({
          domain: 'financial-reality',
          ruleId: 'krankenkasse_required',
          severity: 'critical',
        });
      }

      if (rule.includes('Bürgergeld')) {
        signals.push({
          domain: 'financial-reality',
          ruleId: 'buergergeld_eligible',
          severity: 'warning',
        });
      }
    }
  }

  const decisions = data.decisions;
  if (Array.isArray(decisions)) {
    for (const decision of decisions) {
      const entry = asRecord(decision);
      if (!entry) continue;

      const title = typeof entry.title === 'string' ? entry.title : '';
      const action = typeof entry.action === 'string' ? entry.action : '';

      if (title.includes('Bürgergeld')) {
        signals.push({
          domain: 'financial-reality',
          ruleId: 'buergergeld_eligible',
          severity: 'warning',
        });
      }

      if (title.includes('Wohngeld') || action.includes('Wohngeld')) {
        signals.push({
          domain: 'financial-reality',
          ruleId: 'wohngeld_eligible',
          severity: 'warning',
        });
      }
    }
  }

  const benefits = asRecord(data.benefits);
  const buergergeld = benefits ? asRecord(benefits.buergergeld) : null;
  if (buergergeld?.eligible === true) {
    signals.push({
      domain: 'financial-reality',
      ruleId: 'buergergeld_eligible',
      severity: 'warning',
    });
  }

  return dedupeSignals(signals);
}

function normalizeHealthcareNavigation(result: unknown): UXNormalizedSignal[] {
  const data = asRecord(result);
  if (!data) return [];

  if (
    data.status === 'insurance_confirmed' ||
    data.insuranceStatus === 'insurance_confirmed' ||
    data.rule === 'insurance_confirmed'
  ) {
    return [];
  }

  if (data.hasInsurance === true) {
    return [];
  }

  const hasNoInsuranceSignal =
    data.status === 'no_insurance' ||
    data.insuranceStatus === 'no_insurance' ||
    data.rule === 'no_insurance' ||
    data.hasInsurance === false;

  const warnings = data.warnings;
  const warningIndicatesGap =
    Array.isArray(warnings) &&
    warnings.some(
      (warning) => typeof warning === 'string' && warning.includes('No active insurance')
    );

  if (!hasNoInsuranceSignal && !warningIndicatesGap) {
    return [];
  }

  return [
    {
      domain: 'healthcare-navigation',
      ruleId: 'no_insurance',
      severity: 'warning',
    },
  ];
}

function normalizeSystemTranslation(result: unknown): UXNormalizedSignal[] {
  const data = asRecord(result);
  if (!data) return [];

  const explicitlyRequested =
    data.includeInfo === true || data.requested === true || data.generateInfoCard === true;

  if (!explicitlyRequested) {
    return [];
  }

  const results = data.results;
  const firstResult = Array.isArray(results) ? asRecord(results[0]) : null;

  return [
    {
      domain: 'system-translation',
      ruleId: 'term_lookup',
      severity: 'info',
      metadata: firstResult?.term ? { term: firstResult.term } : undefined,
    },
  ];
}

function normalizeModuleOutput(domain: UXSource, result: unknown): UXNormalizedSignal[] {
  switch (domain) {
    case 'financial-reality':
      return normalizeFinancialReality(result);
    case 'healthcare-navigation':
      return normalizeHealthcareNavigation(result);
    case 'system-translation':
      return normalizeSystemTranslation(result);
    default:
      return [];
  }
}

function signalsToActionCards(signals: UXNormalizedSignal[]): UXActionCard[] {
  const cards: UXActionCard[] = [];
  const seenCardIds = new Set<string>();

  for (const signal of signals) {
    const template = ACTION_CARD_TEMPLATES[signal.ruleId];
    if (!template) continue;

    if (seenCardIds.has(template.id)) continue;

    if (template.id === 'choose-insurance' && seenCardIds.has('krankenkasse')) {
      continue;
    }

    seenCardIds.add(template.id);
    cards.push({
      ...template,
      source: signal.domain,
    });
  }

  return cards;
}

function describeAction(action: UXActionCard): string {
  switch (action.id) {
    case 'anmeldung':
      return 'register your address at the Bürgeramt';
    case 'krankenkasse':
    case 'choose-insurance':
      return 'confirm your health insurance';
    case 'buergergeld':
      return 'check your Bürgergeld eligibility with the Jobcenter';
    case 'wohngeld':
      return 'explore Wohngeld housing support';
    case 'translation-info':
      return 'review key administrative terms';
    default:
      return action.title.toLowerCase();
  }
}

function buildSummary(actions: UXActionCard[]): string {
  const topActions = actions.filter((action) => action.priority === 'high').slice(0, 2);

  if (topActions.length === 0) {
    const fallback = actions.filter((action) => action.priority === 'medium').slice(0, 2);
    if (fallback.length === 0) {
      return 'No urgent actions identified at this time.';
    }

    const phrases = fallback.map(describeAction);
    if (phrases.length === 1) {
      return `You should ${phrases[0]} as your next step in Germany.`;
    }

    return `You should ${phrases[0]} and ${phrases[1]} as your next steps in Germany.`;
  }

  const phrases = topActions.map(describeAction);

  if (phrases.length === 1) {
    return `You should ${phrases[0]}. This is your most urgent administrative step in Germany.`;
  }

  const hasAdministrativePair =
    topActions.some((action) => action.id === 'anmeldung') &&
    topActions.some((action) => INSURANCE_CARD_IDS.has(action.id));

  if (hasAdministrativePair) {
    return 'You should register your address at the Bürgeramt and confirm your health insurance. These are your most urgent administrative steps in Germany.';
  }

  return `You should ${phrases[0]} and ${phrases[1]}. These are your most urgent next steps in Germany.`;
}

export function buildUXActionPlan(moduleOutputs: UXModuleOutput[]): UXActionPlan {
  const signals = sortSignals(
    dedupeSignals(
      moduleOutputs.flatMap(({ domain, result }) => normalizeModuleOutput(domain, result))
    )
  );

  const actions = signalsToActionCards(signals);

  return {
    signals,
    actions,
    summary: buildSummary(actions),
  };
}
