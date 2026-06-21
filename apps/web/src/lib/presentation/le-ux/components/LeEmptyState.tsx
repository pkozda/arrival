'use client';

type Props = {
  message: string;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'future';
};

const TONE_CLASS = {
  neutral: 'le-empty-state--neutral',
  positive: 'le-empty-state--positive',
  future: 'le-empty-state--future',
} as const;

export function LeEmptyState({ message, hint, tone = 'neutral' }: Props) {
  return (
    <div className={`le-empty-state ${TONE_CLASS[tone]}`} role="status">
      <p className="le-empty-state__message">{message}</p>
      {hint ? <p className="le-empty-state__hint">{hint}</p> : null}
    </div>
  );
}
