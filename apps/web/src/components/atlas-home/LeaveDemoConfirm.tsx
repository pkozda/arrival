'use client';

import { useRef } from 'react';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';

type Props = {
  open: boolean;
  leaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function LeaveDemoConfirm({ open, leaving, onCancel, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useFocusTrap({
    open,
    containerRef: dialogRef,
    initialFocusRef: primaryRef,
    onEscape: leaving ? undefined : onCancel,
  });

  if (!open) {
    return null;
  }

  return (
    <div className="leave-demo-confirm" role="presentation">
      <button
        type="button"
        className="leave-demo-confirm__backdrop"
        aria-label="Close"
        onClick={onCancel}
        disabled={leaving}
      />
      <div
        ref={dialogRef}
        className="leave-demo-confirm__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-demo-confirm-title"
      >
        <h2 id="leave-demo-confirm-title" className="leave-demo-confirm__title">
          Leave demo and start over?
        </h2>
        <p className="leave-demo-confirm__lead">
          Your demo profile, journey progress, and local settings on this device will be cleared.
          You will return to the Atlas preview.
        </p>
        <div className="leave-demo-confirm__actions">
          <button
            ref={primaryRef}
            type="button"
            className="leave-demo-confirm__btn leave-demo-confirm__btn--primary"
            onClick={onConfirm}
            disabled={leaving}
          >
            {leaving ? 'Resetting…' : 'Start over'}
          </button>
          <button
            type="button"
            className="leave-demo-confirm__btn leave-demo-confirm__btn--ghost"
            onClick={onCancel}
            disabled={leaving}
          >
            Keep exploring
          </button>
        </div>
      </div>
    </div>
  );
}
