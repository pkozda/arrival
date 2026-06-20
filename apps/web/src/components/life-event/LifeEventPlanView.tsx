'use client';

import type { LifeEventPlanV1 } from '@/lib/product-contract';
import type { ExecutionSurfaceV1 } from '@/lib/life-event-plan';
import { humanizeConfidence } from '@/lib/ux-labels';
import {
  buildExecutionStateLookup,
  buildExecutionSurface,
  isExecutionDisabled,
  projectActionSurface,
  projectLifeEventPage,
} from '@/lib/life-event-plan';
import { LifeEventPlanNodeCard } from '@/components/life-event/LifeEventPlanNodeCard';

type Props = {
  plan: LifeEventPlanV1;
  executionSurface?: ExecutionSurfaceV1 | null;
};

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>{children}</h2>
  );
}

export function LifeEventPlanView({ plan, executionSurface }: Props) {
  const projection = projectLifeEventPage(plan);
  const surface = projectActionSurface(plan);
  const execution =
    executionSurface === null ? null : executionSurface ?? buildExecutionSurface(surface);
  const executionLookup = execution ? buildExecutionStateLookup(execution) : null;

  const nodeDisabled = (nodeId: string, fallbackBlocked = false) =>
    executionLookup ? isExecutionDisabled(executionLookup, nodeId) : fallbackBlocked;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <section className="card">
        <p
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: '0.5rem',
          }}
        >
          Your current situation
        </p>
        <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
          {projection.lifeStateLabel}
        </p>
        <SectionTitle>Recommended focus</SectionTitle>
        {surface.primaryAction && (
          <LifeEventPlanNodeCard
            node={surface.primaryAction}
            variant="focus"
            forceDisabled={nodeDisabled(surface.primaryAction.id)}
          />
        )}
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>
          Plan confidence: {humanizeConfidence(plan.reasoning.planConfidence)}
        </p>
      </section>

      {projection.whyThisNow.length > 0 && (
        <section className="card">
          <SectionTitle>Why this now</SectionTitle>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {projection.whyThisNow.map((line) => (
              <li
                key={line}
                style={{ fontSize: '0.9375rem', marginBottom: '0.375rem', lineHeight: 1.5 }}
              >
                {line}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(surface.blockedActions.length > 0 || projection.showBlockingReasons) && (
        <section className="card">
          <SectionTitle>What is blocking you</SectionTitle>

          {surface.blockedActions.length > 0 && (
            <div style={{ marginBottom: projection.showBlockingReasons ? '1rem' : 0 }}>
              <h3
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                  color: 'var(--color-text-muted)',
                }}
              >
                Blocked actions
              </h3>
              {surface.blockedActions.map((node) => (
                <LifeEventPlanNodeCard
                  key={node.id}
                  node={node}
                  variant="blocker"
                  forceDisabled={nodeDisabled(node.id, true)}
                />
              ))}
            </div>
          )}

          {projection.showBlockingReasons && (
            <div>
              <h3
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                  color: 'var(--color-text-muted)',
                }}
              >
                Why progress is constrained
              </h3>
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {projection.blockingReasons.map((line) => (
                  <li
                    key={line}
                    style={{ fontSize: '0.9375rem', marginBottom: '0.375rem', lineHeight: 1.5 }}
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {surface.secondaryActions.length > 0 && (
        <section className="card">
          <SectionTitle>Next actions</SectionTitle>
          {surface.secondaryActions.map((node) => (
            <LifeEventPlanNodeCard
              key={node.id}
              node={node}
              variant="action"
              forceDisabled={nodeDisabled(node.id)}
            />
          ))}
        </section>
      )}

      {(projection.showTimeline || surface.contextualActions.length > 0) && (
        <details className="card">
          <summary
            style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              cursor: 'pointer',
              listStyle: 'none',
            }}
          >
            Timeline
          </summary>
          <div style={{ marginTop: '1rem' }}>
            {surface.contextualActions.length > 0 && (
              <div style={{ marginBottom: projection.showTimeline ? '1rem' : 0 }}>
                <h3
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Upcoming steps
                </h3>
                {surface.contextualActions.map((node) => (
                  <LifeEventPlanNodeCard
                    key={node.id}
                    node={node}
                    variant="timeline"
                    forceDisabled={nodeDisabled(node.id)}
                  />
                ))}
              </div>
            )}
            {projection.timeline.map((node) => (
              <LifeEventPlanNodeCard
                key={node.id}
                node={node}
                variant="timeline"
                forceDisabled={nodeDisabled(node.id)}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
