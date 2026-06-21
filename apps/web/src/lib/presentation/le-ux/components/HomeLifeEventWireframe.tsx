'use client';

import Link from 'next/link';
import type { HomeLifeEventWireframeProps } from '@/lib/presentation/le-ux/types';
import {
  buildExecutionStateLookup,
  buildExecutionSurface,
  isExecutionDisabled,
  projectActionSurface,
} from '@/lib/life-event-plan';
import { useApp } from '@/components/AppProvider';
import { LifeEventWireframeLayout } from '@/lib/presentation/le-ux/components/LifeEventWireframeLayout';
import { WireframeSkeleton } from '@/lib/presentation/le-ux/components/WireframeSkeleton';
import { assertNoDuplicateWireframeNodes, buildHomeInsightContent } from '@/lib/presentation/le-ux/home-wireframe';
import { normalizeWireframeSurface } from '@/lib/presentation/le-ux/wireframe-surface';

export function HomeLifeEventWireframe({
  plan,
  loading,
  error,
  executionSurface,
  scenario,
  runtimeEffect,
  insight: insightInput,
}: HomeLifeEventWireframeProps) {
  const { t } = useApp();

  if (loading) {
    return (
      <section className="card le-home-card le-home-card--loading" style={{ marginBottom: '1rem' }} aria-busy="true" aria-label={t('life-event.empty.loadingPlan')}>
        <WireframeSkeleton />
      </section>
    );
  }

  if (error || !plan) {
    return null;
  }

  const surface = normalizeWireframeSurface(projectActionSurface(plan));
  if (!surface.primaryAction) {
    return null;
  }

  assertNoDuplicateWireframeNodes(surface);

  const execution =
    executionSurface === null ? null : executionSurface ?? buildExecutionSurface(surface);
  const executionLookup = execution ? buildExecutionStateLookup(execution) : null;
  const isNodeDisabled = (nodeId: string, fallbackBlocked = false) =>
    executionLookup ? isExecutionDisabled(executionLookup, nodeId) : fallbackBlocked;

  const insight = buildHomeInsightContent(insightInput, t);

  return (
    <section className="card" style={{ marginBottom: '1rem' }}>
      <div className="le-home-card__header">
        <h2 className="le-home-card__title">{t('life-event.home.title')}</h2>
        <Link href="/modules/life-event" className="btn btn-secondary" style={{ flexShrink: 0 }}>
          {t('life-event.home.viewFullPlan')}
        </Link>
      </div>

      <LifeEventWireframeLayout
        plan={plan}
        surface={surface}
        scenario={scenario}
        runtimeEffect={runtimeEffect}
        isNodeDisabled={isNodeDisabled}
        insight={insight}
        contextualDefaultOpen={false}
        showRuntimeFeedback
        variant="home"
        heroCompact
      />
    </section>
  );
}
