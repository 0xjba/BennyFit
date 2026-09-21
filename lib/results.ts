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
