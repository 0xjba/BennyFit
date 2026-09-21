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
 *                              [--pilot N] [--out eval/other-results.json]
 *
 * ENGINE=baseline runs the general-purpose model through the same loop. --pilot N runs
 * N development households only, writes nothing unless --out is given, and never
 * touches the held-out half: it is for measuring cost before a full run.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { toDollars } from '@/lib/money';
import { engineFromEnv } from '@/lib/engine';
import { EngineClient } from '@/lib/engine/types';
import { DEFAULT_MAX_QUESTIONS, DEFAULT_TAU, screen } from '@/lib/loop';
import type { GoldHousehold } from '@/scripts/generate-gold';
import { oracleReply } from './oracle';
import { runConformance } from './conformance';
import { runExtraction } from './extraction';
import { HOLDOUT_CASES, HOLDOUT_WRITTEN } from './extraction-holdout';

const AS_OF = '2026-09-21';
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY) || 8;
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
  /** Total annual dollars after each pass: the first before any question, then one per answer. */
  passTotals: number[];
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
  const rows: PerHousehold[] = new Array(households.length);

  // A few households at a time. Each is screened independently, so running them
  // concurrently changes nothing but the wall clock; rows keep the input order.
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < households.length) {
      const index = nextIndex++;
      rows[index] = await screenOne(households[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, households.length) }, worker));
  return rows;

  async function screenOne(household: GoldHousehold): Promise<PerHousehold> {
    const result = await screen(household.paragraph, {
      engine,
      asOf: AS_OF,
      tau,
      maxQuestions,
      askUser: async (_question, criterion) => oracleReply(criterion.instanceId, household.facts),
    });

    return {
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
      passTotals: result.passes.map((p) => p.totalAnnualValueCents),
    };
  }
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

  // A question whose answer moved no money spent the household's time for nothing.
  // Counted without reference to any hand-labelled gap, so it cannot be gamed by
  // learning which question the test set happens to want.
  let questionsAnswered = 0;
  let questionsThatMoved = 0;
  for (const r of rows) {
    for (let i = 1; i < (r.passTotals?.length ?? 0); i++) {
      questionsAnswered++;
      if (r.passTotals[i] !== r.passTotals[i - 1]) questionsThatMoved++;
    }
  }

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
    questionsAnswered,
    usefulQuestionRate: questionsAnswered === 0 ? 0 : questionsThatMoved / questionsAnswered,
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
  const pilot = args.includes('--pilot') ? Number(args[args.indexOf('--pilot') + 1]) : 0;
  const outArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
  const sweepOnly = args.includes('--sweep-only');
  // --dev scores the development half instead of the held-out half: for changing the
  // system and seeing the effect without spending the held-out households.
  const devOnly = args.includes('--dev');

  const households = loadGold();
  const engine = engineFromEnv();

  // --- 1. Rules conformance: independent of the gold set and of any model ----
  const conformance = runConformance();
  const conformancePassed = conformance.filter((c) => c.passed).length;
  console.log(`\nrules conformance: ${conformancePassed} of ${conformance.length} hand-computed cases agree with the published sources`);
  for (const c of conformance.filter((x) => !x.passed)) {
    console.log(`  DISAGREES ${c.id}: got ${c.got}, source says ${c.expected}`);
  }

  // --- 2. Extraction: prose written independently of the parser --------------
  const dev = runExtraction();
  const held = runExtraction(HOLDOUT_CASES);
  console.log(
    `extraction, development set: ${dev.overall.correct}/${dev.overall.total} fields ` +
      `(${((100 * dev.overall.correct) / dev.overall.total).toFixed(1)}%)`
  );
  console.log(
    `extraction, held out:        ${held.overall.correct}/${held.overall.total} fields ` +
      `(${((100 * held.overall.correct) / held.overall.total).toFixed(1)}%)  <- the reported figure`
  );

  // --- 3. End-to-end: needs a real engine, and is scored on the held-out half --
  const holdout = households.filter((h) => h.split === 'holdout');

  console.log(`engine: ${engine.name}${engine.isFixture ? ' (local fixture, not a model)' : ''}`);
  console.log(`households: ${households.length}`);

  // With the local fixture this still runs, to prove the loop works end to end, but its
  // accuracy is not reported: the fixture answers from the same facts the scoring uses.
  // A pilot takes one household from each slice of the development half in turn, so a
  // handful still covers every kind of household.
  const development = households.filter((h) => h.split === 'dev');
  const pilotSet = (() => {
    const bySlice = new Map<string, GoldHousehold[]>();
    for (const h of development) bySlice.set(h.slice, [...(bySlice.get(h.slice) ?? []), h]);
    const out: GoldHousehold[] = [];
    for (let i = 0; out.length < pilot; i++) {
      let added = false;
      for (const group of bySlice.values()) {
        if (group[i] && out.length < pilot) { out.push(group[i]); added = true; }
      }
      if (!added) break;
    }
    return out;
  })();

  const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  const metered: EngineClient = {
    name: engine.name,
    isFixture: engine.isFixture,
    async ask(request) {
      const response = await engine.ask(request);
      usage.calls++;
      usage.inputTokens += response.usage.inputTokens;
      usage.outputTokens += response.usage.outputTokens;
      return response;
    },
  };

  // --sweep-only chooses the threshold on the development half and stops, so the
  // held-out half is scored exactly once, afterwards, at the threshold chosen here.
  // The rule is fixed in advance: highest mean balanced accuracy, and on a tie the
  // threshold that asks fewer questions.
  if (sweepOnly) {
    console.log(`\nsweeping tau on the ${development.length} development households...`);
    const sweepResults: { tau: number; meanBalancedAccuracy: number; questionRelevance: number; medianQuestions: number }[] = [];
    for (const candidate of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
      const s = summarise(await runOnce(development, metered, candidate, maxQuestions));
      const mean = Object.values(s.balancedAccuracyByProgram).reduce((a, b) => a + b, 0) / PROGRAMS.length;
      sweepResults.push({ tau: candidate, meanBalancedAccuracy: mean, questionRelevance: s.questionRelevance, medianQuestions: s.medianQuestionsAsked });
      console.log(`  tau=${candidate}  balanced accuracy=${(mean * 100).toFixed(2)}%  relevance=${(s.questionRelevance * 100).toFixed(1)}%  median questions=${s.medianQuestionsAsked}`);
    }
    const best = [...sweepResults].sort(
      (a, b) => b.meanBalancedAccuracy - a.meanBalancedAccuracy || a.medianQuestions - b.medianQuestions || a.tau - b.tau
    )[0];
    const sweepPath = join(process.cwd(), outArg ?? 'eval/tau-sweep.json');
    writeFileSync(
      sweepPath,
      JSON.stringify({ runAt: new Date().toISOString(), engine: engine.name, households: development.length, chosen: best.tau, rule: 'highest mean balanced accuracy; ties to fewer questions, then lower tau', sweep: sweepResults, usage }, null, 2) + '\n'
    );
    console.log(`\nchosen tau: ${best.tau}\nusage: ${usage.calls} calls, ${usage.inputTokens.toLocaleString()} input tokens\nwrote ${sweepPath.replace(process.cwd() + '/', '')}`);
    return;
  }

  const scoredSet = pilot > 0 ? pilotSet : devOnly ? development : engine.isFixture ? households : holdout;
  const rows = await runOnce(scoredSet, metered, tau, maxQuestions);
  const summary = summarise(rows);

  const tauSweep: { tau: number; questionRelevance: number; meanBalancedAccuracy: number; medianQuestions: number }[] = [];
  // A threshold chosen by an earlier --sweep-only run on this engine travels with the
  // held-out result, so the page can show how it was chosen.
  const sweepFile = join(process.cwd(), 'eval', 'tau-sweep.json');
  if (!sweep && existsSync(sweepFile)) {
    const saved = JSON.parse(readFileSync(sweepFile, 'utf8'));
    if (saved.engine === engine.name && saved.chosen === tau) tauSweep.push(...saved.sweep);
  }
  if (sweep && pilot === 0) {
    // Tuned on the development half only. Sweeping over the held-out half would pick
    // the threshold that scores best on the very households it is then scored on.
    console.log('\nsweeping tau on the development half...');
    for (const candidate of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
      const sweepRows = await runOnce(development, metered, candidate, maxQuestions);
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

  const pct = (a: number, b: number) => (b === 0 ? 0 : a / b);
  const results = {
    runAt: new Date().toISOString(),
    conformance: {
      passed: conformancePassed,
      total: conformance.length,
      rate: pct(conformancePassed, conformance.length),
      cases: conformance,
    },
    extraction: {
      development: { ...dev.overall, rate: pct(dev.overall.correct, dev.overall.total), byField: dev.byField },
      holdout: {
        ...held.overall,
        rate: pct(held.overall.correct, held.overall.total),
        byField: held.byField,
        written: HOLDOUT_WRITTEN,
        misses: held.results.flatMap((r) =>
          r.fields.filter((f) => !f.correct).map((f) => ({ id: r.id, ...f }))
        ),
      },
    },
    endToEnd: {
      measured: !engine.isFixture && pilot === 0 && !devOnly,
      scoredOn: engine.isFixture
        ? 'not scored'
        : pilot > 0
          ? `pilot of ${pilot} development households`
          : devOnly
            ? 'development half'
            : 'held-out half',
      households: engine.isFixture ? 0 : scoredSet.length,
    },
    usage,
    generationFaults: 'faultTotals' in engine ? (engine as { faultTotals: unknown }).faultTotals : null,
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

  // A pilot is a cost check, not a result: it writes only where it is told to.
  const path = outArg ? resolve(process.cwd(), outArg) : pilot > 0 || devOnly ? null : join(process.cwd(), 'eval', 'results.json');
  if (path) writeFileSync(path, JSON.stringify(results, null, 2) + '\n');
  console.log(
    `\nusage: ${usage.calls} calls, ${usage.inputTokens.toLocaleString()} input tokens, ` +
      `${usage.outputTokens.toLocaleString()} output tokens over ${scoredSet.length} households` +
      (results.generationFaults ? `\ngeneration faults: ${JSON.stringify(results.generationFaults)}` : '')
  );

  console.log(`\nbalanced accuracy by program (${summary.specifiedCount} fully specified households):`);
  for (const program of PROGRAMS) {
    const d = summary.accuracyDetail[program];
    console.log(
      `  ${program.padEnd(10)} ${(d.balanced * 100).toFixed(1)}%   ` +
        `(plain ${(d.plain * 100).toFixed(1)}%, tp=${d.counts.tp} fp=${d.counts.fp} tn=${d.counts.tn} fn=${d.counts.fn})`
    );
  }
  console.log(`\nquestion relevance: ${(summary.questionRelevance * 100).toFixed(1)}% of ${summary.underspecifiedCount} underspecified households`);
  console.log(`  load-bearing fact asked at any point: ${(summary.questionAskedAtAllRate * 100).toFixed(1)}%`);
  console.log(
    `  underspecified households, balanced accuracy after follow-ups: ${((summary.accuracyBySlice.underspecified ?? 0) * 100).toFixed(1)}%`
  );
  console.log(
    `  questions that changed the result: ${(summary.usefulQuestionRate * 100).toFixed(1)}% of ${summary.questionsAnswered}`
  );
  console.log(`median criteria per household: ${summary.medianCriteriaPerHousehold}`);
  console.log(`median wall clock: ${summary.medianWallClockMs.toFixed(1)}ms  (engine ${summary.medianEngineMs.toFixed(1)}ms)`);
  console.log(`median questions asked: ${summary.medianQuestionsAsked}`);
  console.log(`annual value surfaced: $${summary.totalAnnualValueSurfaced.toLocaleString('en-US')} of $${summary.totalAnnualValueAvailable.toLocaleString('en-US')} available`);
  console.log(path ? `\nwrote ${path.replace(process.cwd() + "/", "")}` : "\npilot: nothing written");

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
