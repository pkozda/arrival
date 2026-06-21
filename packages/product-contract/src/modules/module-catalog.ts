import { z } from 'zod';
import { EconomicSystemIntentSchema } from '../profile/economic-action-set.js';
import { LifeStateIdSchema } from '../profile/life-event-plan.js';
import { EconomicStateIdSchema } from '../profile/economic-evaluation.js';

export const MODULE_CATALOG_VERSION = '1.0.0' as const;

export const EconomicStateTriggerCodeSchema = z.enum([
  'E1',
  'E2',
  'E3',
  'E4',
  'E5',
  'E6',
  'E7',
]);

export type EconomicStateTriggerCode = z.infer<typeof EconomicStateTriggerCodeSchema>;

export const ECONOMIC_STATE_TRIGGER_CODE: Record<
  z.infer<typeof EconomicStateIdSchema>,
  EconomicStateTriggerCode
> = {
  self_sustained: 'E1',
  employment_active: 'E2',
  unemployment_transition: 'E3',
  benefits_jobcenter: 'E4',
  benefits_sozialamt: 'E5',
  application_pending: 'E6',
  financial_crisis: 'E7',
};

export const ModuleCatalogSurfaceSchema = z.enum(['full_page', 'overlay', 'embedded']);

export type ModuleCatalogSurface = z.infer<typeof ModuleCatalogSurfaceSchema>;

export const OpenModuleEntrypointSchema = z.enum(['auto', 'CRISIS', 'OVERVIEW', 'PRIMARY']);

export type OpenModuleEntrypoint = z.infer<typeof OpenModuleEntrypointSchema>;

export const ModuleCatalogEntrySchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  entry: z.object({
    route: z.string().min(1),
    surface: ModuleCatalogSurfaceSchema,
  }),
  triggers: z.object({
    economicStates: z.array(EconomicStateTriggerCodeSchema).optional(),
    lifeEvents: z.array(z.union([LifeStateIdSchema, z.string()])).optional(),
    lifeEventNodes: z.array(z.string()).optional(),
    systemIntents: z.array(EconomicSystemIntentSchema).optional(),
  }),
  triggerEntrypoints: z
    .object({
      economicStates: z
        .record(EconomicStateTriggerCodeSchema, OpenModuleEntrypointSchema)
        .optional(),
      lifeEventTypes: z.record(z.string(), OpenModuleEntrypointSchema).optional(),
      lifeEventNodes: z.record(z.string(), OpenModuleEntrypointSchema).optional(),
    })
    .optional(),
  dependencies: z.array(z.string()).optional(),
});

export type ModuleCatalogEntryV1 = z.infer<typeof ModuleCatalogEntrySchema>;

export const ModuleCatalogV1Schema = z.object({
  version: z.literal(MODULE_CATALOG_VERSION),
  modules: z.array(ModuleCatalogEntrySchema).min(1),
});

export type ModuleCatalogV1 = z.infer<typeof ModuleCatalogV1Schema>;

export const ECONOMIC_REALITY_MODULE_CATALOG_ENTRY: ModuleCatalogEntryV1 = {
  id: 'economic-reality',
  version: '1.0.0',
  entry: {
    route: '/modules/economic-reality',
    surface: 'full_page',
  },
  triggers: {
    economicStates: ['E3', 'E4', 'E5', 'E6', 'E7'],
    lifeEvents: [
      'economic_setup_pending',
      'arrival_unregistered',
      'arrival_stabilizing',
      'benefits_exploration',
      'arrival',
      'job_loss',
    ],
    lifeEventNodes: [
      'g2-economic-path',
      'g3-stabilize-employment',
      'g3-benefits-pathway',
      'g2-registration',
    ],
    systemIntents: [
      'start_jobcenter_process',
      'start_sozialamt_process',
      'initiate_benefit_application',
    ],
  },
  triggerEntrypoints: {
    economicStates: {
      E5: 'OVERVIEW',
      E6: 'OVERVIEW',
      E7: 'CRISIS',
    },
    lifeEventTypes: {
      arrival: 'OVERVIEW',
      job_loss: 'CRISIS',
    },
    lifeEventNodes: {
      'g2-economic-path': 'OVERVIEW',
      'g3-stabilize-employment': 'OVERVIEW',
      'g3-benefits-pathway': 'OVERVIEW',
      'g2-registration': 'OVERVIEW',
    },
  },
  dependencies: ['life-event'],
};

export const MODULE_CATALOG_V1: ModuleCatalogV1 = {
  version: MODULE_CATALOG_VERSION,
  modules: [ECONOMIC_REALITY_MODULE_CATALOG_ENTRY],
};

export type ModuleTriggerContextV1 = {
  economicStateCode?: EconomicStateTriggerCode;
  lifeStateId?: string;
  lifeEventType?: string;
  lifeEventNodeId?: string;
  systemIntents?: string[];
};

export function findModuleCatalogEntry(moduleId: string): ModuleCatalogEntryV1 | undefined {
  return MODULE_CATALOG_V1.modules.find((entry) => entry.id === moduleId);
}

export function listModuleCatalogEntries(): ModuleCatalogEntryV1[] {
  return [...MODULE_CATALOG_V1.modules];
}

export function matchesModuleTriggers(
  entry: ModuleCatalogEntryV1,
  context: ModuleTriggerContextV1
): boolean {
  if (
    context.economicStateCode &&
    entry.triggers.economicStates?.includes(context.economicStateCode)
  ) {
    return true;
  }

  if (context.lifeStateId && entry.triggers.lifeEvents?.includes(context.lifeStateId)) {
    return true;
  }

  if (context.lifeEventType && entry.triggers.lifeEvents?.includes(context.lifeEventType)) {
    return true;
  }

  if (
    context.lifeEventNodeId &&
    entry.triggers.lifeEventNodes?.includes(context.lifeEventNodeId)
  ) {
    return true;
  }

  if (context.systemIntents?.length) {
    for (const intent of context.systemIntents) {
      if (entry.triggers.systemIntents?.includes(intent as never)) {
        return true;
      }
    }
  }

  return false;
}

export function resolveTriggeredModules(context: ModuleTriggerContextV1): ModuleCatalogEntryV1[] {
  return MODULE_CATALOG_V1.modules.filter((entry) => matchesModuleTriggers(entry, context));
}

export function buildModuleCatalogRoute(
  entry: ModuleCatalogEntryV1,
  entrypoint?: OpenModuleEntrypoint
): string {
  if (!entrypoint || entrypoint === 'auto' || entrypoint === 'PRIMARY') {
    return entry.entry.route;
  }

  return `${entry.entry.route}?entry=${entrypoint}`;
}

export function resolveCatalogTriggerEntrypoint(
  entry: ModuleCatalogEntryV1,
  context: {
    economicStateCode?: EconomicStateTriggerCode;
    lifeEventType?: string;
    lifeEventNodeId?: string;
  }
): OpenModuleEntrypoint {
  if (context.economicStateCode) {
    return entry.triggerEntrypoints?.economicStates?.[context.economicStateCode] ?? 'OVERVIEW';
  }

  if (context.lifeEventType) {
    return entry.triggerEntrypoints?.lifeEventTypes?.[context.lifeEventType] ?? 'OVERVIEW';
  }

  if (context.lifeEventNodeId) {
    return entry.triggerEntrypoints?.lifeEventNodes?.[context.lifeEventNodeId] ?? 'OVERVIEW';
  }

  return 'OVERVIEW';
}

export function parseModuleCatalogV1(input: unknown): ModuleCatalogV1 {
  return ModuleCatalogV1Schema.parse(input);
}
