'use client';

import { useRef } from 'react';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';

type Props = {
  open: boolean;
  title: string;
  message: string;
  continueLabel: string;
  onContinue: () => void;
};

export function SessionRecreatedNotice({
  open,
  title,
  message,
  continueLabel,
  onContinue,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  useFocusTrap({
    open,
    containerRef: dialogRef,
    initialFocusRef: continueRef,
    onEscape: onContinue,
  });

  if (!open) {
    return null;
  }

  return (
    <div className="session-recreated-notice" role="presentation" data-ui-surface="session-recreated">
      <button
        type="button"
        className="session-recreated-notice__backdrop"
        aria-label={continueLabel}
        onClick={onContinue}
      />
      <div
        ref={dialogRef}
        className="session-recreated-notice__dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-recreated-notice-title"
        aria-describedby="session-recreated-notice-message"
      >
        <h2 id="session-recreated-notice-title" className="session-recreated-notice__title">
          {title}
        </h2>
        <p id="session-recreated-notice-message" className="session-recreated-notice__lead">
          {message}
        </p>
        <div className="session-recreated-notice__actions">
          <button
            ref={continueRef}
            type="button"
            className="session-recreated-notice__btn session-recreated-notice__btn--primary"
            onClick={onContinue}
          >
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
