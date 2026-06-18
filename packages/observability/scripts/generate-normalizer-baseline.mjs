import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNormalizerGoldenBaseline } from '../dist/drift/validateNormalizerIntegrity.js';

const outputPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../baselines/normalizer-golden-baseline.json'
);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `${JSON.stringify(buildNormalizerGoldenBaseline(), null, 2)}\n`,
  'utf8'
);
console.log(`Wrote normalizer golden baseline to ${outputPath}`);
