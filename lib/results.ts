/**
 * Reading the last evaluation run, for the accuracy strip.
 *
 * The strip reads from a committed results file rather than measuring anything live.
 * An accuracy figure is a property of a run over the gold set, not of the screening in
 * front of you, and computing one on demand would be both slow and meaningless.
 *
 * When no run exists, or the file has no runAt, the strip says "not yet evaluated".
 * It never shows a blank or a zero, because a zero reads as a measurement.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ResultsSummary {
  runAt: string | null;
  /** Hand-computed cases from primary sources, run against the arithmetic. */
  conformance: { passed: number; total: number; rate: number } | null;
  /** How well facts are read from prose written independently of the parser. */
  extraction: {
    development: { correct: number; total: number; rate: number };
    holdout: {
      correct: number;
      total: number;
      rate: number;
      written: string;
      byField: Record<string, { correct: number; total: number }>;
      misses: { id: string; field: string; expected: unknown; got: unknown }[];
    };
  } | null;
  /** Whether a real engine produced the end-to-end figures. */
  endToEndMeasured: boolean;
  /** True when the run scored so well it is measuring itself rather than a model. */
  circular: boolean;
  circularNote: string | null;
  engine: string;
  isFixture: boolean;
  tau: number;
  maxQuestions: number;
  n: number;
  specifiedCount: number;
  underspecifiedCount: number;
  balancedAccuracyByProgram: Record<string, number>;
  questionRelevance: number;
  questionAskedAtAllRate: number;
  medianCriteriaPerHousehold: number;
  medianWallClockMs: number;
  medianQuestionsAsked: number;
  totalAnnualValueSurfaced: number;
  tauSweep: { tau: number; questionRelevance: number; meanBalancedAccuracy: number }[];
}

export function readResults(): ResultsSummary | null {
  try {
    const raw = readFileSync(join(process.cwd(), 'eval', 'results.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.runAt !== 'string') return null;

    return {
      runAt: parsed.runAt,
      conformance: parsed.conformance
        ? { passed: parsed.conformance.passed, total: parsed.conformance.total, rate: parsed.conformance.rate }
        : null,
      extraction: parsed.extraction ?? null,
      endToEndMeasured: Boolean(parsed.endToEnd?.measured),
      circular: Boolean(parsed.circular),
      circularNote: parsed.circularNote ?? null,
      engine: parsed.engine ?? 'unknown',
      isFixture: Boolean(parsed.isFixture),
      tau: parsed.tau,
      maxQuestions: parsed.maxQuestions,
      n: parsed.n,
      specifiedCount: parsed.specifiedCount ?? 0,
      underspecifiedCount: parsed.underspecifiedCount ?? 0,
      balancedAccuracyByProgram: parsed.balancedAccuracyByProgram ?? {},
      questionRelevance: parsed.questionRelevance ?? 0,
      questionAskedAtAllRate: parsed.questionAskedAtAllRate ?? 0,
      medianCriteriaPerHousehold: parsed.medianCriteriaPerHousehold ?? 0,
      medianWallClockMs: parsed.medianWallClockMs ?? 0,
      medianQuestionsAsked: parsed.medianQuestionsAsked ?? 0,
      totalAnnualValueSurfaced: parsed.totalAnnualValueSurfaced ?? 0,
      tauSweep: parsed.tauSweep ?? [],
    };
  } catch {
    return null;
  }
}

/** What a run cost and how long it took, for one engine on the held-out households. */
export interface RunSummary {
  engine: string;
  households: number;
  specifiedCount: number;
  balancedAccuracyByProgram: Record<string, number>;
  meanBalancedAccuracy: number;
  medianWallClockMs: number;
  medianQuestionsAsked: number;
  usage: { calls: number; inputTokens: number; outputTokens: number };
  generationFaults: Record<string, number> | null;
  tau: number;
  /** What the run was actually charged, in dollars, and how that was established. */
  billedUSD: number | null;
  billedNote: string | null;
  /** Of households missing a deciding fact: asked for it first, and asked for it at all. */
  questionRelevance: number;
  questionAskedAtAllRate: number;
}

function summaryOf(parsed: Record<string, unknown>): RunSummary {
  const byProgram = (parsed.balancedAccuracyByProgram ?? {}) as Record<string, number>;
  const values = Object.values(byProgram);
  const endToEnd = (parsed.endToEnd ?? {}) as { households?: number };
  return {
    engine: String(parsed.engine ?? 'unknown'),
    households: endToEnd.households ?? 0,
    specifiedCount: Number(parsed.specifiedCount ?? 0),
    balancedAccuracyByProgram: byProgram,
    meanBalancedAccuracy: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    medianWallClockMs: Number(parsed.medianWallClockMs ?? 0),
    medianQuestionsAsked: Number(parsed.medianQuestionsAsked ?? 0),
    usage: (parsed.usage as RunSummary['usage']) ?? { calls: 0, inputTokens: 0, outputTokens: 0 },
    generationFaults: (parsed.generationFaults as Record<string, number> | null) ?? null,
    tau: Number(parsed.tau ?? 0),
    billedUSD: typeof parsed.billedUSD === 'number' ? parsed.billedUSD : null,
    billedNote: typeof parsed.billedNote === 'string' ? parsed.billedNote : null,
    questionRelevance: Number(parsed.questionRelevance ?? 0),
    questionAskedAtAllRate: Number(parsed.questionAskedAtAllRate ?? 0),
  };
}

/** The typed engine's held-out run, when a real engine produced it. */
export function readEngineRun(): RunSummary | null {
  try {
    const parsed = JSON.parse(readFileSync(join(process.cwd(), 'eval', 'results.json'), 'utf8'));
    if (parsed?.isFixture || !parsed?.endToEnd?.measured) return null;
    return summaryOf(parsed);
  } catch {
    return null;
  }
}

/**
 * The typed engine's run that the general-purpose model was compared against: same
 * households, same rules, same version of the system. Kept apart from the latest run
 * so the comparison stays like for like after the system moves on.
 */
export function readComparedEngineRun(): RunSummary | null {
  try {
    const parsed = JSON.parse(
      readFileSync(join(process.cwd(), 'eval', 'runs', '2026-09-21-jev-holdout-compared.json'), 'utf8')
    );
    return summaryOf(parsed);
  } catch {
    return null;
  }
}

/** The general-purpose model's run over the same held-out households, if one exists. */
export function readBaselineRun(): RunSummary | null {
  try {
    const parsed = JSON.parse(readFileSync(join(process.cwd(), 'eval', 'baseline-results.json'), 'utf8'));
    if (!parsed?.endToEnd?.measured) return null;
    return summaryOf(parsed);
  } catch {
    return null;
  }
}

/** The one scoring of the current held-out reading set by both readers. */
export interface ReadingHoldout {
  edition: number;
  written: string;
  codeParser: { correct: number; total: number; rate: number; byField: Record<string, { correct: number; total: number }> };
  withEngine: {
    correct: number;
    total: number;
    rate: number;
    byField: Record<string, { correct: number; total: number }>;
    misses: { id: string; field: string; expected: unknown; got: unknown }[];
  };
}

export function readReadingHoldout(): ReadingHoldout | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'eval', 'reading-holdout.json'), 'utf8')) as ReadingHoldout;
  } catch {
    return null;
  }
}
