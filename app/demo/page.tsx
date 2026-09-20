import Link from 'next/link';

import { AccuracyStrip } from '@/app/components/AccuracyStrip';
import { ConventionalForm } from '@/app/components/ConventionalForm';
import { DemoLanes } from '@/app/components/DemoLanes';
import { conventionalForms, conventionalQuestionCount } from '@/lib/conventional';
import { readResults } from '@/lib/results';

export const dynamic = 'force-dynamic';

export default function Demo() {
  const results = readResults();
  const forms = conventionalForms();
  const questionCount = conventionalQuestionCount();

  return (
    <>
      <main className="wide">
        <h1>The same household, two ways</h1>
        <p className="lede">
          Left: the path as it exists, one application per programme. Right: one paragraph,
          every criterion for all three programmes resolved in a single pass, and one
          question where the description leaves something open. Both sides ask about the
          same facts, because the questions on the left are generated from the same
          criteria files the engine reads.
        </p>

        <div className="split">
          <section className="side">
            <div className="side-head">
              <h2>The conventional path</h2>
              <p className="lane-sub">
                {forms.length} applications · {questionCount} questions
              </p>
            </div>
            <ConventionalForm forms={forms} />
          </section>

          <section className="side">
            <div className="side-head">
              <h2>One paragraph</h2>
              <p className="lane-sub">
                Three lanes on the identical input: a typed readout, and the same job done
                by generating JSON.
              </p>
            </div>
            <DemoLanes />
          </section>
        </div>

        <p className="disclaimer" style={{ marginTop: 36 }}>
          Screening estimates from federal rules, not eligibility determinations. Nothing
          typed here is stored. <Link href="/">Use the screener</Link> ·{' '}
          <Link href="/method">How this is measured</Link>
        </p>
      </main>
      <AccuracyStrip results={results} />
    </>
  );
}
