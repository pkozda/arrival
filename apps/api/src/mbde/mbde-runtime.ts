import path from 'node:path';
import {
  FileBenefitGraphStore,
  GERMANY_SEED_BENEFITS,
  MbdeService,
  type BenefitGraphStorePort,
  type BenefitNode,
} from '@arrival-atlas/mbde';

let store: FileBenefitGraphStore | null = null;
let service: MbdeService | null = null;

const DEFAULT_STATE_DIR =
  process.env.ARRIVAL_ATLAS_STATE_DIR ?? path.join(process.cwd(), '.arrival-atlas-state');

export function getMbdeBenefitStore(): BenefitGraphStorePort {
  if (!store) {
    store = new FileBenefitGraphStore(path.join(DEFAULT_STATE_DIR, 'mbde-benefit-graph.json'), GERMANY_SEED_BENEFITS);
  }
  return store;
}

export async function ensureMbdeBenefitStoreLoaded(): Promise<BenefitGraphStorePort> {
  const benefitStore = getMbdeBenefitStore() as FileBenefitGraphStore;
  await benefitStore.load();
  if (benefitStore.listAll().length === 0) {
    GERMANY_SEED_BENEFITS.forEach((node: BenefitNode) => benefitStore.upsert(node));
    await benefitStore.save();
  }
  return benefitStore;
}

export function getMbdeService(): MbdeService {
  if (!service) {
    service = new MbdeService(getMbdeBenefitStore());
  }
  return service;
}

export async function ensureMbdeServiceReady(): Promise<MbdeService> {
  await ensureMbdeBenefitStoreLoaded();
  return getMbdeService();
}
