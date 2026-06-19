import { z } from 'zod';
import type { AppContext, Module, ModuleRegistration } from '@arrival-atlas/core';

export const HealthcareNavigationInputSchema = z.object({
  situation: z.enum([
    'new-arrival',
    'need-doctor',
    'need-specialist',
    'insurance-choice',
    'emergency',
    'prescription',
  ]),
  hasInsurance: z.boolean().default(false),
  insuranceType: z.enum(['public', 'private', 'none']).default('none'),
  urgency: z.enum(['routine', 'soon', 'urgent']).default('routine'),
  city: z.string().optional(),
});

export const HealthcareNavigationOutputSchema = z.object({
  scenario: z.string(),
  steps: z.array(z.object({
    order: z.number(),
    title: z.string(),
    description: z.string(),
    institution: z.string().optional(),
    documents: z.array(z.string()).optional(),
  })),
  decisions: z.array(z.object({
    title: z.string(),
    options: z.array(z.object({
      label: z.string(),
      pros: z.array(z.string()),
      cons: z.array(z.string()),
    })),
  })),
  warnings: z.array(z.string()),
});

export type HealthcareNavigationInput = z.infer<typeof HealthcareNavigationInputSchema>;
export type HealthcareNavigationOutput = z.infer<typeof HealthcareNavigationOutputSchema>;

export function resolveHealthcareNavigationLanguage(context: AppContext): string {
  const preferredLanguage = (
    context.profileSlice as { preferredLanguage?: string } | undefined
  )?.preferredLanguage;

  return preferredLanguage ?? context.userProfile?.language ?? 'en';
}

const SCENARIOS: Record<
  HealthcareNavigationInput['situation'],
  (input: HealthcareNavigationInput, lang: string) => HealthcareNavigationOutput
> = {
  'new-arrival': (_input, _lang) => ({
    scenario: 'New arrival — establishing healthcare access',
    steps: [
      {
        order: 1,
        title: 'Choose a Krankenkasse',
        description: 'Public health insurance (GKV) is mandatory. Compare funds like TK, AOK, Barmer.',
        institution: 'Krankenkasse',
        documents: ['Passport', 'Anmeldung confirmation', 'Employment contract or enrollment letter'],
      },
      {
        order: 2,
        title: 'Register for insurance',
        description: 'Apply online or in person. Coverage starts retroactively from your registration date.',
        institution: 'Krankenkasse',
      },
      {
        order: 3,
        title: 'Receive Gesundheitskarte',
        description: 'Your health card arrives by mail within 2–4 weeks. You are covered immediately upon registration.',
      },
      {
        order: 4,
        title: 'Find a Hausarzt',
        description: 'Register with a general practitioner (Hausarzt) as your primary contact.',
        documents: ['Gesundheitskarte', 'Previous medical records (if available)'],
      },
    ],
    decisions: [{
      title: 'Public vs. Private insurance',
      options: [
        {
          label: 'Public (GKV)',
          pros: ['Family coverage included', 'No pre-existing condition exclusions', 'Predictable costs'],
          cons: ['Higher contributions at higher income', 'Limited choice for some specialists'],
        },
        {
          label: 'Private (PKV)',
          pros: ['Potentially faster appointments', 'More specialist access'],
          cons: ['Expensive', 'Difficult to switch back', 'Not available for most employees under €69,300/year'],
        },
      ],
    }],
    warnings: ['Health insurance is legally mandatory — fines apply for gaps in coverage'],
  }),

  'need-doctor': (_input, _lang) => ({
    scenario: 'Finding and visiting a general practitioner',
    steps: [
      {
        order: 1,
        title: 'Search for Hausarzt',
        description: 'Use jameda.de or your Krankenkasse website to find doctors accepting new patients.',
      },
      {
        order: 2,
        title: 'Call to book Termin',
        description: 'Phone is preferred. Say: "Ich möchte einen Termin vereinbaren." Bring your Gesundheitskarte.',
        documents: ['Gesundheitskarte', 'Medication list', 'Previous test results'],
      },
      {
        order: 3,
        title: 'Attend appointment',
        description: 'Arrive 10 minutes early. The Hausarzt can refer you to specialists (Facharzt) if needed.',
      },
    ],
    decisions: [],
    warnings: ['Without insurance, a GP visit costs €80–150 out of pocket'],
  }),

  'need-specialist': (_input, _lang) => ({
    scenario: 'Accessing specialist medical care',
    steps: [
      {
        order: 1,
        title: 'Get Überweisung from Hausarzt',
        description: 'Most specialists require a referral (Überweisung) from your general practitioner.',
        documents: ['Überweisung', 'Gesundheitskarte'],
      },
      {
        order: 2,
        title: 'Book specialist appointment',
        description: 'Wait times vary (2 weeks to 3 months). For urgent cases, ask Hausarzt for "dringender Termin".',
      },
    ],
    decisions: [],
    warnings: ['Going directly to a specialist without Überweisung may not be covered by insurance'],
  }),

  'insurance-choice': (input, _lang) => ({
    scenario: 'Choosing the right health insurance',
    steps: [
      {
        order: 1,
        title: 'Check eligibility',
        description: input.insuranceType === 'none'
          ? 'As a resident, you must obtain insurance within 3 months of arrival.'
          : 'Review if your current insurance meets your needs.',
      },
      {
        order: 2,
        title: 'Compare Krankenkassen',
        description: 'All public funds offer the same medical coverage. Differences are in bonus programs and service.',
        institution: 'Krankenkasse comparison portals',
      },
    ],
    decisions: [{
      title: 'Select Krankenkasse',
      options: [
        { label: 'Techniker Krankenkasse (TK)', pros: ['Popular with expats', 'Good app', 'English support'], cons: ['Large bureaucracy'] },
        { label: 'AOK (regional)', pros: ['Local presence', 'Wide network'], cons: ['Less digital'] },
        { label: 'Barmer', pros: ['Good preventive programs'], cons: ['Average digital tools'] },
      ],
    }],
    warnings: [],
  }),

  'emergency': (_input, _lang) => ({
    scenario: 'Medical emergency',
    steps: [
      {
        order: 1,
        title: 'Life-threatening: Call 112',
        description: 'For heart attack, severe bleeding, unconsciousness — call 112 immediately.',
      },
      {
        order: 2,
        title: 'Non-life-threatening: Call 116 117',
        description: 'Medical on-call service for evenings/weekends. They direct you to the nearest open practice.',
      },
      {
        order: 3,
        title: 'Go to Notaufnahme (ER)',
        description: 'Hospital emergency rooms handle urgent cases. Bring Gesundheitskarte if available.',
        institution: 'Krankenhaus Notaufnahme',
      },
    ],
    decisions: [],
    warnings: ['ER visits for non-emergencies may result in long waits and Zuzahlung (co-payment)'],
  }),

  'prescription': (_input, _lang) => ({
    scenario: 'Getting and filling prescriptions',
    steps: [
      {
        order: 1,
        title: 'Get Rezept from doctor',
        description: 'Doctor writes prescription (Rezept). Pink = statutory insurance, blue = private, green = OTC recommendation.',
      },
      {
        order: 2,
        title: 'Fill at Apotheke',
        description: 'Any pharmacy can fill your prescription. Standard co-payment (Zuzahlung) is €5–10 per item.',
        institution: 'Apotheke',
        documents: ['Rezept', 'Gesundheitskarte'],
      },
    ],
    decisions: [],
    warnings: ['Prescription-only medications cannot be purchased at supermarkets or Drogerie'],
  }),
};

export const healthcareNavigationModule: Module<HealthcareNavigationInput, HealthcareNavigationOutput> = {
  id: 'healthcare-navigation',
  name: 'Healthcare Navigation Module',
  version: '1.0.0',
  description: 'Guides migrants through Krankenkasse, medical access, and healthcare decisions in Germany',
  inputSchema: HealthcareNavigationInputSchema,
  outputSchema: HealthcareNavigationOutputSchema,

  async execute(input, context: AppContext): Promise<HealthcareNavigationOutput> {
    const lang = resolveHealthcareNavigationLanguage(context);
    const handler = SCENARIOS[input.situation];
    const result = handler(input, lang);

    if (input.urgency === 'urgent' && input.situation !== 'emergency') {
      result.warnings.unshift('Urgent medical need — consider calling 116 117 for immediate guidance');
    }

    if (!input.hasInsurance && input.situation !== 'emergency') {
      result.warnings.push('No active insurance detected — register with a Krankenkasse as soon as possible');
    }

    return result;
  },
};

export const healthcareNavigationRegistration: ModuleRegistration = {
  ...healthcareNavigationModule,
  enabled: true,
  featureFlags: { citySpecificProviders: false },
  module: healthcareNavigationModule,
};
