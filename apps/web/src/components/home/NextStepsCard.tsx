'use client';

import Link from 'next/link';
import type { LifeEventPlanV1 } from '@/lib/product-contract';
import type { ExecutionSurfaceV1 } from '@/lib/life-event-plan';
import type { ScenarioMatchV1 } from '@/lib/life-event/scenarios';
import type { RuntimeActionEffectV1 } from '@/lib/life-event/runtime';
import { RuntimeCrossModuleFeedback } from '@/lib/life-event/runtime';
import {
  buildExecutionStateLookup,
  buildExecutionSurface,
  isExecutionDisabled,
  projectActionSurface,
} from '@/lib/life-event-plan';
import { LifeEventPlanNodeCard } from '@/components/life-event/LifeEventPlanNodeCard';
import { useApp } from '@/components/AppProvider';
import { localizeScenarioReasoning } from '@/lib/life-event/content-labels';

type Props = {
  plan: LifeEventPlanV1 | null;
  loading?: boolean;
  error?: string | null;
  executionSurface?: ExecutionSurfaceV1 | null;
  scenario?: ScenarioMatchV1 | null;
  runtimeEffect?: RuntimeActionEffectV1 | null;
};

export function NextStepsCard({ plan, loading, error, executionSurface, scenario, runtimeEffect }: Props) {
  const { t } = useApp();

  if (loading || error || !plan) {
    return null;
  }

  const surface = projectActionSurface(plan);
  if (!surface.primaryAction) {
    return null;
  }

  const execution =
    executionSurface === null ? null : executionSurface ?? buildExecutionSurface(surface);
  const executionLookup = execution ? buildExecutionStateLookup(execution) : null;

  const primaryNode = surface.primaryAction;
  const blockedNodes = surface.blockedActions;
  const secondaryNodes = surface.secondaryActions;

  return (
    <section className="card" style={{ marginBottom: '1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          marginBottom: '0.75rem',
        }}
      >
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
          {t('life-event.home.title')}
        </h2>
        <Link href="/modules/life-event" className="btn btn-secondary" style={{ flexShrink: 0 }}>
          {t('life-event.home.viewFullPlan')}
        </Link>
      </div>

      {scenario && (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.625rem 0.75rem',
            borderRadius: '6px',
            background: 'var(--color-surface-muted, rgba(0,0,0,0.04))',
            borderLeft: '3px solid var(--color-accent)',
          }}
        >
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, margin: '0 0 0.25rem' }}>
            {t('life-event.scenario.contextShiftTitle')}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
            {localizeScenarioReasoning(t, scenario.scenarioId, scenario.reasoning)}
          </p>
        </div>
      )}

      <RuntimeCrossModuleFeedback effect={runtimeEffect} />

      <LifeEventPlanNodeCard
        node={primaryNode}
        variant="focus"
        forceDisabled={executionLookup ? isExecutionDisabled(executionLookup, primaryNode.id) : false}
      />

      {blockedNodes.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              marginBottom: '0.5rem',
              color: 'var(--color-text-muted)',
            }}
          >
            {t('life-event.home.blockedTitle')}
          </h3>
          {blockedNodes.map((node) => (
            <LifeEventPlanNodeCard
              key={node.id}
              node={node}
              variant="blocker"
              forceDisabled={executionLookup ? isExecutionDisabled(executionLookup, node.id) : true}
            />
          ))}
        </div>
      )}

      {secondaryNodes.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              marginBottom: '0.5rem',
              color: 'var(--color-text-muted)',
            }}
          >
            {t('life-event.home.secondaryTitle')}
          </h3>
          {secondaryNodes.map((node) => (
            <LifeEventPlanNodeCard
              key={node.id}
              node={node}
              variant="action"
              forceDisabled={executionLookup ? isExecutionDisabled(executionLookup, node.id) : false}
            />
          ))}
        </div>
      )}
    </section>
  );
}
