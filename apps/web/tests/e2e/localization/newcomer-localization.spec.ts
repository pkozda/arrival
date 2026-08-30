import { test } from '@playwright/test';
import {
  LOCALIZATION_LOCALES,
  assertLocalizationClean,
  runNewcomerLocalizationAudit,
} from './fixtures';

/**
 * Automated newcomer localization reality check.
 *
 * Starts from a cleared browser context, selects language via Arrival Welcome UI,
 * then audits visible chrome for unexpected English / raw translation keys.
 *
 * Does not fix product gaps — it reports them.
 *
 * Run:
 *   PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" npm run test:e2e:localization -w @arrival-atlas/web
 */
test.describe('Localization smoke — newcomer path', () => {
  for (const locale of LOCALIZATION_LOCALES) {
    test(`newcomer localization: ${locale}`, async ({ page }) => {
      test.setTimeout(120_000);
      const report = await runNewcomerLocalizationAudit(page, locale);
      // Structured report is included in the assertion message on failure.
      // eslint-disable-next-line no-console
      console.log(formatQuickSummary(report));
      assertLocalizationClean(report);
    });
  }
});

function formatQuickSummary(report: {
  locale: string;
  documentLang?: string;
  surfaces: Array<{ surface: string; present: boolean; findings: unknown[] }>;
  findings: unknown[];
}): string {
  const lines = [
    `\n[localization-smoke] ${report.locale} (html lang=${report.documentLang ?? '?'})`,
  ];
  for (const surface of report.surfaces) {
    const mark = !surface.present ? '○' : surface.findings.length === 0 ? '✓' : '✗';
    lines.push(`  ${mark} ${surface.surface}${surface.present ? '' : ' (absent)'}`);
  }
  lines.push(`  findings: ${report.findings.length}`);
  return lines.join('\n');
}
