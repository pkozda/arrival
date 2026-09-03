/**
 * Minimal anonymized fixtures for E12.2 official employer verification bridge.
 * Not copied from real employer or aggregator sites.
 */

export const FIXTURE_AGGREGATOR_WITH_EMPLOYER_LINK_HTML = `<!DOCTYPE html>
<html>
  <head><title>Frontend Engineer - Job Board</title></head>
  <body>
    <h1>Frontend Engineer</h1>
    <div data-field="organization">Acme Robotics</div>
    <div data-field="company">Acme Robotics</div>
    <div data-field="location">Berlin</div>
    <p>Posted on JobBoard Example.</p>
    <a href="https://careers.acme-robotics.example/jobs/frontend-engineer">
      Apply on company career site
    </a>
  </body>
</html>`;

export const FIXTURE_OFFICIAL_EMPLOYER_JOB_HTML = `<!DOCTYPE html>
<html>
  <head>
    <title>Frontend Engineer — Acme Robotics</title>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Frontend Engineer",
        "url": "https://careers.acme-robotics.example/jobs/frontend-engineer",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "Acme Robotics",
          "url": "https://www.acme-robotics.example"
        },
        "jobLocation": {
          "@type": "Place",
          "address": { "@type": "PostalAddress", "addressLocality": "Berlin" }
        }
      }
    </script>
  </head>
  <body>
    <h1>Frontend Engineer</h1>
    <p>Acme Robotics is hiring a Frontend Engineer in Berlin.</p>
    <p>Full-time · Permanent</p>
  </body>
</html>`;

export const FIXTURE_MISMATCHED_EMPLOYER_JOB_HTML = `<!DOCTYPE html>
<html>
  <head><title>Frontend Engineer — Beta Widgets</title></head>
  <body>
    <h1>Frontend Engineer</h1>
    <p>Beta Widgets GmbH careers page.</p>
    <p>Join Beta Widgets in Munich.</p>
  </body>
</html>`;

/** E12.5 — employer marketing/events hub; name + title overlap but no vacancy signals. */
export const FIXTURE_EMPLOYER_MARKETING_EVENTS_HTML = `<!DOCTYPE html>
<html>
  <head><title>Events — Example Corp</title></head>
  <body>
    <h1>Example Corp Events</h1>
    <p>Join us to learn about hiring Senior Frontend Engineers and building great teams.</p>
    <p>Example Corp connects employers and candidates worldwide.</p>
  </body>
</html>`;

export const FIXTURE_AGGREGATOR_WITH_EVENTS_LINK_HTML = `<!DOCTYPE html>
<html>
  <head><title>Senior Frontend Engineer Job Description [+TEMPLATE 2024]</title></head>
  <body>
    <h1>Senior Frontend Engineer Job Description [+TEMPLATE 2024]</h1>
    <div data-field="organization">Example Corp</div>
    <p>Resource template — not a specific vacancy.</p>
    <a href="https://events.example-corp.example/">Example Corp Events</a>
  </body>
</html>`;

export const FIXTURE_AGGREGATOR_JOBPOSTING_ONLY_HTML = `<!DOCTYPE html>
<html>
  <head>
    <title>Frontend Engineer - Aggregator</title>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Frontend Engineer",
        "hiringOrganization": { "@type": "Organization", "name": "Acme Robotics" }
      }
    </script>
  </head>
  <body>
    <h1>Frontend Engineer</h1>
    <div data-field="organization">Acme Robotics</div>
    <p>This is the official careers page.</p>
    <p>Aggregator mirror — no off-domain employer apply link.</p>
  </body>
</html>`;

/** E12.10 — employer-controlled discovery page with job path (no JSON-LD required). */
export const FIXTURE_DIRECT_EMPLOYER_JOB_PATH_HTML = `<!DOCTYPE html>
<html>
  <head><title>Senior Frontend Engineer — Auteon</title></head>
  <body>
    <h1>Senior Frontend Engineer</h1>
    <div data-field="organization">Auteon</div>
    <div data-field="company">Auteon</div>
    <p>Auteon is hiring a Senior Frontend Engineer in Germany.</p>
    <p>Full-time · Permanent · Apply now</p>
  </body>
</html>`;

/** E12.14 — listing index that embeds JobPosting JSON-LD (must still reject). */
export const FIXTURE_CAREERS_LISTING_WITH_JOBPOSTING_LD_HTML = `<!DOCTYPE html>
<html>
  <head>
    <title>Careers | Example Corp</title>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Senior Frontend Engineer",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "Example Corp"
        }
      }
    </script>
  </head>
  <body>
    <h1>Open Positions</h1>
    <p>Example Corp delivers outcomes for important institutions.</p>
    <p>Build the future, while building your career.</p>
    <h2>Students and Early Talent</h2>
    <p>Internship and New Grad Opportunities are open. Apply now.</p>
    <h2>Getting Hired</h2>
    <p>Learn more about Life at Example Corp.</p>
    <ul>
      <li>Backend Engineer</li>
      <li>Product Designer</li>
      <li>Data Analyst</li>
    </ul>
  </body>
</html>`;

/** E12.14 — anonymized careers open-positions index (must not promote). */
export const FIXTURE_CAREERS_OPEN_POSITIONS_INDEX_HTML = `<!DOCTYPE html>
<html>
  <head><title>Careers | Example Corp</title></head>
  <body>
    <h1>Open Positions</h1>
    <p>Example Corp delivers outcomes for important institutions.</p>
    <p>Build the future, while building your career.</p>
    <h2>Students and Early Talent</h2>
    <p>Internship and New Grad Opportunities are open. Apply now.</p>
    <h2>Getting Hired</h2>
    <p>Learn more about Life at Example Corp.</p>
    <h2>Contractor Opportunities</h2>
    <p>Please visit the Contractor Opportunities site.</p>
  </body>
</html>`;

/** E12.14 — bare employer careers landing. */
export const FIXTURE_GENERIC_CAREERS_LANDING_HTML = `<!DOCTYPE html>
<html>
  <head><title>Careers — Example Corp</title></head>
  <body>
    <h1>Careers</h1>
    <p>Explore our careers and Life at Example Corp.</p>
    <p>Search jobs across teams. Getting Hired resources available.</p>
  </body>
</html>`;

/** E12.14 — generic /jobs index with many openings. */
export const FIXTURE_GENERIC_JOBS_INDEX_HTML = `<!DOCTYPE html>
<html>
  <head><title>All Jobs — Example Corp</title></head>
  <body>
    <h1>All Jobs</h1>
    <p>Browse all jobs and open positions at Example Corp.</p>
    <ul>
      <li>Backend Engineer</li>
      <li>Product Designer</li>
      <li>Data Analyst</li>
    </ul>
  </body>
</html>`;

/** E12.14 — multi-job search results page. */
export const FIXTURE_JOB_SEARCH_RESULTS_HTML = `<!DOCTYPE html>
<html>
  <head><title>Search Jobs — Example Corp</title></head>
  <body>
    <h1>Search Jobs</h1>
    <p>Search our job opportunities. View all openings.</p>
    <p>12 results for frontend</p>
  </body>
</html>`;

/** E12.14 — individual vacancy under /careers/... (must still accept). */
export const FIXTURE_INDIVIDUAL_VACANCY_UNDER_CAREERS_HTML = `<!DOCTYPE html>
<html>
  <head><title>Senior Frontend Engineer — Example Corp</title></head>
  <body>
    <h1>Senior Frontend Engineer</h1>
    <p>Example Corp is hiring a Senior Frontend Engineer.</p>
    <p>Full-time · Permanent · Apply now</p>
    <p>We are looking for someone who will own the product UI.</p>
  </body>
</html>`;

/** E12.14 — ATS-style vacancy with opaque path + vacancy content. */
export const FIXTURE_ATS_INDIVIDUAL_VACANCY_HTML = `<!DOCTYPE html>
<html>
  <head><title>Senior Frontend Engineer (m/f/d)</title></head>
  <body>
    <h1>Senior Frontend Engineer (m/f/d)</h1>
    <div data-field="organization">Msg Services</div>
    <p>Full-time · Munich · Apply now</p>
    <p>Responsibilities include building customer-facing apps.</p>
    <p>Requirements: TypeScript, React.</p>
  </body>
</html>`;

/** E12.10 — employer-controlled discovery page without JOB_PATH; JobPosting JSON-LD present. */
export const FIXTURE_DIRECT_EMPLOYER_JOBPOSTING_LD_HTML = `<!DOCTYPE html>
<html>
  <head>
    <title>Careers — Acme Robotics</title>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Frontend Engineer",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "Acme Robotics",
          "url": "https://www.acme-robotics.example"
        }
      }
    </script>
  </head>
  <body>
    <h1>Frontend Engineer</h1>
    <p>Acme Robotics is hiring.</p>
  </body>
</html>`;

/** E12.10 — aggregator host mentioning employer + /jobs/ + JobPosting (must NOT self-qualify). */
export const FIXTURE_THIRD_PARTY_BOARD_WITH_EMPLOYER_HTML = `<!DOCTYPE html>
<html>
  <head>
    <title>Senior Frontend Engineer (m/f/d) - Jedox | BeBee</title>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Senior Frontend Engineer (m/f/d)",
        "url": "https://bebee.com/de/jobs/jedox-senior-frontend",
        "hiringOrganization": { "@type": "Organization", "name": "Jedox" }
      }
    </script>
  </head>
  <body>
    <h1>Senior Frontend Engineer (m/f/d) - Jedox</h1>
    <div data-field="organization">Jedox</div>
    <p>Posted on BeBee job board.</p>
  </body>
</html>`;