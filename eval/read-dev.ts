/**
 * Score a reader on the development extraction set, for designing the engine-assisted
 * reader without touching a held-out set.
 *
 * Usage:  npx tsx eval/read-dev.ts              (both readers, development set)
 *         npx tsx eval/read-dev.ts --holdout    (both readers, held-out set: once only)
 */

import { engineFromEnv } from '@/lib/engine';
import { readHousehold } from '@/lib/read';
import { EXTRACTION_CASES, runExtraction, runExtractionWith, type ExtractionScore } from './extraction';
import { HOLDOUT_CASES } from './extraction-holdout';

function show(label: string, s: ExtractionScore) {
  const pct = (a: number, b: number) => ((100 * a) / b).toFixed(1);
  console.log(`\n${label}: ${s.overall.correct}/${s.overall.total} (${pct(s.overall.correct, s.overall.total)}%)`);
  for (const [field, v] of Object.entries(s.byField)) console.log(`  ${field.padEnd(15)} ${v.correct}/${v.total}`);
}

async function main() {
  const engine = engineFromEnv();
  const cases = process.argv.includes('--holdout') ? HOLDOUT_CASES : EXTRACTION_CASES;
  console.log(process.argv.includes('--holdout') ? 'HELD-OUT set' : 'development set');
  const code = runExtraction(cases);
  show('code parser', code);
  const hybrid = await runExtractionWith(cases, (p) => readHousehold(p, engine));
  show(`code + ${engine.name}`, hybrid);

  console.log('\nwhere they differ:');
  hybrid.results.forEach((r, i) => {
    r.fields.forEach((f, j) => {
      const c = code.results[i].fields[j];
      if (f.correct !== c.correct) {
        console.log(`  ${r.id} ${f.field}: expected ${f.expected}; code ${c.got}${c.correct ? ' ✓' : ''}; reader ${f.got}${f.correct ? ' ✓' : ''}`);
      }
    });
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
