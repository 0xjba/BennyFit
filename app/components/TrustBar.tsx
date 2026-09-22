import Link from 'next/link';

import { ResultsSummary } from '@/lib/results';
import { meanEstimable } from '@/lib/balanced';

/**
 * The strip along the bottom of the product.
 *
 * Present in every state, including before anything has been typed. What a household
 * could gain is a claim; how often the screening is right is what makes the claim worth
 * anything, so the second figure is never a click away from the first.
 */
export function TrustBar({ results }: { results: ResultsSummary | null }) {
  // Two things can be measured honestly without the live service, and are shown.
  // Screening accuracy end to end cannot, and says so rather than borrowing a figure
  // from a run that scored itself.
  if (results && !results.endToEndMeasured) {
    const c = results.conformance;
    const x = results.extraction?.holdout;
    return (
      <footer className="trustbar">
        <div className="trustbar-inner">
          {c && (
            <span>
              Rules match the federal sources{' '}
              <strong>
                {c.passed} of {c.total}
              </strong>
            </span>
          )}
          {x && (
            <span>
              Reads real-world descriptions <strong>{(x.rate * 100).toFixed(1)}%</strong>
            </span>
          )}
          <span>Screening accuracy: pending the live service</span>
          <Link href="/results">How this is measured</Link>
        </div>
      </footer>
    );
  }

  if (!results) {
    return (
      <footer className="trustbar">
        <div className="trustbar-inner">
          <span>Accuracy: not yet measured</span>
          <Link href="/results">How accuracy is measured</Link>
        </div>
      </footer>
    );
  }

  return (
    <footer className="trustbar">
      <div className="trustbar-inner">
        {results.isFixture && <span className="preview-flag">PREVIEW</span>}
        <span>
          Mean balanced accuracy on held-out households{' '}
          <strong>{(100 * meanEstimable(results.balancedAccuracyByProgram).mean).toFixed(1)}%</strong>{' '}
          across the {meanEstimable(results.balancedAccuracyByProgram).programs} programs the set can test
        </span>
        {results.conformance && (
          <span>
            Rules match the sources{' '}
            <strong>
              {results.conformance.passed} of {results.conformance.total}
            </strong>
          </span>
        )}
        <Link href="/results">How this is measured</Link>
      </div>
    </footer>
  );
}
