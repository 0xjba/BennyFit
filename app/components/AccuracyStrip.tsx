import Link from 'next/link';

import { ResultsSummary } from '@/lib/results';

/**
 * The persistent footer strip.
 *
 * Present in every state, including before anything has been typed. What a household
 * gained is a claim; how often the system is right is what makes the claim worth
 * anything, so the second figure is never a click away from the first.
 */
export function AccuracyStrip({
  results,
  repoLink = true,
}: {
  results: ResultsSummary | null;
  repoLink?: boolean;
}) {
  if (!results) {
    return (
      <footer className="accuracy">
        <div className="accuracy-inner">
          <span>Accuracy: not yet evaluated</span>
          <span>
            Run <code>npx tsx eval/run.ts</code> over the 150-household gold set to produce it.
          </span>
        </div>
      </footer>
    );
  }

  const programs = Object.entries(results.balancedAccuracyByProgram);

  return (
    <footer className="accuracy">
      <div className="accuracy-inner">
        {results.isFixture && <span className="fixture-flag">FIXTURE</span>}
        <span>
          Balanced accuracy{' '}
          {programs.map(([program, value], i) => (
            <span key={program}>
              {i > 0 && ' · '}
              {program} <strong>{(value * 100).toFixed(1)}%</strong>
            </span>
          ))}
        </span>
        <span>
          on <strong>{results.specifiedCount}</strong> fully specified households
        </span>
        <span>
          right question <strong>{(results.questionRelevance * 100).toFixed(0)}%</strong> of{' '}
          {results.underspecifiedCount}
        </span>
        <span>
          engine <strong>{results.engine}</strong>
        </span>
        <span>
          τ <strong>{results.tau}</strong>
        </span>
        {repoLink && <Link href="/method">How this is measured</Link>}
      </div>
    </footer>
  );
}
