/**
 * How the generative baseline's stated confidences land on the typed engine's
 * confidence scale, from the baseline's cached responses.
 *
 * The baseline states one confidence s for the option it chose. The harness spreads
 * that into a distribution (s on the choice, the rest shared evenly) and measures it
 * with normalised entropy, the same scale tau was chosen on for the typed engine. This
 * reports how often that conversion put an answer below tau, and what stated
 * confidence a two-option answer needs to clear it: the mechanism behind the
 * baseline's follow-up behaviour, measured rather than argued.
 *
 * Usage:  npx tsx research/baseline-confidence.ts
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { loadPrograms } from '@/lib/criteria';
import { confidenceOf } from '@/lib/engine/types';

const root = process.cwd();
const TAU = JSON.parse(readFileSync(join(root, 'eval/tau-sweep.json'), 'utf8')).chosen as number;

const optionsCount = new Map<string, number>();
for (const p of loadPrograms()) for (const c of p.criteria) optionsCount.set(c.id, Object.keys(c.criteria).length);

function converted(stated: number, k: number): number {
  const top = k === 1 ? 1 : Math.max(stated, 1 / k + 1e-6);
  const dist = Object.fromEntries(Array.from({ length: k }, (_, i) => [String(i), i === 0 ? top : (1 - top) / (k - 1)]));
  return confidenceOf(dist);
}

/** The smallest stated confidence that clears tau for a k-option answer. */
function threshold(k: number): number {
  let lo = 1 / k;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (converted(mid, k) >= TAU) hi = mid;
    else lo = mid;
  }
  return hi;
}

function analyse(dir: string) {
  const path = join(root, dir);
  if (!existsSync(path)) return null;
  const stated: number[] = [];
  let below = 0;
  let total = 0;
  for (const f of readdirSync(path)) {
    const r = JSON.parse(readFileSync(join(path, f), 'utf8'));
    for (const [id, a] of Object.entries(r.answers as Record<string, { choice: string | null; selfReportedConfidence: number | null }>)) {
      if (a.choice === null || a.selfReportedConfidence === null) continue;
      const k = optionsCount.get(id.split('#')[0]) ?? 2;
      total++;
      stated.push(a.selfReportedConfidence);
      if (converted(a.selfReportedConfidence, k) < TAU) below++;
    }
  }
  stated.sort((a, b) => a - b);
  const q = (x: number) => stated[Math.floor(x * (stated.length - 1))];
  return {
    answers: total,
    belowTau: below,
    belowTauShare: total ? below / total : 0,
    statedMedian: q(0.5),
    statedP25: q(0.25),
    statedP75: q(0.75),
  };
}

const out = {
  tau: TAU,
  statedNeededToClearTau: { twoOptions: threshold(2), fourOptions: threshold(4) },
  batchedSchema: analyse('eval/.cache/sonnet'),
  singleRequest: analyse('eval/.cache/sonnet-single'),
};
writeFileSync(join(root, 'eval/runs/baseline-confidence.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 1));
