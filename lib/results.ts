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
  engine: string;
  isFixture: boolean;
  tau: number;
  maxQuestions: number;
  n: number;
  specifiedCount: number;
  underspecifiedCount: number;
  balancedAccuracyByProgram: Record<string, number>;
  questionRelevance: number;
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
      engine: parsed.engine ?? 'unknown',
      isFixture: Boolean(parsed.isFixture),
      tau: parsed.tau,
      maxQuestions: parsed.maxQuestions,
      n: parsed.n,
      specifiedCount: parsed.specifiedCount ?? 0,
      underspecifiedCount: parsed.underspecifiedCount ?? 0,
      balancedAccuracyByProgram: parsed.balancedAccuracyByProgram ?? {},
      questionRelevance: parsed.questionRelevance ?? 0,
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
