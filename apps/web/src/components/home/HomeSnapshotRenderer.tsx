'use client';

import Link from 'next/link';
import type { UiSnapshot } from '@/lib/api';

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

function ItemCard({ item }: { item: unknown }) {
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>;
    const title =
      typeof record.title === 'string'
        ? record.title
        : typeof record.id === 'string'
          ? record.id
          : typeof record.ruleId === 'string'
            ? record.ruleId
            : 'Item';
    const description =
      typeof record.description === 'string'
        ? record.description
        : typeof record.summary === 'string'
          ? record.summary
          : undefined;

    return (
      <div
        style={{
          padding: '0.75rem 0',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <strong style={{ fontSize: '0.9375rem' }}>{title}</strong>
        {typeof record.priority === 'string' && (
          <span className={`badge badge-${record.priority}`} style={{ marginLeft: '0.5rem' }}>
            {record.priority}
          </span>
        )}
        {typeof record.severity === 'string' && (
          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {record.severity}
          </span>
        )}
        {description && (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            {description}
          </p>
        )}
        {!description && (
          <pre
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
              marginTop: '0.25rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(record, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  return (
    <pre
      style={{
        fontSize: '0.75rem',
        color: 'var(--color-text-muted)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {JSON.stringify(item, null, 2)}
    </pre>
  );
}

function ListSection({ title, items }: { title: string; items: unknown[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section style={cardStyle}>
      <SectionTitle>{title}</SectionTitle>
      <div className="card">
        {items.map((item, index) => (
          <ItemCard key={index} item={item} />
        ))}
      </div>
    </section>
  );
}

export function HomeSnapshotRenderer({ snapshot }: Props) {
  const { session, profile, modules, executions, uxSnapshot, ftu } = snapshot;

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

      <ListSection title="Attention layer" items={uxSnapshot.attentionLayer} />
      <ListSection title="Action cards" items={uxSnapshot.actionCards} />
      <ListSection title="Priority signals" items={uxSnapshot.prioritySignals} />

      {modules.length > 0 && (
        <section style={cardStyle}>
          <SectionTitle>Modules</SectionTitle>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem',
            }}
          >
            {modules.map((module) => (
              <Link
                key={module.id}
                href={`/modules/${module.id}`}
                className="card"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  {module.name}
                </h3>
                {module.description && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    {module.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {executions.length > 0 && (
        <section style={cardStyle}>
          <SectionTitle>Executions</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {executions.map((execution) => (
              <div key={`${execution.moduleId}-${execution.timestamp}`} className="card">
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  {execution.moduleId}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                  {new Date(execution.timestamp).toISOString()}
                </p>
                <pre
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-muted)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(execution.result, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
