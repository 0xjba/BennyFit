import Link from 'next/link';

import { Masthead, SiteFooter } from '@/app/components/SiteChrome';
import { readResults } from '@/lib/results';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Results — BennyFit',
  description:
    'How BennyFit measures whether its screening results are right, and what the current figures do and do not show.',
};

const LABELS: Record<string, string> = {
  snap: 'SNAP food assistance',
  eitc: 'Earned Income Tax Credit',
  lifeline: 'Lifeline phone and internet',
};

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function Results() {
  const results = readResults();

  return (
    <>
      <Masthead />

      <section className="band" style={{ paddingBottom: 40 }}>
        <div className="shell-narrow">
          <span className="eyebrow">Results</span>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)' }}>
            How we know the answers are right.
          </h1>
          <p className="lede" style={{ fontSize: '1.08rem', marginTop: 18 }}>
            A screening tool that is confidently wrong is worse than no screening tool at
            all. Someone spends a day applying for something they were never going to get,
            or is told they do not qualify for something they do. So the accuracy figure
            sits on every screen, and this page explains exactly what produced it.
          </p>
        </div>
      </section>

      {results?.isFixture && (
        <section className="shell-narrow" style={{ marginBottom: 20 }}>
          <div className="notice">
            <strong>These figures are from a preview build.</strong> They were produced by
            a local test harness rather than the live service, and that harness was tuned
            while looking at the cases it got wrong — which flatters it. They show the
            measurement process works. They are not yet a measurement of the product, and
            they will be replaced by figures from a production run.
          </div>
        </section>
      )}

      <section className="band tint" style={{ paddingTop: 48 }}>
        <div className="shell-narrow">
          <h2>The validation set</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 14 }}>
            150 households, all synthetic, written as a person would actually describe
            themselves. The correct answer for each one is worked out from the federal
            rules applied to its known facts — independently of the system being tested, so
            the system is checked against the law rather than against itself. The set is
            split five ways: qualifying broadly, qualifying for nothing, qualifying for some, deliberately missing one fact that decides the
            outcome, and awkwardly phrased.
          </p>

          {results && (
            <ul className="steps" style={{ marginTop: 26 }}>
              {Object.entries(results.balancedAccuracyByProgram).map(([program, value]) => (
                <li key={program}>
                  <span>
                    {LABELS[program] ?? program}
                    <br />
                    <span className="cite">
                      across {results.specifiedCount} fully specified households
                    </span>
                  </span>
                  <span className="amt">{percent(value)}</span>
                </li>
              ))}
              <li>
                <span>
                  Asked the right question first
                  <br />
                  <span className="cite">
                    on the {results.underspecifiedCount} households that deliberately left
                    out a fact that decides the outcome
                  </span>
                </span>
                <span className="amt">{percent(results.questionRelevance)}</span>
              </li>
              <li>
                <span>
                  Checks run per household
                  <br />
                  <span className="cite">all at once, in a single round</span>
                </span>
                <span className="amt">{results.medianCriteriaPerHousehold}</span>
              </li>
              <li>
                <span>
                  Questions asked
                  <br />
                  <span className="cite">median, capped at {results.maxQuestions}</span>
                </span>
                <span className="amt">{results.medianQuestionsAsked}</span>
              </li>
            </ul>
          )}

          {!results && (
            <p style={{ color: 'var(--text-muted)', marginTop: 20 }}>
              No validation run has been recorded yet.
            </p>
          )}
        </div>
      </section>

      <section className="band">
        <div className="shell-narrow">
          <h2>Why the figure is not simply &ldquo;percent correct&rdquo;</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 14 }}>
            Four out of five households in the set qualify for SNAP. A system that
            answered &ldquo;eligible&rdquo; to every household would therefore be 80% correct while
            being completely useless. The figure reported here is balanced accuracy: it
            weighs getting the ineligible households right equally with getting the
            eligible ones right, and that same do-nothing system would score 50%.
          </p>

          <h2 style={{ marginTop: 40 }}>Two kinds of wrong, and which one we fear</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 14 }}>
            Telling someone they are likely eligible when they are not costs them a wasted
            application and their trust. Telling someone they are not eligible when they
            are is the exact failure this product exists to fix, and it is silent — nobody
            ever finds out. Both are tracked separately rather than averaged away, and
            every household is shown every program, including the ones judged unlikely, so a person who knows their own situation can disagree with us.
          </p>

          <h2 style={{ marginTop: 40 }}>What these numbers do not cover</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 14 }}>
            The validation households are synthetic. Writing them from known facts is what
            makes their correct answers checkable, and it also makes them tidier than the
            way people really write. A strong score here is evidence that the rules are
            implemented correctly and that the follow-up questions are well chosen. It is
            not evidence about real applicants, and we will not present it as such.
          </p>
          <p style={{ color: 'var(--text-muted)', marginTop: 14 }}>
            The screening also uses federal minimum rules. Most states raise the SNAP
            income limit and many drop the savings test entirely, so a household told it is
            unlikely to qualify may well qualify where it lives. Every result says so.
          </p>

          <h2 style={{ marginTop: 40 }}>Where the rules come from</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 14 }}>
            Every dollar figure in the system records the official page it was read from
            and the date it was read, and copies of those documents are kept alongside the
            rules so any number can be traced back. When a new table has not been published
            yet — as with the SNAP figures that take effect each October — the system says
            so on screen rather than quietly carrying on with a stale number or inventing
            one.
          </p>

          <div className="hero-cta" style={{ marginTop: 32 }}>
            <Link href="/demo" className="btn">
              Try the demo
            </Link>
            <Link href="/compare" className="btn ghost">
              See it beside the current process
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
