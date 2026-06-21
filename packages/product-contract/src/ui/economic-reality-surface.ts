import { z } from 'zod';

export const ECONOMIC_REALITY_SURFACE_MODULE_ID = 'economic-reality' as const;
export const ECONOMIC_REALITY_SURFACE_VERSION = '1.0.0' as const;

export const EconomicRealitySurfaceEntrypointTypeSchema = z.enum(['full_page', 'embedded_card']);
export type EconomicRealitySurfaceEntrypointType = z.infer<
  typeof EconomicRealitySurfaceEntrypointTypeSchema
>;

export const EconomicRealitySurfaceDefaultViewSchema = z.enum(['PRIMARY', 'OVERVIEW', 'CRISIS']);
export type EconomicRealitySurfaceDefaultView = z.infer<
  typeof EconomicRealitySurfaceDefaultViewSchema
>;

export const EconomicRealitySurfaceV1Schema = z.object({
  moduleId: z.literal(ECONOMIC_REALITY_SURFACE_MODULE_ID),
  version: z.literal(ECONOMIC_REALITY_SURFACE_VERSION),
  entrypoint: z.object({
    type: EconomicRealitySurfaceEntrypointTypeSchema,
    defaultView: EconomicRealitySurfaceDefaultViewSchema,
  }),
  capabilities: z.object({
    supportsRealtimeRefresh: z.boolean(),
    supportsPartialRendering: z.boolean(),
    supportsActionExecution: z.boolean(),
  }),
  uiContract: z.object({
    acceptsPresentationV1: z.literal(true),
    requiresDeterministicHash: z.literal(true),
  }),
});

export type EconomicRealitySurfaceV1 = z.infer<typeof EconomicRealitySurfaceV1Schema>;

export const ECONOMIC_REALITY_SURFACE_V1: EconomicRealitySurfaceV1 = {
  moduleId: ECONOMIC_REALITY_SURFACE_MODULE_ID,
  version: ECONOMIC_REALITY_SURFACE_VERSION,
  entrypoint: {
    type: 'full_page',
    defaultView: 'PRIMARY',
  },
  capabilities: {
    supportsRealtimeRefresh: true,
    supportsPartialRendering: false,
    supportsActionExecution: true,
  },
  uiContract: {
    acceptsPresentationV1: true,
    requiresDeterministicHash: true,
  },
};

export function parseEconomicRealitySurfaceV1(input: unknown): EconomicRealitySurfaceV1 {
  return EconomicRealitySurfaceV1Schema.parse(input);
}
