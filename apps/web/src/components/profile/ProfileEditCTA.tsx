import Link from 'next/link';
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
  const className = variant === 'button' ? 'btn btn-secondary' : undefined;

  return (
    <Link
      href={`/profile/${domainSlug}/edit`}
      className={className}
      style={{
        display: 'inline-block',
        fontSize: '0.875rem',
        textDecoration: 'none',
        ...(variant === 'link' ? { color: 'var(--color-accent)' } : {}),
      }}
    >
      {label}
    </Link>
  );
}
