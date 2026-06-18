'use client';

import Link from 'next/link';
import type { UiSnapshot } from '@/lib/api';
import type { ActionCard, SnapshotRecommendation } from '@/lib/product-contract';
import { ModuleProjectionRenderer } from '@/components/ModuleProjectionRenderer';
import { ExecutionExplainToggle } from '@/components/ExecutionExplainToggle';
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

export function HomeSnapshotRenderer({ snapshot }: Props) {
  const { session, profile, executions, ftu, summaries } = snapshot;
  const { modules } = useApp();
  const actionCards = getGlobalUxActions(snapshot);
  const prioritySignals = getPrioritySignals(snapshot);
  const attentionLayer = getAttentionLayer(snapshot);
  const summaryByModuleId = new Map(summaries.map((summary) => [summary.moduleId, summary]));

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

      <ActionCardsSection title="Attention layer" items={attentionLayer} />
      <ActionCardsSection title="Action cards" items={actionCards} />
      <RecommendationsSection title="Priority signals" items={prioritySignals} />

          {modules.filter((module) => module.status === 'available').length > 0 && (
        <section style={cardStyle}>
          <SectionTitle>Modules</SectionTitle>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem',
            }}
          >
            {modules
              .filter((module) => module.status === 'available')
              .map((module) => {
              const summary = summaryByModuleId.get(module.id);
              return (
                <Link
                  key={module.id}
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
                      {summary.recommendationCount} recommendations · {summary.actionCount} actions
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {executions.length > 0 && (
        <section style={cardStyle}>
          <SectionTitle>Recent executions</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {executions.map((execution) => (
              <div key={execution.executionId} className="card">
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  {execution.projection.title}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                  {execution.moduleId} · {execution.createdAt}
                </p>
                <ModuleProjectionRenderer projection={execution.projection} />
                {execution.projection.status === 'success' && (
                  <ExecutionExplainToggle
                    moduleId={execution.moduleId}
                    executionId={execution.executionId}
                    sessionId={snapshot.session.sessionId}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
