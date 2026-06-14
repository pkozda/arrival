import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BenefitsSimulatorInputSchema } from './schema.js';
import { runBenefitsSimulator } from './orchestrator.js';

interface GoldenScenarioExpect {
  baselineTotalHouseholdResources: number;
  baselineBuergergeld: number;
  scenarioOrder: string[];
  scenarios: Array<{
    id: string;
    totalHouseholdResources: number;
    buergergeldDelta: number;
    deltaFromBaseline: number;
  }>;
  hasRiskWarnings: boolean;
  riskWarningCategories?: string[];
  bestScenarioId: string | null;
  spread: number;
}

interface GoldenFixture {
  id: string;
  description: string;
  input: unknown;
  expect: GoldenScenarioExpect;
}

interface GoldenFixtureFile {
  version: string;
  taxYear: number;
  fixtures: GoldenFixture[];
}

const fixturesPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../tests/fixtures/benefits-simulator-scenarios.json'
);

const fixtureFile = JSON.parse(
  readFileSync(fixturesPath, 'utf-8')
) as GoldenFixtureFile;

describe('Benefits Simulator golden scenarios', () => {
  expect(fixtureFile.fixtures.length).toBeGreaterThanOrEqual(12);

  for (const fixture of fixtureFile.fixtures) {
    it(`${fixture.id}: ${fixture.description}`, () => {
      const input = BenefitsSimulatorInputSchema.parse(fixture.input);
      const output = runBenefitsSimulator(input);

      expect(output.meta.schemaVersion).toBe(fixtureFile.version);
      expect(output.meta.taxYear).toBe(fixtureFile.taxYear);

      expect(output.baseline.financialImpact.totalHouseholdResources).toBe(
        fixture.expect.baselineTotalHouseholdResources
      );
      expect(output.baseline.benefitChanges.buergergeld.after).toBe(
        fixture.expect.baselineBuergergeld
      );

      expect(output.scenarios.map((s) => s.id)).toEqual(fixture.expect.scenarioOrder);

      for (const expectedScenario of fixture.expect.scenarios) {
        const actual = output.scenarios.find((s) => s.id === expectedScenario.id);
        expect(actual).toBeDefined();
        expect(actual!.financialImpact.totalHouseholdResources).toBe(
          expectedScenario.totalHouseholdResources
        );
        expect(actual!.benefitChanges.buergergeld.delta).toBe(
          expectedScenario.buergergeldDelta
        );
        expect(actual!.financialImpact.deltaFromBaseline).toBe(
          expectedScenario.deltaFromBaseline
        );
      }

      expect(output.riskWarnings.length > 0).toBe(fixture.expect.hasRiskWarnings);

      if (fixture.expect.riskWarningCategories) {
        const categories = [...new Set(output.riskWarnings.map((w) => w.category))].sort();
        expect(categories).toEqual([...fixture.expect.riskWarningCategories].sort());
      }

      expect(output.comparison.bestScenarioId).toBe(fixture.expect.bestScenarioId);
      expect(output.comparison.spread).toBe(fixture.expect.spread);
    });
  }

  it('produces deterministic output across repeated runs', () => {
    const fixture = fixtureFile.fixtures[0]!;
    const input = BenefitsSimulatorInputSchema.parse(fixture.input);

    const first = runBenefitsSimulator(input);
    const second = runBenefitsSimulator(input);

    expect(second.baseline.financialImpact.totalHouseholdResources).toBe(
      first.baseline.financialImpact.totalHouseholdResources
    );
    expect(second.scenarios.map((s) => s.financialImpact.totalHouseholdResources)).toEqual(
      first.scenarios.map((s) => s.financialImpact.totalHouseholdResources)
    );
    expect(second.comparison).toEqual(first.comparison);
  });
});
