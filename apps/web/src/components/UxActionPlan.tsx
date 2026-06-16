import type { UxActionCard } from '@/lib/api';

type Props = {
  summary: string;
  actions: UxActionCard[];
};

const PRIORITY_GROUPS: Array<{
  key: UxActionCard['priority'];
  label: string;
}> = [
  { key: 'high', label: 'High Priority' },
  { key: 'medium', label: 'Medium Priority' },
  { key: 'low', label: 'Low Priority' },
];

function groupActionsByPriority(actions: UxActionCard[]) {
  return {
    high: actions.filter((action) => action.priority === 'high'),
    medium: actions.filter((action) => action.priority === 'medium'),
    low: actions.filter((action) => action.priority === 'low'),
  };
}

export function UxActionPlan({ summary, actions }: Props) {
  const grouped = groupActionsByPriority(actions);
  const hasSummary = summary.trim().length > 0;
  const hasActions = actions.length > 0;

  if (!hasSummary && !hasActions) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {hasSummary && (
        <div className="card" style={{ borderColor: 'var(--color-primary)' }}>
          <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
            Your Next Steps
          </h3>
          <p style={{ fontSize: '0.9375rem', lineHeight: 1.6 }}>{summary}</p>
        </div>
      )}

      {PRIORITY_GROUPS.map(({ key, label }) => {
        const groupActions = grouped[key];
        if (groupActions.length === 0) return null;

        return (
          <div key={key} className="card">
            <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
              {label}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {groupActions.map((action, index) => (
                <div
                  key={action.id}
                  style={{
                    paddingBottom: index < groupActions.length - 1 ? '0.75rem' : undefined,
                    borderBottom: index < groupActions.length - 1 ? '1px solid var(--color-border)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span className={`badge badge-${action.priority}`}>{action.priority}</span>
                    <strong style={{ fontSize: '0.9375rem' }}>{action.title}</strong>
                  </div>
                  {action.description && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{action.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
