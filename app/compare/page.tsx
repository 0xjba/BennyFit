import Link from 'next/link';

import { ConventionalForm } from '@/app/components/ConventionalForm';
import { DemoLanes } from '@/app/components/DemoLanes';
import { Masthead, SiteFooter } from '@/app/components/SiteChrome';
import { conventionalForms, conventionalQuestionCount } from '@/lib/conventional';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Compare — BennyFit',
  description:
    'The same household, screened the way it is done today and the way BennyFit does it.',
};

export default function Compare() {
  const forms = conventionalForms();
  const questionCount = conventionalQuestionCount();

  return (
    <>
      <Masthead />
      <main className="shell" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 1140 }}>
        <h1>The same household, two ways</h1>
        <p className="lede" style={{ maxWidth: '62ch' }}>
          On the left, the process as it exists: one application per program, each asking for most of the same facts again. On the right, one description and every rule
          checked together. Both sides ask about exactly the same facts — the questions on
          the left are generated from the same rule library, so the repetition is real
          rather than staged.
        </p>

        <div className="split" style={{ marginTop: 34 }}>
          <section className="side">
            <div className="side-head">
              <h2>The way it works today</h2>
              <p className="lane-sub">
                {forms.length} applications · {questionCount} questions
              </p>
            </div>
            <ConventionalForm forms={forms} />
          </section>

          <section className="side">
            <div className="side-head">
              <h2>The way BennyFit works</h2>
              <p className="lane-sub">
                One description, every rule checked together, and a question only where it
                changes the answer.
              </p>
            </div>
            <DemoLanes />
          </section>
        </div>

        <p className="disclaimer" style={{ marginTop: 36 }}>
          Screening estimates from federal rules, not eligibility determinations. Nothing
          typed here is stored. <Link href="/demo">Use the full demo</Link> ·{' '}
          <Link href="/results">How accuracy is measured</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
