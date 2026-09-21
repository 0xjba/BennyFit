/**
 * Run the gold set and write the numbers the interface displays.
 *
 * Two figures matter and they are reported separately. What a household gained is a
 * product claim; how often the system is right is the only thing that makes the first
 * figure worth anything. Accuracy is reported as balanced accuracy, because the gold
 * set is four-fifths eligible for SNAP and a system that answered "eligible" to
 * everything would otherwise score 80%.
 *
 * Usage:  npx tsx eval/run.ts [--tau 0.5] [--max-questions 3] [--sweep]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { toDollars } from '@/lib/money';
import { engineFromEnv } from '@/lib/engine';
import { EngineClient } from '@/lib/engine/types';
import { DEFAULT_MAX_QUESTIONS, DEFAULT_TAU, screen } from '@/lib/loop';
import type { GoldHousehold } from '@/scripts/generate-gold';
import { oracleReply } from './oracle';

const AS_OF = '2026-09-21';
const PROGRAMS = [
  'snap',
  'eitc',
  'ctc',
  'lifeline',
  'wic',
  'school_meals',
  'csfp',
  'liheap',
  'head_start',
  'medicare_savings',
  'extra_help',
  'medicaid',
  'chip',
  'state_eitc',
  'cdctc',
  'va_pension',
  'summer_ebt',
  'sfmnp',
  'cacfp',
  'fdpir',
  'wap',
] as const;

function loadGold(): GoldHousehold[] {
  const path = join(process.cwd(), 'data', 'gold', 'households.jsonl');
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as GoldHousehold);
}

interface PerHousehold {
  id: string;
  slice: string;
  predicted: Record<string, boolean>;
  truth: Record<string, boolean>;
  predictedValues: Record<string, number>;
  truthValues: Record<string, number>;
  questionsAsked: string[];
  firstQuestion: string | null;
  loadBearingGap?: string;
  criteriaEvaluated: number;
  wallClockMs: number;
  engineMs: number;
  passes: number;
}

/**
 * Balanced accuracy: the mean of the true-positive rate and the true-negative rate.
 * Unlike plain accuracy it cannot be inflated by the mix of the set.
 */
function balancedAccuracy(rows: { predicted: boolean; truth: boolean }[]): {
  balanced: number;
  plain: number;
  truePositiveRate: number;
  trueNegativeRate: number;
  counts: { tp: number; fp: number; tn: number; fn: number };
} {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (const r of rows) {
    if (r.truth && r.predicted) tp++;
    else if (!r.truth && r.predicted) fp++;
    else if (!r.truth && !r.predicted) tn++;
    else fn++;
  }
  const tpr = tp + fn === 0 ? 1 : tp / (tp + fn);
  const tnr = tn + fp === 0 ? 1 : tn / (tn + fp);
  return {
    balanced: (tpr + tnr) / 2,
    plain: rows.length === 0 ? 1 : (tp + tn) / rows.length,
    truePositiveRate: tpr,
    trueNegativeRate: tnr,
    counts: { tp, fp, tn, fn },
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function runOnce(
  households: GoldHousehold[],
  engine: EngineClient,
  tau: number,
  maxQuestions: number
): Promise<PerHousehold[]> {
  const rows: PerHousehold[] = [];

  for (const household of households) {
    const result = await screen(household.paragraph, {
      engine,
      asOf: AS_OF,
      tau,
      maxQuestions,
      askUser: async (_question, criterion) => oracleReply(criterion.instanceId, household.facts),
    });

    rows.push({
      id: household.id,
      slice: household.slice,
      predicted: Object.fromEntries(
        PROGRAMS.map((p) => [p, result.verdicts[p]?.eligible ?? false])
      ),
      truth: Object.fromEntries(PROGRAMS.map((p) => [p, household.truth[p] === 'eligible'])),
      predictedValues: Object.fromEntries(
        PROGRAMS.map((p) => [p, toDollars(result.verdicts[p]?.annualValueCents ?? 0)])
      ),
      truthValues: Object.fromEntries(PROGRAMS.map((p) => [p, household.values[p] ?? 0])),
      questionsAsked: result.asked.map((a) => a.instanceId),
      firstQuestion: result.asked[0]?.instanceId ?? null,
      loadBearingGap: household.loadBearingGap,
      criteriaEvaluated: result.criteria.length,
      wallClockMs: result.totalElapsedMs,
      engineMs: result.passes.reduce((sum, p) => sum + p.engineElapsedMs, 0),
      passes: result.passes.length,
    });
  }

  return rows;
}

function summarise(rows: PerHousehold[]) {
  // Accuracy is measured on the fully specified households only. The underspecified
  // slice is missing a fact by construction, so scoring a verdict against it would
  // measure the loop's guess rather than the system's reading.
  const specified = rows.filter((r) => r.slice !== 'underspecified');
  const underspecified = rows.filter((r) => r.slice === 'underspecified');

  const balancedAccuracyByProgram: Record<string, ReturnType<typeof balancedAccuracy>> = {};
  for (const program of PROGRAMS) {
    balancedAccuracyByProgram[program] = balancedAccuracy(
      specified.map((r) => ({ predicted: r.predicted[program], truth: r.truth[program] }))
    );
  }

  const withGap = underspecified.filter((r) => r.loadBearingGap);
  const relevantFirst = withGap.filter(
    (r) => r.firstQuestion !== null && r.firstQuestion.split('#')[0] === r.loadBearingGap
  );
  const askedAtAll = withGap.filter((r) =>
    r.questionsAsked.some((q) => q.split('#')[0] === r.loadBearingGap)
  );

  const accuracyBySlice: Record<string, number> = {};
  for (const slice of new Set(rows.map((r) => r.slice))) {
    const sliceRows = rows.filter((r) => r.slice === slice);
    const all = PROGRAMS.flatMap((p) =>
      sliceRows.map((r) => ({ predicted: r.predicted[p], truth: r.truth[p] }))
    );
    accuracyBySlice[slice] = balancedAccuracy(all).balanced;
  }

  const totalSurfaced = rows.reduce(
    (sum, r) => sum + PROGRAMS.reduce((s, p) => s + (r.predicted[p] ? r.predictedValues[p] : 0), 0),
    0
  );
  const totalAvailable = rows.reduce(
    (sum, r) => sum + PROGRAMS.reduce((s, p) => s + (r.truth[p] ? r.truthValues[p] : 0), 0),
    0
  );

  return {
    balancedAccuracyByProgram: Object.fromEntries(
      PROGRAMS.map((p) => [p, balancedAccuracyByProgram[p].balanced])
    ),
    accuracyDetail: balancedAccuracyByProgram,
    accuracyBySlice,
    questionRelevance: withGap.length === 0 ? 0 : relevantFirst.length / withGap.length,
    questionAskedAtAllRate: withGap.length === 0 ? 0 : askedAtAll.length / withGap.length,
    underspecifiedCount: withGap.length,
    specifiedCount: specified.length,
    medianCriteriaPerHousehold: median(rows.map((r) => r.criteriaEvaluated)),
    medianWallClockMs: median(rows.map((r) => r.wallClockMs)),
    medianEngineMs: median(rows.map((r) => r.engineMs)),
    medianQuestionsAsked: median(rows.map((r) => r.questionsAsked.length)),
    medianPasses: median(rows.map((r) => r.passes)),
    totalAnnualValueSurfaced: Math.round(totalSurfaced),
    totalAnnualValueAvailable: Math.round(totalAvailable),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const tau = Number(args[args.indexOf('--tau') + 1]) || DEFAULT_TAU;
  const maxQuestions = Number(args[args.indexOf('--max-questions') + 1]) || DEFAULT_MAX_QUESTIONS;
  const sweep = args.includes('--sweep');

  const households = loadGold();
  const engine = engineFromEnv();

  console.log(`engine: ${engine.name}${engine.isFixture ? ' (local fixture, not a model)' : ''}`);
  console.log(`households: ${households.length}`);

  const rows = await runOnce(households, engine, tau, maxQuestions);
  const summary = summarise(rows);

  const tauSweep: { tau: number; questionRelevance: number; meanBalancedAccuracy: number; medianQuestions: number }[] = [];
  if (sweep) {
    console.log('\nsweeping tau...');
    for (const candidate of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
      const sweepRows = await runOnce(households, engine, candidate, maxQuestions);
      const s = summarise(sweepRows);
      const mean =
        Object.values(s.balancedAccuracyByProgram).reduce((a, b) => a + b, 0) / PROGRAMS.length;
      tauSweep.push({
        tau: candidate,
        questionRelevance: s.questionRelevance,
        meanBalancedAccuracy: mean,
        medianQuestions: s.medianQuestionsAsked,
      });
      console.log(
        `  tau=${candidate}  relevance=${(s.questionRelevance * 100).toFixed(1)}%  ` +
          `balanced accuracy=${(mean * 100).toFixed(1)}%  median questions=${s.medianQuestionsAsked}`
      );
    }
  }

  // A perfect score is not a good result, it is a broken test. The fixture reads the
  // same household facts the oracle answers from, so when every program scores 100%
  // the harness is measuring that two halves of the test agree with each other rather
  // than measuring anything about a decision model. Say so rather than publish it.
  const perfect = Object.values(summary.balancedAccuracyByProgram).filter((v) => v >= 0.999);
  const circular =
    engine.isFixture && perfect.length >= Object.keys(summary.balancedAccuracyByProgram).length - 1;

  const results = {
    runAt: new Date().toISOString(),
    circular,
    circularNote: circular
      ? 'Every program scored at or near 100% against the local fixture. The fixture and ' +
        'the answers it is scored against are both derived from the same stored household ' +
        'facts, so this measures the harness agreeing with itself, not accuracy. These ' +
        'figures must not be published until a real engine has been run.'
      : null,
    engine: engine.name,
    isFixture: engine.isFixture,
    tau,
    maxQuestions,
    n: households.length,
    ...summary,
    tauSweep,
    perHousehold: rows,
  };

  const path = join(process.cwd(), 'eval', 'results.json');
  writeFileSync(path, JSON.stringify(results, null, 2) + '\n');

  console.log('\nbalanced accuracy by program (120 fully specified households):');
  for (const program of PROGRAMS) {
    const d = summary.accuracyDetail[program];
    console.log(
      `  ${program.padEnd(10)} ${(d.balanced * 100).toFixed(1)}%   ` +
        `(plain ${(d.plain * 100).toFixed(1)}%, tp=${d.counts.tp} fp=${d.counts.fp} tn=${d.counts.tn} fn=${d.counts.fn})`
    );
  }
  console.log(`\nquestion relevance: ${(summary.questionRelevance * 100).toFixed(1)}% of ${summary.underspecifiedCount} underspecified households`);
  console.log(`  load-bearing fact asked at any point: ${(summary.questionAskedAtAllRate * 100).toFixed(1)}%`);
  console.log(`median criteria per household: ${summary.medianCriteriaPerHousehold}`);
  console.log(`median wall clock: ${summary.medianWallClockMs.toFixed(1)}ms  (engine ${summary.medianEngineMs.toFixed(1)}ms)`);
  console.log(`median questions asked: ${summary.medianQuestionsAsked}`);
  console.log(`annual value surfaced: $${summary.totalAnnualValueSurfaced.toLocaleString('en-US')} of $${summary.totalAnnualValueAvailable.toLocaleString('en-US')} available`);
  console.log(`\nwrote eval/results.json`);

  if (engine.isFixture) {
    console.log(
      '\nThese numbers come from the local fixture, not from a decision model. They ' +
        'show the harness works; they measure nothing about a model.'
    );
  }
  if (circular) {
    console.log(
      '\nWARNING: every program scored at or near 100%. The fixture answers from the same ' +
        'household facts the scoring uses, so this is the test agreeing with itself. Do not ' +
        'publish these figures.'
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
