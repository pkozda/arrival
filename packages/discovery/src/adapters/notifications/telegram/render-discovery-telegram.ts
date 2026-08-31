import type { NotificationItem, NotificationPayload } from '../../../notifications/types.js';

/** Telegram Bot API sendMessage text limit. */
export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

export type RenderedDiscoveryTelegram = {
  text: string;
  truncated: boolean;
};

/**
 * Deterministic plain-text Telegram renderer — consumes only NotificationPayload.
 * No Markdown/HTML parse mode (avoids injection). No ResultStore / network.
 */
export function renderDiscoveryTelegram(
  payload: NotificationPayload,
  maxLength: number = TELEGRAM_MAX_MESSAGE_LENGTH
): RenderedDiscoveryTelegram {
  const items = [...payload.items].sort((a, b) => a.rank - b.rank);
  const full = buildPlainText(payload, items);
  if (full.length <= maxLength) {
    return { text: full, truncated: false };
  }
  return {
    text: truncateDeterministically(full, maxLength),
    truncated: true,
  };
}

function buildPlainText(payload: NotificationPayload, items: NotificationItem[]): string {
  const lines: string[] = [
    sanitizeLine(payload.title),
    '',
    sanitizeLine(payload.summary),
    '',
    'Results (digest order):',
  ];

  for (const item of items) {
    lines.push('');
    lines.push(
      `${item.rank}. [${sanitizeToken(item.novelty)}] ${sanitizeLine(item.resultId)}`
    );
    lines.push(`   Priority: ${sanitizeToken(item.priority)}`);
  }

  lines.push('');
  lines.push(`Run: ${sanitizeLine(payload.runId)}`);
  lines.push(
    `Strategy: ${sanitizeLine(payload.strategyId)}@${sanitizeLine(payload.strategyVersion)}`
  );
  lines.push(
    `Period: ${sanitizeLine(payload.period.from)} → ${sanitizeLine(payload.period.to)}`
  );
  lines.push('');
  lines.push('— Arrival Atlas');

  return lines.join('\n');
}

/**
 * Strip control characters that could confuse Telegram clients / copy-paste.
 * Plain text mode — no entity parsing — so this is defensive hygiene only.
 */
function sanitizeLine(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function sanitizeToken(value: string): string {
  return sanitizeLine(value).replace(/\s+/g, ' ').trim();
}

function truncateDeterministically(text: string, maxLength: number): string {
  const marker = '\n…[truncated]';
  if (maxLength <= marker.length) {
    return marker.slice(0, maxLength);
  }
  const budget = maxLength - marker.length;
  // Prefer cutting at a line boundary when possible
  let cut = text.slice(0, budget);
  const lastNl = cut.lastIndexOf('\n');
  if (lastNl > budget * 0.5) {
    cut = cut.slice(0, lastNl);
  }
  return cut + marker;
}
