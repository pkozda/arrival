import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UserContextV1 } from '@arrival-atlas/product-contract';
import { buildEconomicRealityPlan } from './pipeline.js';
import { EconomicRealityPlanError } from './guards.js';

export type EconomicRealityPlanControllerDeps = {
  resolveUserContext: (request: FastifyRequest) => Promise<UserContextV1 | null>;
  resolveGeneratedAt: (request: FastifyRequest) => Promise<string>;
};

export async function handleEconomicRealityPlanRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: EconomicRealityPlanControllerDeps
): Promise<unknown> {
  const userContext = await deps.resolveUserContext(request);
  if (!userContext) {
    return reply.status(404).send({ error: 'Session not found', code: 'ECONOMIC_CONTEXT_INVALID' });
  }

  try {
    const generatedAt = await deps.resolveGeneratedAt(request);
    return buildEconomicRealityPlan(userContext, {
      requestId: request.id,
      generatedAt,
    });
  } catch (error) {
    if (error instanceof EconomicRealityPlanError) {
      const status = error.code === 'ECONOMIC_CONTEXT_INVALID' ? 400 : 422;
      return reply.status(status).send({
        error: error.message,
        code: error.code,
      });
    }

    request.log.error({ err: error }, 'Economic reality plan generation failed');
    return reply.status(500).send({
      error: 'Failed to generate economic reality plan',
      code: 'PLAN_BUILD_FAILED',
    });
  }
}
