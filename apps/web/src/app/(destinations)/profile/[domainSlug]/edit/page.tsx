'use client';

import { useParams } from 'next/navigation';
import { useCelestialNavigation } from '@/components/celestial/useCelestialNavigation';
import { DomainMutationEditor } from '@/components/profile/DomainMutationEditor';
import { isProfileMirrorDomainSlug } from '@/lib/profile-mirror-utils';

export default function ProfileDomainEditPage() {
  const params = useParams<{ domainSlug: string }>();
  const { arriveAt } = useCelestialNavigation();
  const domainSlug = params.domainSlug;

  if (!isProfileMirrorDomainSlug(domainSlug)) {
    return (
      <main className="celestial-page-main">
        <div className="container" style={{ maxWidth: '720px' }}>
          <div className="card">
            <p style={{ color: 'var(--color-text-muted)' }}>This section could not be found.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="celestial-page-main">
      <div className="container" style={{ maxWidth: '720px' }}>
        <DomainMutationEditor
          domainSlug={domainSlug}
          onCancel={() => arriveAt(`/profile/${domainSlug}`)}
          onSuccess={() => arriveAt(`/profile/${domainSlug}?updated=1`)}
        />
      </div>
    </main>
  );
}
