/**
 * Balanced accuracy per program, from per-household verdicts.
 *
 * Balanced accuracy is the mean of the true-positive and true-negative rates. When a
 * program has no eligible households, or no ineligible ones, one of those rates is
 * undefined and so is the balanced accuracy: it is reported as null (not estimable),
 * never as 100%, and left out of any mean. Reporting a perfect score for a program the
 * set never tested would inflate every average it enters.
 */

export interface VerdictRow {
  slice: string;
  predicted: Record<string, boolean>;
  truth: Record<string, boolean>;
}

export function balancedByProgram(rows: VerdictRow[], programs: string[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const p of programs) {
    let tp = 0, fn = 0, tn = 0, fp = 0;
    for (const r of rows) {
      if (r.truth[p]) {
        if (r.predicted[p]) tp++;
        else fn++;
      } else if (r.predicted[p]) fp++;
      else tn++;
    }
    out[p] = tp + fn === 0 || tn + fp === 0 ? null : (tp / (tp + fn) + tn / (tn + fp)) / 2;
  }
  return out;
}

/** The mean over the programs where balanced accuracy is defined. */
export function meanEstimable(byProgram: Record<string, number | null>): { mean: number; programs: number } {
  const values = Object.values(byProgram).filter((v): v is number => v !== null);
  return { mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0, programs: values.length };
}
