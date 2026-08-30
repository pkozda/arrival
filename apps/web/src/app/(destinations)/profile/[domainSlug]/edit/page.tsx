'use client';

import { useParams } from 'next/navigation';
import { AtlasSurface } from '@/components/atlas-runtime/legacy';
import { useApp } from '@/components/AppProvider';
import { useCelestialNavigation } from '@/components/celestial/useCelestialNavigation';
import { DomainMutationEditor } from '@/components/profile/DomainMutationEditor';
import { isProfileMirrorDomainSlug } from '@/lib/profile-mirror-utils';

export default function ProfileDomainEditPage() {
  const params = useParams<{ domainSlug: string }>();
  const { arriveAt } = useCelestialNavigation();
  const { t } = useApp();
  const domainSlug = params.domainSlug;

  if (!isProfileMirrorDomainSlug(domainSlug)) {
    return (
      <main className="celestial-page-main">
        <div className="container" style={{ maxWidth: '720px' }}>
          <AtlasSurface>
            <p className="text-body text-body--muted">{t('profile.sectionNotFound')}</p>
          </AtlasSurface>
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
