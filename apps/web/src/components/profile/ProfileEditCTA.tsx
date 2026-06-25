import { AtlasLink as Link, AtlasSecondaryLink } from '@/components/atlas-runtime';
import type { ProfileMirrorDomainSlug } from '@/lib/profile-mirror-utils';

type Props = {
  domainSlug: ProfileMirrorDomainSlug;
  label?: string;
  variant?: 'button' | 'link';
};

export function ProfileEditCTA({
  domainSlug,
  label = 'Correct information',
  variant = 'button',
}: Props) {
  if (variant === 'link') {
    return (
      <Link href={`/profile/${domainSlug}/edit`} className="text-link-accent">
        {label}
      </Link>
    );
  }

  return (
    <AtlasSecondaryLink href={`/profile/${domainSlug}/edit`}>
      {label}
    </AtlasSecondaryLink>
  );
}
