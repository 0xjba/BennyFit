import Link from 'next/link';

import { AccuracyStrip } from '@/app/components/AccuracyStrip';
import { Screener } from '@/app/components/Screener';
import { readResults } from '@/lib/results';

export const dynamic = 'force-dynamic';

export default function Home() {
  const results = readResults();
  const asOf = new Date().toISOString().slice(0, 10);

  return (
    <>
      <main>
        <h1>What are you entitled to?</h1>
        <p className="lede">
          Describe your household once, in your own words. Every eligibility criterion for
          SNAP, the Earned Income Tax Credit and Lifeline is read off that one description
          in a single pass. Where the description does not settle something that matters,
          you get one question rather than three forms.
        </p>

        <Screener asOf={asOf} />

        <p className="disclaimer" style={{ marginTop: 40 }}>
          Federal rules only. Most states are more generous than the federal floor for
          SNAP, so a household that does not qualify here may still qualify at home.{' '}
          <Link href="/method">How this works and how it is measured</Link>.
        </p>
      </main>
      <AccuracyStrip results={results} />
    </>
  );
}
