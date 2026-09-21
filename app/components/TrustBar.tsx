import Link from 'next/link';

import { ResultsSummary } from '@/lib/results';

const LABELS: Record<string, string> = {
  snap: 'SNAP',
  eitc: 'EITC',
  lifeline: 'Lifeline',
};

/**
 * The strip along the bottom of the product.
 *
 * Present in every state, including before anything has been typed. What a household
 * could gain is a claim; how often the screening is right is what makes the claim worth
 * anything, so the second figure is never a click away from the first.
 */
export function TrustBar({ results }: { results: ResultsSummary | null }) {
  if (results?.circular) {
    return (
      <footer className="trustbar">
        <div className="trustbar-inner">
          <span className="preview-flag">PREVIEW</span>
          <span>
            Accuracy not yet measurable — the preview build scores itself. Real figures
            follow the first run against the live service.
          </span>
          <Link href="/results">Why</Link>
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
          Agreement with the federal rules{' '}
          {Object.entries(results.balancedAccuracyByProgram).map(([program, value], i) => (
            <span key={program}>
              {i > 0 && ' · '}
              {LABELS[program] ?? program} <strong>{(value * 100).toFixed(1)}%</strong>
            </span>
          ))}
        </span>
        <span>
          across <strong>{results.specifiedCount}</strong> validation households
        </span>
        <span>
          right question first <strong>{(results.questionRelevance * 100).toFixed(0)}%</strong> of
          the time
        </span>
        <Link href="/results">How this is measured</Link>
      </div>
    </footer>
  );
}
