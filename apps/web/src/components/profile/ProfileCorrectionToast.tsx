'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const AUTO_DISMISS_MS = 4200;

type Props = {
  title?: string;
  subtitle?: string;
};

export function ProfileCorrectionToast({
  title = 'Your situation was updated',
  subtitle = 'Updated from Profile correction',
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isActive = searchParams.get('updated') === '1';
  const [visible, setVisible] = useState(isActive);

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
        <p className="profile-correction-toast__title">{title}</p>
        {subtitle && <p className="profile-correction-toast__subtitle">{subtitle}</p>}
      </div>
      <button type="button" className="profile-correction-toast__close" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
