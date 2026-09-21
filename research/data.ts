/**
 * Every number in the technical report, computed from the recorded runs.
 *
 * Nothing in the report is typed by hand: the template reads data.json, and data.json
 * is written here from the result files committed in eval/. Re-running this after a
 * new evaluation updates every figure, table and chart in the same pass.
 *
 * Usage:  npx tsx research/data.ts
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadPrograms } from '@/lib/criteria';
import { runConformance } from '@/eval/conformance';
import { EXTRACTION_CASES } from '@/eval/extraction';
import { HOLDOUT_CASES } from '@/eval/extraction-holdout';
import { HERO_FIGURES } from '@/lib/hero';

const root = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));

// ---------------------------------------------------------------- statistics

/** Wilson score interval for a binomial proportion (Wilson 1927), 95%. */
function wilson(successes: number, n: number, z = 1.959963984540054): [number, number] {
  if (n === 0) return [0, 1];
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

function logChoose(n: number, k: number): number {
  let s = 0;
  for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i);
  return s;
}

/** Exact two-sided McNemar test on discordant pairs b and c (binomial, p = 0.5). */
function mcnemarExact(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  const k = Math.min(b, c);
  let tail = 0;
  for (let i = 0; i <= k; i++) tail += Math.exp(logChoose(n, i) - n * Math.log(2));
  return Math.min(1, 2 * tail);
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length === 0 ? 0 : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

// ---------------------------------------------------------------- one run

interface Row {
  id: string;
  slice: string;
  predicted: Record<string, boolean>;
  truth: Record<string, boolean>;
  questionsAsked: string[];
  wallClockMs: number;
  passTotals?: number[];
  criteriaEvaluated?: number;
}

function summariseRun(run: { perHousehold: Row[]; balancedAccuracyByProgram: Record<string, number>; usage?: { calls: number; inputTokens: number; outputTokens: number }; billedUSD?: number; accuracyBySlice?: Record<string, number>; questionRelevance?: number; questionAskedAtAllRate?: number; tau?: number }) {
  const rows = run.perHousehold;
  const specified = rows.filter((r) => r.slice !== 'underspecified');
  const under = rows.filter((r) => r.slice === 'underspecified');
  const programs = Object.keys(run.balancedAccuracyByProgram);
  const count = (set: Row[]) => {
    let right = 0;
    let total = 0;
    let falsePositive = 0;
    let falseNegative = 0;
    for (const r of set)
      for (const p of programs) {
        total++;
        if (r.predicted[p] === r.truth[p]) right++;
        else if (r.predicted[p]) falsePositive++;
        else falseNegative++;
      }
    return { right, total, wrong: total - right, falsePositive, falseNegative, ci: wilson(right, total) };
  };
  let answered = 0;
  let moved = 0;
  for (const r of rows)
    for (let i = 1; i < (r.passTotals?.length ?? 0); i++) {
      answered++;
      if (r.passTotals![i] !== r.passTotals![i - 1]) moved++;
    }
  const questions = rows.map((r) => r.questionsAsked.length);
  return {
    households: rows.length,
    specifiedHouseholds: specified.length,
    underspecifiedHouseholds: under.length,
    programs: programs.length,
    meanBalancedAccuracy: mean(Object.values(run.balancedAccuracyByProgram)),
    balancedAccuracyByProgram: run.balancedAccuracyByProgram,
    specified: count(specified),
    underspecified: count(under),
    questionsTotal: questions.reduce((a, b) => a + b, 0),
    questionsMedian: median(questions),
    questionsHistogram: [0, 1, 2, 3].map((k) => questions.filter((q) => q === k).length),
    usefulQuestions: answered ? { moved, answered, rate: moved / answered } : null,
    questionRelevance: run.questionRelevance ?? null,
    askedAtAllRate: run.questionAskedAtAllRate ?? null,
    medianSeconds: median(rows.map((r) => r.wallClockMs)) / 1000,
    medianCriteria: median(rows.map((r) => r.criteriaEvaluated ?? 0)),
    usage: run.usage ?? null,
    billedUSD: run.billedUSD ?? null,
    costPerHouseholdUSD: run.billedUSD !== undefined ? run.billedUSD / rows.length : null,
    tau: run.tau ?? null,
    errors: specified.flatMap((r) =>
      programs.filter((p) => r.predicted[p] !== r.truth[p]).map((p) => ({ id: r.id, program: p, predicted: r.predicted[p] }))
    ),
  };
}

// ---------------------------------------------------------------- the runs

const compared = read('eval/runs/2026-09-21-jev-holdout-compared.json');
const baseline = read('eval/baseline-results.json');
const final = read('eval/results.json');
const firstRun = read('eval/runs/2026-09-21-jev-holdout-first.json');
const sweep = read('eval/tau-sweep.json');
const readingSix = read('eval/reading-holdout.json');

const jevCompared = summariseRun(compared);
const sonnet = summariseRun(baseline);
const jevFinal = summariseRun(final);

// Paired comparison: the same households x 21 programs, each verdict right or wrong,
// for the fully specified households and, separately, the underspecified ones.
const byId = new Map<string, Row>(baseline.perHousehold.map((r: Row) => [r.id, r]));
function paired(underspecified: boolean) {
  let bothRight = 0, onlyJev = 0, onlySonnet = 0, bothWrong = 0;
  for (const r of compared.perHousehold as Row[]) {
    if ((r.slice === 'underspecified') !== underspecified) continue;
    const s = byId.get(r.id)!;
    for (const p of Object.keys(compared.balancedAccuracyByProgram)) {
      const j = r.predicted[p] === r.truth[p];
      const b = s.predicted[p] === s.truth[p];
      if (j && b) bothRight++;
      else if (j) onlyJev++;
      else if (b) onlySonnet++;
      else bothWrong++;
    }
  }
  return { bothRight, onlyJev, onlySonnet, bothWrong, mcnemarP: mcnemarExact(onlyJev, onlySonnet) };
}

// ---------------------------------------------------------------- reading history

const S = (commit: string) => JSON.parse(execSync(`git show ${commit}:eval/results.json`, { cwd: root, encoding: 'utf8' }));
const editions = [
  { edition: 1, commit: '55da212~1' },
  { edition: 2, commit: '55da212' },
  { edition: 3, commit: '7c7737c' },
  { edition: 4, commit: 'c14a1fa' },
  { edition: 5, commit: '3ae5428' },
].map(({ edition, commit }) => {
  const h = S(commit).extraction.holdout;
  return { edition, reader: 'code', correct: h.correct, total: h.total, rate: h.rate, ci: wilson(h.correct, h.total) };
});
editions.push(
  { edition: 6, reader: 'code', correct: readingSix.codeParser.correct, total: readingSix.codeParser.total, rate: readingSix.codeParser.rate, ci: wilson(readingSix.codeParser.correct, readingSix.codeParser.total) },
  { edition: 6, reader: 'code+jev', correct: readingSix.withEngine.correct, total: readingSix.withEngine.total, rate: readingSix.withEngine.rate, ci: wilson(readingSix.withEngine.correct, readingSix.withEngine.total) }
);

// ---------------------------------------------------------------- development ablations

const dev = (name: string) => summariseRun(read(`eval/runs/dev/${name}.json`));
const floors = [
  { floorUSD: 0, run: dev('dev-va') },
  { floorUSD: 25, run: dev('dev-floor-2500') },
  { floorUSD: 50, run: dev('dev-floor-5000') },
  { floorUSD: 100, run: dev('dev-floor-10000') },
  { floorUSD: 250, run: dev('dev-floor-25000') },
].map(({ floorUSD, run }) => ({
  floorUSD,
  questions: run.questionsTotal,
  useful: run.usefulQuestions,
  meanBalancedAccuracy: run.meanBalancedAccuracy,
  specifiedWrong: run.specified.wrong,
  underspecifiedAccuracy: run.underspecified.right / Math.max(1, run.underspecified.total),
  questionRelevance: run.questionRelevance,
}));

const devStages = [
  { stage: 'Expected value, no floor', run: dev('dev-va') },
  { stage: '+ $25 floor', run: dev('dev-floor-2500') },
  { stage: '+ candidate reading', run: dev('dev-reader') },
  { stage: '+ not-stated option, Medicare gate', run: dev('dev-fix56b') },
].map(({ stage, run }) => ({
  stage,
  questions: run.questionsTotal,
  useful: run.usefulQuestions,
  questionRelevance: run.questionRelevance,
  specifiedWrong: run.specified.wrong,
  meanBalancedAccuracy: run.meanBalancedAccuracy,
}));

// ---------------------------------------------------------------- the set-up

const gold = readFileSync(join(root, 'data/gold/households.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const slices: Record<string, { dev: number; holdout: number }> = {};
for (const h of gold) {
  slices[h.slice] ??= { dev: 0, holdout: 0 };
  slices[h.slice][h.split === 'holdout' ? 'holdout' : 'dev']++;
}
const conformance = runConformance();
const programs = loadPrograms();

const JEV_PRICE_PER_MTOK = 0.042;

const data = {
  generatedAt: new Date().toISOString(),
  commit: execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim(),
  setup: {
    programs: programs.length,
    programNames: programs.map((p) => p.shortName),
    jurisdictions: 51,
    rulesCheckedExample: HERO_FIGURES.rulesChecked,
    conformance: { passed: conformance.filter((c) => c.passed).length, total: conformance.length },
    gold: { total: gold.length, dev: gold.filter((h) => h.split !== 'holdout').length, holdout: gold.filter((h) => h.split === 'holdout').length, slices },
    readingDevCases: EXTRACTION_CASES.length,
    readingHoldoutCases: HOLDOUT_CASES.length,
    tauChosen: sweep.chosen,
    tauRule: sweep.rule,
    jevModel: 'jev-1.13.0',
    jevPricePerMTok: JEV_PRICE_PER_MTOK,
    baselineModel: 'anthropic/claude-sonnet-5',
    baselineBatchSize: 15,
  },
  sweep: sweep.sweep,
  reading: {
    editions,
    sixByField: { code: readingSix.codeParser.byField, withEngine: readingSix.withEngine.byField },
    sixMisses: readingSix.withEngine.misses,
  },
  endToEnd: {
    jevCompared,
    sonnet,
    jevFinal,
    firstRunWrong: summariseRun(firstRun).specified.wrong,
    paired: paired(false),
    pairedUnderspecified: paired(true),
    ratios: {
      speed: sonnet.medianSeconds / jevCompared.medianSeconds,
      cost: sonnet.costPerHouseholdUSD! / jevCompared.costPerHouseholdUSD!,
      inputTokens: sonnet.usage!.inputTokens / jevCompared.usage!.inputTokens,
    },
    generationFaults: baseline.generationFaults,
  },
  development: { floors, stages: devStages },
};

writeFileSync(join(root, 'research/data.json'), JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify({
  conformance: data.setup.conformance,
  jev: [jevCompared.meanBalancedAccuracy, jevCompared.specified.wrong, jevCompared.medianSeconds, jevCompared.costPerHouseholdUSD],
  sonnet: [sonnet.meanBalancedAccuracy, sonnet.specified.wrong, sonnet.medianSeconds, sonnet.costPerHouseholdUSD],
  final: [jevFinal.meanBalancedAccuracy, jevFinal.specified.wrong, jevFinal.questionsTotal, jevFinal.usefulQuestions],
  paired: data.endToEnd.paired,
  ratios: data.endToEnd.ratios,
}, null, 1));
