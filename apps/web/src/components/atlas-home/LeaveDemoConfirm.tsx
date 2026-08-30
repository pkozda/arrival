'use client';

import { useRef } from 'react';
import { useApp } from '@/components/AppProvider';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';

type Props = {
  open: boolean;
  leaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function LeaveDemoConfirm({ open, leaving, onCancel, onConfirm }: Props) {
  const { t } = useApp();
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
        aria-label={t('common.close')}
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
          {t('home.leaveDemo.title')}
        </h2>
        <p className="leave-demo-confirm__lead">{t('home.leaveDemo.message')}</p>
        <div className="leave-demo-confirm__actions">
          <button
            ref={primaryRef}
            type="button"
            className="leave-demo-confirm__btn leave-demo-confirm__btn--primary"
            onClick={onConfirm}
            disabled={leaving}
          >
            {leaving ? t('home.leaveDemo.resetting') : t('home.leaveDemo.confirm')}
          </button>
          <button
            type="button"
            className="leave-demo-confirm__btn leave-demo-confirm__btn--ghost"
            onClick={onCancel}
            disabled={leaving}
          >
            {t('home.leaveDemo.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
