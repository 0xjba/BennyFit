import Link from 'next/link';

import { Screener } from '@/app/components/Screener';
import { Masthead } from '@/app/components/SiteChrome';
import { TrustBar } from '@/app/components/TrustBar';
import { readResults } from '@/lib/results';
import { screeningDate } from '@/lib/today';
import { loadPrograms } from '@/lib/criteria';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Demo | BennyFit',
  description:
    'Describe a household in plain language and watch every rule across twenty-one benefit programs get checked at once, under your state\u2019s own limits.',
};

export default function Demo() {
  const results = readResults();
  const asOf = screeningDate();
  const programCount = loadPrograms().length;

  return (
    <>
      <Masthead cta={false} />
      <main className="app">
        <h1>What is this household entitled to?</h1>
        <p className="lede">
          Describe the situation once, in plain words. Benny checks every rule across all{' '}
          {programCount} programs together, using your state&rsquo;s own limits, and asks a
          follow-up only if something missing would change the answer.
        </p>

        <Screener asOf={asOf} programCount={programCount} />

        <p className="disclaimer" style={{ marginTop: 44 }}>
          SNAP, Medicaid and state tax credits follow the state you name. The other
          programs use federal limits, which some states and local agencies raise, so a
          household that does not qualify for one of those here may still qualify at
          home.{' '}
          <Link href="/compare">See it beside the current process</Link> ·{' '}
          <Link href="/results">How accuracy is measured</Link>
        </p>
      </main>
      <TrustBar results={results} />
    </>
  );
}
