import Link from 'next/link';

import { Screener } from '@/app/components/Screener';
import { Masthead } from '@/app/components/SiteChrome';
import { TrustBar } from '@/app/components/TrustBar';
import { readResults } from '@/lib/results';
import { screeningDate } from '@/lib/today';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Demo — BennyFit',
  description:
    'Describe a household in plain language and watch every rule across eleven federal benefit programs get checked at once.',
};

export default function Demo() {
  const results = readResults();
  const asOf = screeningDate();

  return (
    <>
      <Masthead cta={false} />
      <main className="app">
        <h1>What is this household entitled to?</h1>
        <p className="lede">
          Describe the situation once, in plain words. Benny checks every rule across all eleven
          federal programs together, and asks a follow-up only if
          something missing would change the answer.
        </p>

        <Screener asOf={asOf} />

        <p className="disclaimer" style={{ marginTop: 44 }}>
          Federal rules only. Most states are more generous than the federal minimum for
          SNAP, so a household that does not qualify here may still qualify at home.{' '}
          <Link href="/compare">See it beside the current process</Link> ·{' '}
          <Link href="/results">How accuracy is measured</Link>
        </p>
      </main>
      <TrustBar results={results} />
    </>
  );
}
