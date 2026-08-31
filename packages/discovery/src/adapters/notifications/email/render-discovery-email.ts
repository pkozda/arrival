import type { NotificationItem, NotificationPayload } from '../../../notifications/types.js';

export type RenderedDiscoveryEmail = {
  subject: string;
  text: string;
  html: string;
};

/**
 * Deterministic email renderer — consumes only NotificationPayload.
 * No ResultStore, candidates, scoring, verification, or network.
 */
export function renderDiscoveryEmail(payload: NotificationPayload): RenderedDiscoveryEmail {
  const items = [...payload.items].sort((a, b) => a.rank - b.rank);
  const subject = buildSubject(items, payload.title);
  const text = buildPlainText(payload, items);
  const html = buildHtml(payload, items);
  return { subject, text, html };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate a URL for safe href use. Only http(s) absolute URLs.
 * Returns null when unsafe / invalid.
 */
export function safeHttpUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const u = new URL(value.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function buildSubject(items: NotificationItem[], fallbackTitle: string): string {
  const newCount = items.filter((i) => i.novelty === 'NEW').length;
  const updatedCount = items.filter((i) => i.novelty === 'UPDATED').length;

  if (newCount > 0 && updatedCount > 0) {
    return `${newCount} new + ${updatedCount} updated opportunities in Arrival Atlas`;
  }
  if (newCount > 0) {
    return newCount === 1
      ? '1 new opportunity in Arrival Atlas'
      : `${newCount} new opportunities in Arrival Atlas`;
  }
  if (updatedCount > 0) {
    return updatedCount === 1
      ? '1 updated opportunity in Arrival Atlas'
      : `${updatedCount} updated opportunities in Arrival Atlas`;
  }
  if (items.length === 1) {
    return '1 discovery update in Arrival Atlas';
  }
  if (items.length > 1) {
    return `${items.length} discovery updates in Arrival Atlas`;
  }
  const trimmed = fallbackTitle.trim();
  return trimmed ? `${trimmed} — Arrival Atlas` : 'Discovery update — Arrival Atlas';
}

function buildPlainText(payload: NotificationPayload, items: NotificationItem[]): string {
  const lines: string[] = [
    payload.title,
    '',
    payload.summary,
    '',
    'Results (in digest order):',
  ];

  for (const item of items) {
    lines.push('');
    lines.push(`${item.rank}. [${item.novelty}] ${item.resultId}`);
    lines.push(`   Priority: ${item.priority}`);
  }

  lines.push('');
  lines.push(`Run: ${payload.runId}`);
  lines.push(`Strategy: ${payload.strategyId}@${payload.strategyVersion}`);
  lines.push(`Period: ${payload.period.from} → ${payload.period.to}`);
  lines.push('');
  lines.push('— Arrival Atlas');

  return lines.join('\n');
}

function buildHtml(payload: NotificationPayload, items: NotificationItem[]): string {
  const itemRows = items
    .map((item) => {
      const resultId = escapeHtml(item.resultId);
      const novelty = escapeHtml(item.novelty);
      const priority = escapeHtml(item.priority);
      return `<li>
  <strong>#${item.rank}</strong>
  <span>[${novelty}]</span>
  <code>${resultId}</code>
  <span>priority: ${priority}</span>
</li>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(payload.title)}</title></head>
<body>
  <h1>${escapeHtml(payload.title)}</h1>
  <p>${escapeHtml(payload.summary)}</p>
  <h2>Results</h2>
  <ol>
${itemRows}
  </ol>
  <p>Run: <code>${escapeHtml(payload.runId)}</code></p>
  <p>Strategy: <code>${escapeHtml(payload.strategyId)}@${escapeHtml(payload.strategyVersion)}</code></p>
  <p>Period: ${escapeHtml(payload.period.from)} → ${escapeHtml(payload.period.to)}</p>
  <p>— Arrival Atlas</p>
</body>
</html>`;
}
