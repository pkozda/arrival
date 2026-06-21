import type { NodeCatalogEntry } from './types.js';

export const ECONOMIC_NODE_CATALOG: Record<string, NodeCatalogEntry> = {
  'g1-income-assess': { satisfactionKeys: ['income_declared'] },
  'g1-residency-assess': { satisfactionKeys: ['employment_status_known'] },
  'g1-route-support': {
    satisfactionKeys: [],
    dependsOnNodeIds: ['g1-income-assess', 'g1-residency-assess'],
  },
  'g1-jobcenter-intent': {
    satisfactionKeys: ['jobcenter_case_open'],
    dependsOnNodeIds: ['g1-route-support'],
  },
  'g1-sozialamt-intent': {
    satisfactionKeys: ['benefits_active_sozialamt'],
    dependsOnNodeIds: ['g1-route-support'],
  },
  'g1-enter-system': {
    satisfactionKeys: [],
    dependsOnAnyOfNodeIds: ['g1-jobcenter-intent', 'g1-sozialamt-intent'],
  },
  'g2-registration': { satisfactionKeys: ['registration_confirmed'] },
  'g2-termination-docs': { satisfactionKeys: ['employment_status_known'] },
  'g2-jobcenter-appointment': {
    satisfactionKeys: ['jobcenter_case_open'],
    dependsOnNodeIds: ['g2-registration'],
  },
  'g2-bank-account': { satisfactionKeys: ['income_declared'] },
  'g2-first-payment': {
    satisfactionKeys: ['benefits_active_jobcenter'],
    dependsOnNodeIds: ['g2-jobcenter-appointment'],
  },
  'g3-reporting': { satisfactionKeys: ['benefits_active_jobcenter'] },
  'g3-job-search': { satisfactionKeys: ['benefits_active_jobcenter'] },
  'g3-income-changes': { satisfactionKeys: ['income_declared', 'benefits_active_jobcenter'] },
  'g3-insurance': { satisfactionKeys: ['registration_confirmed', 'benefits_active_jobcenter'] },
  'g3-transition-plan': { satisfactionKeys: ['employment_status_known', 'benefits_active_jobcenter'] },
  'g4-offer-evaluation': { satisfactionKeys: ['employment_status_known', 'income_declared'] },
  'g4-notify-jobcenter': {
    satisfactionKeys: ['benefits_active_jobcenter'],
    dependsOnNodeIds: ['g4-offer-evaluation'],
  },
  'g4-benefit-exit': {
    satisfactionKeys: ['employment_status_known'],
    dependsOnNodeIds: ['g4-notify-jobcenter'],
  },
  'g4-income-stability': {
    satisfactionKeys: ['income_declared'],
    dependsOnNodeIds: ['g4-benefit-exit'],
  },
  'g5-immediate-needs': { satisfactionKeys: [] },
  'g5-system-entry': { satisfactionKeys: ['jobcenter_case_open'] },
  'g5-registration': { satisfactionKeys: ['registration_confirmed'] },
  'g5-appointment': {
    satisfactionKeys: ['jobcenter_case_open'],
    dependsOnNodeIds: ['g5-system-entry'],
  },
  'g5-bridge-income': {
    satisfactionKeys: ['benefits_active_jobcenter'],
    dependsOnNodeIds: ['g5-appointment'],
  },
  'g6-status-confirm': { satisfactionKeys: ['employment_status_known'] },
  'g6-sozialamt-contact': {
    satisfactionKeys: ['benefits_active_sozialamt'],
    dependsOnNodeIds: ['g6-status-confirm'],
  },
  'g6-arrival-proof': { satisfactionKeys: ['registration_confirmed'] },
  'g6-payment-setup': {
    satisfactionKeys: ['income_declared', 'benefits_active_sozialamt'],
    dependsOnNodeIds: ['g6-sozialamt-contact'],
  },
  'g6-transition-awareness': { satisfactionKeys: ['benefits_active_sozialamt'] },
};

export function lookupNodeCatalogEntry(nodeId: string): NodeCatalogEntry {
  const entry = ECONOMIC_NODE_CATALOG[nodeId];
  if (!entry) {
    return { satisfactionKeys: [] };
  }
  return entry;
}
