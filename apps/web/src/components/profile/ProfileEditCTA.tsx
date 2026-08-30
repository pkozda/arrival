'use client';

import { AtlasLink as Link, AtlasSecondaryLink } from '@/components/atlas-runtime';
import { useApp } from '@/components/AppProvider';
import type { ProfileMirrorDomainSlug } from '@/lib/profile-mirror-utils';

type Props = {
  domainSlug: ProfileMirrorDomainSlug;
  label?: string;
  variant?: 'button' | 'link';
};

export function ProfileEditCTA({
  domainSlug,
  label,
  variant = 'button',
}: Props) {
  const { t } = useApp();
  const resolvedLabel = label ?? t('profile.correctInformation');

  if (variant === 'link') {
    return (
      <Link href={`/profile/${domainSlug}/edit`} className="text-link-accent">
        {resolvedLabel}
      </Link>
    );
  }

  return (
    <AtlasSecondaryLink href={`/profile/${domainSlug}/edit`}>
      {resolvedLabel}
    </AtlasSecondaryLink>
  );
}
