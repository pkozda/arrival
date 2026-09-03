import { describe, expect, it } from 'vitest';
import {
  employerAttributionMatches,
  employerNameMatchesHost,
  isEmployerControlledDiscoveryHost,
  normalizeEmployerName,
  resolveExpectedEmployer,
  selectOfficialEmployerCandidateUrls,
} from './official-employer-resolution.js';
import {
  FIXTURE_EMPLOYER_MARKETING_EVENTS_HTML,
  FIXTURE_OFFICIAL_EMPLOYER_JOB_HTML,
} from './fixtures/e12-2-official-employer.js';

describe('E12.2 official employer resolution helpers', () => {
  it('selects off-domain apply links and ignores same-host / known aggregators', () => {
    const selected = selectOfficialEmployerCandidateUrls({
      discoveryUrl: 'https://board.example/jobs/123',
      extracted: {
        fields: {
          organization: 'Acme Robotics',
          links: JSON.stringify([
            {
              href: 'https://board.example/jobs/123?ref=1',
              text: 'Same board',
            },
            {
              href: 'https://www.linkedin.com/jobs/view/1',
              text: 'LinkedIn',
            },
            {
              href: 'https://careers.acme-robotics.example/jobs/fe',
              text: 'Apply on company career site',
            },
            {
              href: 'https://other.example/about',
              text: 'About us',
            },
          ]),
          jobPostingUrl: 'https://careers.acme-robotics.example/jobs/fe-ld',
        },
      },
    });

    expect(selected.map((s) => s.url)).toContain(
      'https://careers.acme-robotics.example/jobs/fe-ld'
    );
    expect(selected.map((s) => s.url)).toContain(
      'https://careers.acme-robotics.example/jobs/fe'
    );
    expect(selected.every((s) => !s.url.includes('board.example'))).toBe(true);
    expect(selected.every((s) => !s.url.includes('linkedin.com'))).toBe(true);
  });

  it('attributes employer when name appears on page', () => {
    const ok = employerAttributionMatches({
      expectedEmployer: 'Acme Robotics GmbH',
      pageUrl: 'https://careers.acme-robotics.example/jobs/frontend-engineer',
      pageBody:
        '<html><body><h1>Frontend Engineer</h1><p>Acme Robotics hiring</p><p>Full-time · Apply now</p></body></html>',
      expectedTitle: 'Frontend Engineer',
    });
    expect(ok.ok).toBe(true);
  });

  it('rejects attribution mismatch', () => {
    const bad = employerAttributionMatches({
      expectedEmployer: 'Acme Robotics',
      pageUrl: 'https://careers.beta-widgets.example/jobs/fe',
      pageBody: '<html><body><h1>Frontend Engineer</h1><p>Beta Widgets hiring</p></body></html>',
      expectedTitle: 'Frontend Engineer',
    });
    expect(bad.ok).toBe(false);
  });

  it('resolves expected employer from extracted fields', () => {
    expect(
      resolveExpectedEmployer({
        fields: { organization: 'Acme Robotics', title: 'Engineer' },
      })
    ).toBe('Acme Robotics');
    expect(normalizeEmployerName('Acme Robotics GmbH')).toBe('acme robotics');
  });

  it('E12.11 prefers host-aligned JobPosting identifier over mismatched hiringOrganization', () => {
    const structuredData = JSON.stringify([
      {
        '@type': 'JobPosting',
        title: 'Senior Frontend Engineer (m/f/d)',
        hiringOrganization: { '@type': 'Organization', name: 'SIXT' },
        identifier: { '@type': 'PropertyValue', name: 'Netz & Werke', value: '39132' },
      },
    ]);
    expect(
      resolveExpectedEmployer(
        {
          fields: {
            title: 'Senior Frontend Engineer (m/f/d) in Pullach near Munich - Netz & Werke',
            organization: 'SIXT',
            structuredData,
          },
        },
        { discoveryUrl: 'https://netzundwerke.de/jobs/senior-frontend-engineer-mfd' }
      )
    ).toBe('Netz & Werke');
  });

  it('E12.11 prefers JobPosting hiringOrganization over bare Organization', () => {
    const structuredData = JSON.stringify([
      { '@type': 'Organization', name: 'Some Partner' },
      {
        '@type': 'JobPosting',
        title: 'Frontend Engineer',
        hiringOrganization: { name: 'Auteon' },
      },
    ]);
    expect(
      resolveExpectedEmployer(
        {
          fields: {
            title: 'Open Positions at auteon',
            organization: 'Some Partner',
            structuredData,
          },
        },
        { discoveryUrl: 'https://www.auteon.com/jobs/senior-frontend-engineer' }
      )
    ).toBe('Auteon');
  });

  it('E12.11 title∩host brand fallback when structured employer is missing', () => {
    expect(
      resolveExpectedEmployer(
        {
          fields: {
            title: 'Open Positions at auteon - Apply now!',
          },
        },
        { discoveryUrl: 'https://www.auteon.com/jobs/senior-frontend-engineer' }
      )
    ).toMatch(/auteon/i);

    expect(
      resolveExpectedEmployer(
        {
          fields: {
            title: 'Senior – Frontend – Developer (m/f/d) – dresden|exists',
          },
        },
        { discoveryUrl: 'https://www.dresden-exists.de/jobs/senior-frontend-developer-m-f-d' }
      )
    ).toMatch(/dresden/i);
  });

  it('E12.11 does not infer employer from hostname without title corroboration', () => {
    expect(
      resolveExpectedEmployer(
        {
          fields: {
            title: 'Senior Frontend Engineer',
          },
        },
        { discoveryUrl: 'https://www.auteon.com/jobs/senior-frontend-engineer' }
      )
    ).toBeUndefined();
  });

  it('E12.11 does not title-fallback on known non-employer hosts', () => {
    expect(
      resolveExpectedEmployer(
        {
          fields: {
            title: 'Senior Frontend Engineer - Zalando | BeBee',
          },
        },
        {
          discoveryUrl:
            'https://bebee.com/de/jobs/senior-frontend-engineer-zeos-all-genders-zalando',
        }
      )
    ).toBeUndefined();
  });

  it('E12.5 rejects marketing/events page when only title overlap would pass', () => {
    const bad = employerAttributionMatches({
      expectedEmployer: 'Example Corp',
      pageUrl: 'https://events.example-corp.example/',
      pageBody: FIXTURE_EMPLOYER_MARKETING_EVENTS_HTML,
      expectedTitle: 'Senior Frontend Engineer Job Description [+TEMPLATE 2024]',
    });
    expect(bad.ok).toBe(false);
    expect(bad.detail).toContain('not recognizably a job posting');
  });

  it('E12.5 passes attribution via JobPosting JSON-LD without title overlap', () => {
    const ok = employerAttributionMatches({
      expectedEmployer: 'Acme Robotics',
      pageUrl: 'https://www.acme-robotics.example/',
      pageBody: FIXTURE_OFFICIAL_EMPLOYER_JOB_HTML,
      expectedTitle: 'Unrelated Marketing Page Title',
    });
    expect(ok.ok).toBe(true);
  });

  it('E12.10 host authority requires employer name in hostname, not body alone', () => {
    expect(
      isEmployerControlledDiscoveryHost({
        discoveryUrl: 'https://www.auteon.example/jobs/fe',
        expectedEmployer: 'Auteon',
      })
    ).toBe(true);
    expect(
      isEmployerControlledDiscoveryHost({
        discoveryUrl: 'https://board.example/jobs/fe',
        expectedEmployer: 'Acme Robotics',
      })
    ).toBe(false);
    expect(employerNameMatchesHost('Acme Robotics', 'careers.acme-robotics.example')).toBe(
      true
    );
  });
});
