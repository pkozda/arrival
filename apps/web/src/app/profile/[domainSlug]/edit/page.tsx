'use client';

import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { DomainMutationEditor } from '@/components/profile/DomainMutationEditor';
import { isProfileMirrorDomainSlug } from '@/lib/profile-mirror-utils';

function LoadingState() {
  return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
    </div>
  );
}

export default function ProfileDomainEditPage() {
  const params = useParams<{ domainSlug: string }>();
  const router = useRouter();
  const domainSlug = params.domainSlug;

  if (!isProfileMirrorDomainSlug(domainSlug)) {
    return (
      <>
        <Header />
        <main style={{ padding: '2rem 0 4rem' }}>
          <div className="container" style={{ maxWidth: '720px' }}>
            <div className="card">
              <p style={{ color: 'var(--color-text-muted)' }}>This section could not be found.</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main style={{ padding: '2rem 0 4rem' }}>
        <div className="container" style={{ maxWidth: '720px' }}>
          <DomainMutationEditor
            domainSlug={domainSlug}
            onCancel={() => router.push(`/profile/${domainSlug}`)}
            onSuccess={() => router.push(`/profile/${domainSlug}?updated=1`)}
          />
        </div>
      </main>
    </>
  );
}
