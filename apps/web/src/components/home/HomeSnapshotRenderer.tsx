'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { UiSnapshot } from '@/lib/api';
import type {
  ActionCard,
  PublicModuleContract,
  SnapshotRecommendation,
} from '@/lib/product-contract';
import { ModuleProjectionRenderer } from '@/components/ModuleProjectionRenderer';
import { ExecutionExplainToggle } from '@/components/ExecutionExplainToggle';
import {
  buildModuleContractLookup,
  capabilityVisibilityFromContract,
  formatCategoryLabel,
  groupModulesByCategory,
} from '@/lib/module-catalog-utils';
import {
  getAttentionLayer,
  getGlobalUxActions,
  getPrioritySignals,
} from '@/lib/snapshot';
import { useApp } from '@/components/AppProvider';

type Props = {
  snapshot: UiSnapshot;
};

const cardStyle = {
  marginBottom: '1rem',
} as const;

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
      {children}
    </h2>
  );
}

function RecordFields({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value).filter(([, v]) => v !== undefined && v !== null);

  if (entries.length === 0) {
    return null;
  }

  return (
    <dl style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
      {entries.map(([key, entryValue]) => (
        <div key={key}>
          <dt style={{ color: 'var(--color-text-muted)', marginBottom: '0.125rem' }}>{key}</dt>
          <dd>
            {typeof entryValue === 'object'
              ? JSON.stringify(entryValue)
              : String(entryValue)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ActionCardItem({ card }: { card: ActionCard }) {
  return (
    <div
      style={{
        padding: '0.75rem 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <strong style={{ fontSize: '0.9375rem' }}>{card.label}</strong>
      <span className={`badge badge-${card.priority}`} style={{ marginLeft: '0.5rem' }}>
        {card.priority}
      </span>
      <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
        {card.moduleId}
      </span>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
        {card.description}
      </p>
    </div>
  );
}

function RecommendationItem({ recommendation }: { recommendation: SnapshotRecommendation }) {
  return (
    <div
      style={{
        padding: '0.75rem 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <strong style={{ fontSize: '0.9375rem' }}>{recommendation.title}</strong>
      {recommendation.priority && (
        <p>
          <span className={`badge badge-${recommendation.priority}`}>{recommendation.priority}</span>
          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {recommendation.moduleId}
          </span>
        </p>
      )}
    </div>
  );
}

function ActionCardsSection({ title, items }: { title: string; items: ActionCard[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section style={cardStyle}>
      <SectionTitle>{title}</SectionTitle>
      <div className="card">
        {items.map((item) => (
          <ActionCardItem key={item.actionId} card={item} />
        ))}
      </div>
    </section>
  );
}

function RecommendationsSection({
  title,
  items,
}: {
  title: string;
  items: SnapshotRecommendation[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section style={cardStyle}>
      <SectionTitle>{title}</SectionTitle>
      <div className="card">
        {items.map((item) => (
          <RecommendationItem key={item.recommendationId} recommendation={item} />
        ))}
      </div>
    </section>
  );
}

function ModuleCard({
  module,
  summary,
}: {
  module: PublicModuleContract;
  summary?: { recommendationCount: number; actionCount: number };
}) {
  const visibility = capabilityVisibilityFromContract(module);

  return (
    <Link
      href={`/modules/${module.id}`}
      className="card"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        {module.title}
      </h3>
      {module.description && (
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          {module.description}
        </p>
      )}
      {summary && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          {visibility.showRecommendations && (
            <span>{summary.recommendationCount} recommendations</span>
          )}
          {visibility.showRecommendations && visibility.showActions && <span> · </span>}
          {visibility.showActions && <span>{summary.actionCount} actions</span>}
        </p>
      )}
    </Link>
  );
}

function filterActionCardsByCapability(
  items: ActionCard[],
  moduleLookup: Map<string, PublicModuleContract>
): ActionCard[] {
  return items.filter((item) => {
    const contract = moduleLookup.get(item.moduleId);
    return contract ? contract.capabilities.supports.actions : false;
  });
}

function filterRecommendationsByCapability(
  items: SnapshotRecommendation[],
  moduleLookup: Map<string, PublicModuleContract>
): SnapshotRecommendation[] {
  return items.filter((item) => {
    const contract = moduleLookup.get(item.moduleId);
    return contract ? contract.capabilities.supports.recommendations : false;
  });
}

export function HomeSnapshotRenderer({ snapshot }: Props) {
  const { session, profile, executions, ftu, summaries } = snapshot;
  const { modules } = useApp();
  const moduleLookup = useMemo(() => buildModuleContractLookup(modules), [modules]);
  const groupedModules = useMemo(() => groupModulesByCategory(modules), [modules]);
  const summaryByModuleId = new Map(summaries.map((summary) => [summary.moduleId, summary]));

  const showActionsSection = modules.some((module) => module.capabilities.supports.actions);
  const showRecommendationsSection = modules.some(
    (module) => module.capabilities.supports.recommendations
  );

  const actionCards = showActionsSection
    ? filterActionCardsByCapability(getGlobalUxActions(snapshot), moduleLookup)
    : [];
  const prioritySignals = showRecommendationsSection
    ? filterRecommendationsByCapability(getPrioritySignals(snapshot), moduleLookup)
    : [];
  const attentionLayer = showActionsSection
    ? filterActionCardsByCapability(getAttentionLayer(snapshot), moduleLookup)
    : [];

  return (
    <>
      <section className="card" style={cardStyle}>
        <SectionTitle>Session</SectionTitle>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Language: <strong>{session.language}</strong>
        </p>
      </section>

      <section className="card" style={cardStyle}>
        <SectionTitle>First-time experience</SectionTitle>
        <p style={{ fontSize: '0.875rem' }}>
          First-time user: <strong>{String(ftu.isFirstTimeUser)}</strong>
        </p>
        {ftu.step !== undefined && (
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Step: <strong>{ftu.step}</strong>
          </p>
        )}
      </section>

      {profile && (
        <section style={cardStyle}>
          <SectionTitle>Profile</SectionTitle>
          <div className="card">
            <RecordFields value={profile} />
          </div>
        </section>
      )}

      {showActionsSection && (
        <>
          <ActionCardsSection title="Attention layer" items={attentionLayer} />
          <ActionCardsSection title="Action cards" items={actionCards} />
        </>
      )}

      {showRecommendationsSection && (
        <RecommendationsSection title="Priority signals" items={prioritySignals} />
      )}

      {groupedModules.length > 0 && (
        <section style={cardStyle}>
          <SectionTitle>Modules</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {groupedModules.map(({ category, modules: categoryModules }) => (
              <div key={category}>
                <h3
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                    marginBottom: '0.75rem',
                  }}
                >
                  {formatCategoryLabel(category)}
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  {categoryModules.map((module) => (
                    <ModuleCard
                      key={module.id}
                      module={module}
                      summary={summaryByModuleId.get(module.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {executions.length > 0 && (
        <section style={cardStyle}>
          <SectionTitle>Recent executions</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {executions.map((execution) => {
              const contract = moduleLookup.get(execution.moduleId);
              const visibility = contract
                ? capabilityVisibilityFromContract(contract)
                : {
                    showRecommendations: false,
                    showActions: false,
                    showExplanation: false,
                    showRiskModel: false,
                  };

              return (
                <div key={execution.executionId} className="card">
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    {execution.projection.title}
                  </h3>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                      marginBottom: '0.75rem',
                    }}
                  >
                    {execution.moduleId} · {execution.createdAt}
                  </p>
                  <ModuleProjectionRenderer
                    projection={execution.projection}
                    visibility={visibility}
                  />
                  {visibility.showExplanation && execution.projection.status === 'success' && (
                    <ExecutionExplainToggle
                      moduleId={execution.moduleId}
                      executionId={execution.executionId}
                      sessionId={snapshot.session.sessionId}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
