'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppProvider';

const AUTO_DISMISS_MS = 4200;

type Props = {
  title?: string;
  subtitle?: string;
};

export function ProfileCorrectionToast({ title, subtitle }: Props) {
  const { t } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isActive = searchParams.get('updated') === '1';
  const [visible, setVisible] = useState(isActive);
  const resolvedTitle = title ?? t('profile.toast.title');
  const resolvedSubtitle = subtitle ?? t('profile.toast.subtitle');

  useEffect(() => {
    setVisible(isActive);
  }, [isActive]);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (searchParams.get('updated') !== '1') {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete('updated');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [dismiss, visible]);

  if (!visible || !isActive) {
    return null;
  }

  return (
    <div className="profile-correction-toast" role="status" aria-live="polite">
      <div className="profile-correction-toast__content">
        <p className="profile-correction-toast__title">{resolvedTitle}</p>
        {resolvedSubtitle && (
          <p className="profile-correction-toast__subtitle">{resolvedSubtitle}</p>
        )}
      </div>
      <button
        type="button"
        className="profile-correction-toast__close"
        onClick={dismiss}
        aria-label={t('common.dismiss')}
      >
        ×
      </button>
    </div>
  );
}
