import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

async function main() {
  const { compiledModuleCatalog } = await import('@arrivalos/modules');

  const baseline = {
    version: '1.0.0',
    modules: Object.fromEntries(
      compiledModuleCatalog.contracts.map((contract) => [
        contract.moduleId,
        {
          version: contract.version,
          ...compiledModuleCatalog.fingerprintsByModuleId[contract.moduleId],
        },
      ])
    ),
  };

  const outputPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../baselines/module-version-baseline.json'
  );

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
  console.log(`Wrote module version baseline to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
