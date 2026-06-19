import { z } from 'zod';
import type { AppContext, Module, ModuleRegistration } from '@arrival-atlas/core';

export const LifeEventInputSchema = z.object({
  event: z.enum([
    'arrival',
    'job-change',
    'job-loss',
    'marriage',
    'childbirth',
    'move-city',
    'visa-renewal',
    'divorce',
  ]),
  timeline: z.enum(['immediate', 'within-month', 'within-3-months', 'planning']).default('planning'),
  hasPartner: z.boolean().default(false),
  hasChildren: z.boolean().default(false),
  currentStatus: z.object({
    employed: z.boolean().default(false),
    insured: z.boolean().default(false),
    registered: z.boolean().default(false),
  }).default({}),
});

export const LifeEventOutputSchema = z.object({
  event: z.string(),
  timeline: z.string(),
  phases: z.array(z.object({
    phase: z.string(),
    timeframe: z.string(),
    actions: z.array(z.object({
      title: z.string(),
      description: z.string(),
      institution: z.string().optional(),
      deadline: z.string().optional(),
      priority: z.enum(['critical', 'important', 'recommended']),
    })),
  })),
  scenarios: z.array(z.object({
    name: z.string(),
    description: z.string(),
    outcomes: z.array(z.string()),
  })),
  checklist: z.array(z.object({
    item: z.string(),
    completed: z.boolean(),
    category: z.string(),
  })),
});

export type LifeEventInput = z.infer<typeof LifeEventInputSchema>;
export type LifeEventOutput = z.infer<typeof LifeEventOutputSchema>;

const EVENT_HANDLERS: Record<
  LifeEventInput['event'],
  (input: LifeEventInput) => LifeEventOutput
> = {
  arrival: (input) => ({
    event: 'Initial arrival in Germany',
    timeline: input.timeline,
    phases: [
      {
        phase: 'First 2 weeks',
        timeframe: 'Days 1–14',
        actions: [
          { title: 'Anmeldung (Registration)', description: 'Register at Bürgeramt within 14 days of moving', institution: 'Bürgeramt', deadline: '14 days after move-in', priority: 'critical' },
          { title: 'Open bank account', description: 'Required for salary, rent, and benefits. N26, DKB, or Sparkasse.', priority: 'critical' },
          { title: 'Health insurance', description: 'Register with Krankenkasse — mandatory, retroactive coverage', institution: 'Krankenkasse', deadline: '3 months', priority: 'critical' },
        ],
      },
      {
        phase: 'First month',
        timeframe: 'Days 15–30',
        actions: [
          { title: 'Tax ID (Steuer-ID)', description: 'Arrives by mail automatically after Anmeldung — needed for employment', priority: 'important' },
          { title: 'SIM card & internet', description: 'Prepaid (Aldi Talk, Lidl Connect) or contract', priority: 'recommended' },
          { title: 'Rundfunkbeitrag', description: 'Broadcast fee (€18.36/month) — register or declare exemption', institution: 'Beitragsservice', priority: 'important' },
        ],
      },
      {
        phase: 'First 3 months',
        timeframe: 'Days 31–90',
        actions: [
          { title: 'Find Hausarzt', description: 'Register with a general practitioner', priority: 'recommended' },
          { title: 'Integration course', description: 'Check eligibility for subsidized German language courses (BAMF)', institution: 'BAMF', priority: 'recommended' },
        ],
      },
    ],
    scenarios: [
      { name: 'With job offer', description: 'Employer may assist with Anmeldung and insurance', outcomes: ['Faster Steuerklasse assignment', 'Employer may provide Betriebsarzt'] },
      { name: 'Without employment', description: 'Must self-organize all registrations', outcomes: ['May need Jobcenter for Bürgergeld', 'Must proactively register for insurance'] },
    ],
    checklist: [
      { item: 'Anmeldung completed', completed: input.currentStatus.registered, category: 'administrative' },
      { item: 'Health insurance active', completed: input.currentStatus.insured, category: 'healthcare' },
      { item: 'Bank account opened', completed: false, category: 'financial' },
      { item: 'Tax ID received', completed: false, category: 'financial' },
    ],
  }),

  'job-change': (input) => ({
    event: 'Changing employment',
    timeline: input.timeline,
    phases: [
      {
        phase: 'Before leaving',
        timeframe: 'Last 2 weeks at old job',
        actions: [
          { title: 'Request Arbeitszeugnis', description: 'Legal right to a written employment reference', priority: 'critical' },
          { title: 'Check notice period', description: 'Standard is 4 weeks to end of month, varies by contract', priority: 'critical' },
          { title: 'Inform Krankenkasse', description: 'Old employer deregisters you — ensure no gap in coverage', institution: 'Krankenkasse', priority: 'important' },
        ],
      },
      {
        phase: 'Transition',
        timeframe: 'Between jobs',
        actions: [
          { title: 'Register with Agentur für Arbeit', description: 'If gap > 1 day, register as arbeitssuchend to maintain insurance', institution: 'Agentur für Arbeit', priority: 'critical' },
          { title: 'Update Finanzamt', description: 'New employer will submit tax info — verify Steuerklasse', priority: 'important' },
        ],
      },
    ],
    scenarios: [
      { name: 'Direct transition', description: 'New job starts immediately after old one', outcomes: ['Seamless insurance continuation', 'No ALG I needed'] },
      { name: 'Gap period', description: 'Unemployment between jobs', outcomes: ['Register for ALG I if eligible', 'Must register arbeitssuchend within 3 days'] },
    ],
    checklist: [
      { item: 'Arbeitszeugnis received', completed: false, category: 'employment' },
      { item: 'New employer contract signed', completed: false, category: 'employment' },
      { item: 'Krankenkasse updated', completed: false, category: 'healthcare' },
    ],
  }),

  'job-loss': () => ({
    event: 'Job loss / unemployment',
    timeline: 'immediate',
    phases: [
      {
        phase: 'Immediate (first 3 days)',
        timeframe: 'Days 1–3',
        actions: [
          { title: 'Register as arbeitssuchend', description: 'Mandatory within 3 days of knowing about job loss', institution: 'Agentur für Arbeit', deadline: '3 days', priority: 'critical' },
          { title: 'Apply for ALG I', description: 'Unemployment benefit if you worked 12+ months in last 2 years', institution: 'Agentur für Arbeit', priority: 'critical' },
        ],
      },
      {
        phase: 'First month',
        timeframe: 'Weeks 1–4',
        actions: [
          { title: 'Evaluate Bürgergeld', description: 'If ALG I insufficient, apply for Bürgergeld at Jobcenter', institution: 'Jobcenter', priority: 'important' },
          { title: 'Review expenses', description: 'Use Financial Reality module to assess budget gap', priority: 'important' },
        ],
      },
    ],
    scenarios: [
      { name: 'Eligible for ALG I', description: '12+ months employment in last 2 years', outcomes: ['60–67% of net salary for 6–12 months', 'Health insurance continues'] },
      { name: 'Not eligible for ALG I', description: 'Insufficient employment history', outcomes: ['Apply for Bürgergeld immediately', 'Jobcenter manages case'] },
    ],
    checklist: [
      { item: 'Registered arbeitssuchend', completed: false, category: 'employment' },
      { item: 'ALG I application submitted', completed: false, category: 'financial' },
      { item: 'Budget reviewed', completed: false, category: 'financial' },
    ],
  }),

  marriage: (input) => ({
    event: 'Getting married in Germany',
    timeline: input.timeline,
    phases: [
      {
        phase: 'Preparation',
        timeframe: '1–3 months before',
        actions: [
          { title: 'Gather documents', description: 'Birth certificate (apostilled + translated), passport, Meldebescheinigung', institution: 'Standesamt', priority: 'critical' },
          { title: 'Schedule Standesamt appointment', description: 'Civil ceremony at local registry office', institution: 'Standesamt', priority: 'critical' },
        ],
      },
      {
        phase: 'After marriage',
        timeframe: 'Within 1 month',
        actions: [
          { title: 'Update Steuerklasse', description: 'Married couples can choose III/V or IV/IV for tax optimization', institution: 'Finanzamt', priority: 'important' },
          { title: 'Update Krankenkasse', description: 'Add spouse to family insurance if eligible', institution: 'Krankenkasse', priority: 'important' },
          { title: 'Update Anmeldung if moving', description: 'If changing address, re-register at Bürgeramt', priority: 'recommended' },
        ],
      },
    ],
    scenarios: [
      { name: 'Both employed', description: 'Dual income household', outcomes: ['Steuerklasse IV/IV with Faktor may be optimal', 'Both keep individual insurance'] },
      { name: 'One partner not working', description: 'Single income household', outcomes: ['Steuerklasse III/V often beneficial', 'Non-working spouse covered by family insurance'] },
    ],
    checklist: [
      { item: 'Documents prepared', completed: false, category: 'administrative' },
      { item: 'Standesamt appointment booked', completed: false, category: 'administrative' },
      { item: 'Steuerklasse updated', completed: false, category: 'financial' },
    ],
  }),

  childbirth: (input) => ({
    event: 'Having a child in Germany',
    timeline: input.timeline,
    phases: [
      {
        phase: 'During pregnancy',
        timeframe: 'Pregnancy',
        actions: [
          { title: 'Find Frauenarzt / Hebamme', description: 'Gynecologist and midwife are covered by insurance', institution: 'Frauenarzt', priority: 'critical' },
          { title: 'Notify employer', description: 'Inform employer of pregnancy — special protections apply (Mutterschutz)', priority: 'important' },
          { title: 'Apply for Elterngeld', description: 'Parental allowance — up to 14 months shared between parents', institution: 'Elterngeldstelle', priority: 'important' },
        ],
      },
      {
        phase: 'After birth',
        timeframe: 'First 3 months',
        actions: [
          { title: 'Register birth (Geburtsanzeige)', description: 'Hospital or Standesamt registers the birth', institution: 'Standesamt', deadline: '1 week', priority: 'critical' },
          { title: 'Apply for Kindergeld', description: 'Child benefit €250/month per child', institution: 'Familienkasse', priority: 'critical' },
          { title: 'Add child to Krankenkasse', description: 'Free family coverage for children', institution: 'Krankenkasse', priority: 'critical' },
        ],
      },
    ],
    scenarios: [
      { name: 'Both parents employed', description: 'Split Elternzeit and Elterngeld', outcomes: ['Up to 14 months Elterngeld with Partnermonate', 'Mutterschutz: 6 weeks before + 8 weeks after birth paid'] },
      { name: 'Single parent', description: 'Sole caregiver', outcomes: ['12 months Elterngeld', 'Additional support via Unterhaltsvorschuss if needed'] },
    ],
    checklist: [
      { item: 'Frauenarzt registered', completed: false, category: 'healthcare' },
      { item: 'Elterngeld application prepared', completed: false, category: 'financial' },
      { item: 'Kindergeld application ready', completed: false, category: 'financial' },
    ],
  }),

  'move-city': () => ({
    event: 'Moving to a new city in Germany',
    timeline: 'immediate',
    phases: [
      {
        phase: 'Before move',
        timeframe: '2–4 weeks before',
        actions: [
          { title: 'Find new apartment', description: 'Ensure Wohnungsgeberbestätigung is included in contract', priority: 'critical' },
          { title: 'Cancel/transfer utilities', description: 'Internet, electricity, Rundfunkbeitrag address change', priority: 'important' },
        ],
      },
      {
        phase: 'After move',
        timeframe: 'First 2 weeks',
        actions: [
          { title: 'Ummeldung (Re-registration)', description: 'Register new address at Bürgeramt in new city — within 14 days', institution: 'Bürgeramt', deadline: '14 days', priority: 'critical' },
          { title: 'Update Krankenkasse address', description: 'Insurance follows you — update address for new Gesundheitskarte', priority: 'important' },
          { title: 'Find new Hausarzt', description: 'Register with GP in new city', priority: 'recommended' },
        ],
      },
    ],
    scenarios: [],
    checklist: [
      { item: 'New apartment secured', completed: false, category: 'housing' },
      { item: 'Ummeldung completed', completed: false, category: 'administrative' },
      { item: 'Utilities transferred', completed: false, category: 'housing' },
    ],
  }),

  'visa-renewal': () => ({
    event: 'Visa / residence permit renewal',
    timeline: 'within-3-months',
    phases: [
      {
        phase: 'Preparation',
        timeframe: '3 months before expiry',
        actions: [
          { title: 'Check expiry date', description: 'Start renewal process at least 8 weeks before visa expires', priority: 'critical' },
          { title: 'Gather documents', description: 'Passport, current permit, employment contract, Gehaltsabrechnungen, rental contract, Krankenversicherung proof', institution: 'Ausländerbehörde', priority: 'critical' },
          { title: 'Book appointment', description: 'Ausländerbehörde appointments are scarce — book early', institution: 'Ausländerbehörde', priority: 'critical' },
        ],
      },
    ],
    scenarios: [
      { name: 'Employed with permanent contract', description: 'Strong renewal case', outcomes: ['Likely smooth renewal', 'May qualify for Niederlassungserlaubnis after 4 years'] },
      { name: 'Student visa extension', description: 'Extending for studies', outcomes: ['Need proof of enrollment and Finanzierung', 'Part-time work limited to 140 full / 280 half days per year'] },
    ],
    checklist: [
      { item: 'Appointment booked', completed: false, category: 'administrative' },
      { item: 'Documents gathered', completed: false, category: 'administrative' },
      { item: 'Health insurance proof ready', completed: false, category: 'healthcare' },
    ],
  }),

  divorce: () => ({
    event: 'Divorce in Germany',
    timeline: 'planning',
    phases: [
      {
        phase: 'Legal process',
        timeframe: 'Months 1–12',
        actions: [
          { title: 'Consult lawyer (Familienrecht)', description: 'Legal separation year required before divorce (Trennungsjahr)', priority: 'critical' },
          { title: 'Update Steuerklasse', description: 'Revert to Steuerklasse I after separation', institution: 'Finanzamt', priority: 'important' },
          { title: 'Resolve Versorgungsausgleich', description: 'Pension equalization if married 3+ years', priority: 'important' },
        ],
      },
    ],
    scenarios: [],
    checklist: [
      { item: 'Legal counsel consulted', completed: false, category: 'administrative' },
      { item: 'Steuerklasse updated', completed: false, category: 'financial' },
      { item: 'Separate bank accounts established', completed: false, category: 'financial' },
    ],
  }),
};

export const lifeEventModule: Module<LifeEventInput, LifeEventOutput> = {
  id: 'life-event',
  name: 'Life Event Module',
  version: '1.0.0',
  description: 'Scenario-based guidance and action plans for major life changes in Germany',
  inputSchema: LifeEventInputSchema,
  outputSchema: LifeEventOutputSchema,

  async execute(input, _context: AppContext): Promise<LifeEventOutput> {
    const handler = EVENT_HANDLERS[input.event];
    return handler(input);
  },
};

export const lifeEventRegistration: ModuleRegistration = {
  ...lifeEventModule,
  enabled: true,
  featureFlags: { personalizedTimeline: false },
  module: lifeEventModule,
};
