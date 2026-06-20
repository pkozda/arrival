import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GRAPH_CATALOG_V1 } from '@arrival-atlas/modules/life-event';

const root = join(dirname(fileURLToPath(import.meta.url)), '../src/i18n/life-event-content');
mkdirSync(root, { recursive: true });

const en = {};

function add(key, value) {
  en[key] = value;
}

add('life-event.module.title', 'Life Event Module');
add('life-event.module.description', 'Scenario-based guidance and action plans for major life changes in Germany');
add('life-event.explorer.title', 'Explore life scenarios');
add('life-event.explorer.description', 'Run a guided scenario for a specific life change. This is separate from your personalized plan above.');
add('life-event.explorer.schemaError', 'Unable to load scenarios');
add('life-event.reasoning.blocker.waiting', '{title} is waiting on earlier steps.');

const secondary = {
  registration_incomplete: 'Registration is not complete yet.',
  insurance_gap: 'Health insurance coverage needs attention.',
  housing_data_missing: 'Housing details are incomplete for planning.',
  housing_search_active: 'You are still looking for stable housing.',
  employment_data_missing: 'Employment information is missing.',
  income_data_missing: 'Income details are not recorded yet.',
  benefits_data_missing: 'Benefits information has not been assessed.',
  household_data_missing: 'Household details are incomplete.',
  banking_not_established: 'A suitable bank account is not set up yet.',
  re_registration_required: 'You need to re-register after your move.',
  life_transition_pending: 'A life change may require additional admin steps.',
  low_planning_confidence: 'Some situation details may need review for accuracy.',
  economic_setup_pending: 'Employment and income foundation still needs attention.',
};
for (const [id, text] of Object.entries(secondary)) {
  add(`life-event.reasoning.secondary.${id}`, text);
}

const scenarios = {
  job_loss: 'Losing employment shifts your situation toward economic setup — income, insurance, and benefits need reassessment.',
  new_arrival: 'A recent arrival without completed registration places you in the unregistered arrival state.',
  housing_change: 'An active housing change or incomplete housing data moves your situation toward housing instability.',
  insurance_loss: 'Missing or lost health insurance coverage creates an insurance gap that needs immediate attention.',
  income_drop: 'A significant income reduction signals that your economic setup may need to be revisited.',
  benefits_trigger: 'Changes in employment or missing benefits data suggest exploring available support options.',
  stability_restore: 'Core situation signals are in place — your profile is trending toward a stable state.',
};
for (const [id, text] of Object.entries(scenarios)) {
  add(`life-event.scenario.${id}.reasoning`, text);
}

const schema = {
  'life-event.schema.field.event': 'Event',
  'life-event.schema.field.timeline': 'Timeline',
  'life-event.schema.field.hasPartner': 'Partner',
  'life-event.schema.field.hasChildren': 'Children',
  'life-event.schema.field.currentStatus': 'Current Status',
  'life-event.schema.field.currentStatus.employed': 'Employed',
  'life-event.schema.field.currentStatus.insured': 'Insured',
  'life-event.schema.field.currentStatus.registered': 'Registered',
  'life-event.schema.enum.event.arrival': 'Arrival',
  'life-event.schema.enum.event.job-change': 'Job change',
  'life-event.schema.enum.event.job-loss': 'Job loss',
  'life-event.schema.enum.event.marriage': 'Marriage',
  'life-event.schema.enum.event.childbirth': 'Childbirth',
  'life-event.schema.enum.event.move-city': 'Move city',
  'life-event.schema.enum.event.visa-renewal': 'Visa renewal',
  'life-event.schema.enum.event.divorce': 'Divorce',
  'life-event.schema.enum.timeline.immediate': 'Immediate',
  'life-event.schema.enum.timeline.within-month': 'Within month',
  'life-event.schema.enum.timeline.within-3-months': 'Within 3 months',
  'life-event.schema.enum.timeline.planning': 'Planning',
};
Object.assign(en, schema);

const runtime = {
  'life-event.runtime.signal.housingBenefitsUnlock': 'Housing context updated — benefits tools may now be more relevant.',
  'life-event.runtime.signal.registrationInsuranceUnlock': 'Registration progress may unlock insurance guidance.',
  'life-event.runtime.signal.insuranceSoftenEconomic': 'Insurance update may soften economic setup pressure.',
  'life-event.runtime.signal.insuranceFailedBlock': 'Insurance step did not complete — economic setup may remain blocked.',
  'life-event.runtime.signal.employmentStability': 'Employment or income update completed — situation may trend toward stability.',
  'life-event.runtime.signal.moduleCompleted': 'Module {moduleId} action completed.',
};
Object.assign(en, runtime);

for (const graph of GRAPH_CATALOG_V1) {
  add(`life-event.graph.${graph.lifeStateId}.intent`, graph.intent);
  for (const node of graph.nodes) {
    add(`life-event.node.${node.id}.title`, node.title);
    add(`life-event.node.${node.id}.description`, node.description);
    add(`life-event.node.${node.id}.rationale`, node.rationale);
    for (const action of node.actions) {
      const key =
        action.kind === 'correct_in_profile'
          ? `life-event.action.profile.${action.profileMirrorSlug}`
          : action.kind === 'open_module'
            ? `life-event.action.module.${action.moduleId}`
            : `life-event.action.scenario.${action.scenarioEvent}`;
      add(key, action.label);
    }
  }
}

writeFileSync(join(root, 'en.json'), `${JSON.stringify(en, null, 2)}\n`);
console.log(`Wrote ${Object.keys(en).length} English life-event content keys`);
