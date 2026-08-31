/**
 * Small anonymized fixtures for E2.2 Collect/Parse tests.
 * Not copied from real employer sites.
 */

export const FIXTURE_JOB_FULL_HTML = `<!DOCTYPE html>
<html>
  <body>
    <h1>Senior Frontend Engineer</h1>
    <div data-field="location">Berlin</div>
    <div data-field="salary">€70,000–€85,000</div>
    <div data-field="employmentType">full-time</div>
  </body>
</html>`;

export const FIXTURE_JOB_UNKNOWN_SALARY_HTML = `<!DOCTYPE html>
<html>
  <body>
    <h1>Frontend Engineer</h1>
    <div data-field="location">Munich</div>
  </body>
</html>`;

export const FIXTURE_JOB_TEXT = `Title: Backend Engineer
Location: Hamburg
Salary: €65,000`;

export const FIXTURE_MALFORMED = `<<<not-parseable>>>`;

export type CollectParseFixtureId =
  | 'job-full'
  | 'job-unknown-salary'
  | 'job-text'
  | 'malformed';

export const COLLECT_PARSE_FIXTURES: Record<
  CollectParseFixtureId,
  { body: string; contentType: string }
> = {
  'job-full': {
    body: FIXTURE_JOB_FULL_HTML,
    contentType: 'text/html',
  },
  'job-unknown-salary': {
    body: FIXTURE_JOB_UNKNOWN_SALARY_HTML,
    contentType: 'text/html',
  },
  'job-text': {
    body: FIXTURE_JOB_TEXT,
    contentType: 'text/plain',
  },
  malformed: {
    body: FIXTURE_MALFORMED,
    contentType: 'text/plain',
  },
};
