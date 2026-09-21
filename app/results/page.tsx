import Link from 'next/link';

import { Masthead, SiteFooter } from '@/app/components/SiteChrome';
import { readBaselineRun, readComparedEngineRun, readEngineRun, readReadingHoldout, readResults } from '@/lib/results';
import { runConformance } from '@/eval/conformance';
import { HOLDOUT_EDITION } from '@/eval/extraction-holdout';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Results — BennyFit',
  description:
    'How BennyFit measures whether its screening results are right, and what the current figures do and do not show.',
};

const LABELS: Record<string, string> = {
  snap: 'SNAP food assistance',
  eitc: 'Earned Income Tax Credit',
  ctc: 'Child Tax Credit',
  lifeline: 'Lifeline phone and internet',
  wic: 'WIC',
  school_meals: 'Free and reduced price school meals',
  csfp: 'CSFP food box for older adults',
  liheap: 'LIHEAP energy assistance',
  head_start: 'Head Start',
  medicare_savings: 'Medicare Savings Programs',
  extra_help: 'Extra Help with drug costs',
  medicaid: 'Medicaid',
  chip: 'CHIP',
  state_eitc: 'State earned income credit',
  cdctc: 'Child and Dependent Care Credit',
  va_pension: 'Veterans Pension',
  summer_ebt: 'Summer EBT',
  sfmnp: "Senior Farmers' Market",
  cacfp: 'CACFP',
  fdpir: 'FDPIR',
  wap: 'Weatherization',
};

const ORDINALS: Record<number, string> = {
  1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth',
};

/** "anthropic/claude-sonnet-5 (generating JSON)" -> "Claude Sonnet 5". */
function modelName(engine: string): string {
  const id = engine.replace(/\s*\(.*\)$/, '').split('/').pop() ?? engine;
  return id
    .split('-')
    .map((w) => (/^\d/.test(w) ? w.replace(/(\d)-(\d)/, '$1.$2') : w[0].toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/(\d) (\d)/g, '$1.$2');
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const FIELD_LABELS: Record<string, string> = {
  householdSize: 'Household size',
  incomeAmount: 'Income amount',
  incomePeriod: 'Income period (weekly, monthly…)',
  rentMonthly: 'Housing cost',
  state: 'State',
  childrenCount: 'Number of children',
  incomeMonthly: 'Income as a monthly figure',
};

export default function Results() {
  const results = readResults();
  const engineRun = readEngineRun();
  const baselineRun = readBaselineRun();
  // The comparison uses the engine run made on the same version of the system as the
  // baseline, not whatever ran last.
  const comparedRun = readComparedEngineRun();
  const reading = readReadingHoldout();
  const conformance = results?.conformance ?? null;
  const extraction = results?.extraction ?? null;
  // The case list is run live, so it always reflects the rules as they stand.
  const liveCases = runConformance();
  const holdoutCount = readFileSync(join(process.cwd(), 'data', 'gold', 'households.jsonl'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('"split":"holdout"')).length;

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

      <section className="band" style={{ paddingTop: 20 }}>
        <div className="shell-narrow">
          <h2>Three things, measured separately</h2>
          <p style={{ color: 'var(--ink-2)', marginTop: 14 }}>
            &ldquo;Accuracy&rdquo; hides three different questions. Is the arithmetic right? Can the
            system read the facts out of how people actually write? And, given both, does it
            reach the right answer? They fail in different ways and are measured in different
            ways, so they are reported apart rather than blended into one flattering number.
          </p>

          {/* ---- 1. rules ---- */}
          <h3 style={{ marginTop: 40, fontSize: '1.15rem' }}>1. Do the rules match the federal sources?</h3>
          {conformance && (
            <p className="big-figure">
              {conformance.passed} <span>of {conformance.total}</span>
            </p>
          )}
          <p style={{ color: 'var(--ink-2)', marginTop: 8 }}>
            Hand-computed cases, each with its expected figure worked out from a primary source
            and written down as a number — USDA&rsquo;s own worked SNAP example, the IRS revenue
            procedure tables, the medicare.gov limits, VA&rsquo;s pension rates. None of the expected
            figures is produced by the code being tested, so a disagreement is a disagreement
            with an agency.
          </p>
          <p style={{ color: 'var(--ink-2)', marginTop: 12 }}>
            On its first run this found a real error: at the plateau of the Earned Income Tax
            Credit, a filer with three children was being shown $8,230.50 against a published
            maximum of $8,231, because the rate times the earned income amount lands just under
            the rounded figure the IRS publishes. It is fixed.
          </p>
          <details className="disclosure">
            <summary>All {liveCases.length} cases and their sources</summary>
            <ul className="steps">
              {liveCases.map((c) => (
                <li key={c.id}>
                  <span>
                    {c.what}
                    <br />
                    <span className="cite">{c.source}</span>
                  </span>
                  <span className="amt">{c.passed ? 'agrees' : 'DISAGREES'}</span>
                </li>
              ))}
            </ul>
          </details>

          {/* ---- 2. reading ---- */}
          <h3 style={{ marginTop: 48, fontSize: '1.15rem' }}>
            2. Can it read the facts out of real descriptions?
          </h3>
          {reading && reading.edition === HOLDOUT_EDITION ? (
            <>
              <p className="big-figure">
                {percent(reading.withEngine.rate)}
                <span> of facts read correctly</span>
              </p>
              <p style={{ color: 'var(--ink-2)', marginTop: 8 }}>
                Twenty descriptions written the way people actually write — &ldquo;base pay is
                about $900 and tips add around $1,100&rdquo;, &ldquo;every other week, about $1,150
                after taxes&rdquo;, &ldquo;me, my son, and our dog&rdquo; — with the facts labelled by
                hand before anything read them, and scored once. This is the{' '}
                {ORDINALS[HOLDOUT_EDITION] ?? `${HOLDOUT_EDITION}th`} such set: each earlier one
                moved into the development set once it had been fixed against.
              </p>
              <p style={{ color: 'var(--ink-2)', marginTop: 12 }}>
                Code finds every amount that could be money. The decision model says what each
                one is — pay, rent, a utility bill, child care — and how often it is paid, as a
                choice among fixed options, so it never writes a number and cannot garble one.
                Code copies the amount and does every sum. Counting people stays in code; where
                the model counts the household differently, the screener asks rather than
                guesses. Pattern-matching code alone scores {percent(reading.codeParser.rate)} on
                the same set.
              </p>
              <ul className="steps" style={{ marginTop: 18 }}>
                <li>
                  <span><strong>Fact</strong></span>
                  <span className="amt"><strong>With the model</strong> · code alone</span>
                </li>
                {Object.entries(reading.withEngine.byField).map(([field, v]) => {
                  const c = reading.codeParser.byField[field];
                  return (
                    <li key={field}>
                      <span>{FIELD_LABELS[field] ?? field}</span>
                      <span className="amt">
                        {v.correct}/{v.total} · {c ? `${c.correct}/${c.total}` : '—'}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p style={{ color: 'var(--ink-2)', marginTop: 14 }}>
                A miss that leaves a fact blank makes the screener ask for it. A miss that reads
                a fact wrongly is worse, because nothing prompts anyone to check it: code alone
                read a $140 electric bill as one household&rsquo;s whole income. Every remaining
                miss is listed rather than quietly fixed.
              </p>
              <details className="disclosure">
                <summary>The {reading.withEngine.misses.length} facts it got wrong or missed</summary>
                <ul className="steps">
                  {reading.withEngine.misses.map((m) => (
                    <li key={`${m.id}-${m.field}`}>
                      <span>
                        {FIELD_LABELS[m.field] ?? m.field}
                        <br />
                        <span className="cite">case {m.id}</span>
                      </span>
                      <span className="amt">
                        {m.got === null ? 'asked instead' : `read ${String(m.got)}`}, is {String(m.expected)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : (
            extraction && (
              <p className="big-figure">
                {(extraction.holdout.rate * 100).toFixed(1)}%
                <span> of facts read correctly</span>
              </p>
            )
          )}

          {/* ---- 3. end to end ---- */}
          <h3 style={{ marginTop: 48, fontSize: '1.15rem' }}>3. Does it reach the right answer?</h3>
          {engineRun ? (
            <>
              <p className="big-figure">
                {percent(engineRun.meanBalancedAccuracy)}
                <span> mean balanced accuracy across {Object.keys(engineRun.balancedAccuracyByProgram).length} programs</span>
              </p>
              <p style={{ color: 'var(--ink-2)', marginTop: 8 }}>
                The {engineRun.households} households held back for this, run through the
                whole system: the paragraph read, every rule answered by the decision model,
                follow-up questions asked and answered, and each program&rsquo;s verdict compared
                with the answer key. Accuracy is scored on the {engineRun.specifiedCount} of them
                that state every fact; the rest are missing one on purpose, to test the
                follow-up questions. The confidence threshold ({engineRun.tau}) was chosen
                beforehand on the development households by a rule fixed in advance.
              </p>
              <p style={{ color: 'var(--ink-2)', marginTop: 12 }}>
                {engineRun.medianQuestionsAsked === 0
                  ? 'Most households are now asked no follow-up at all.'
                  : `The median household is now asked ${engineRun.medianQuestionsAsked} follow-ups.`}{' '}
                A question is chosen by how much money its answer is expected to move, weighed by
                how likely each answer is, and one expected to move less than $25 a year is not
                asked.{comparedRun && ` Before that change these households were asked ${comparedRun.totalQuestionsAsked} questions in all; they are now asked ${engineRun.totalQuestionsAsked}, with no loss of accuracy.`} The weak spot that remains: where a description never says
                whether the money comes from a job or from benefits, the model sometimes guesses
                confidently instead of asking.
              </p>
              {baselineRun && comparedRun && (
                <h4 style={{ marginTop: 28, fontSize: '1rem' }}>
                  Beside a general-purpose model, on the same version of the system
                </h4>
              )}
              {baselineRun && comparedRun && (
                <ul className="steps" style={{ marginTop: 18 }}>
                  <li>
                    <span><strong>Held-out households</strong></span>
                    <span className="amt"><strong>BennyFit</strong> · {modelName(baselineRun.engine)}</span>
                  </li>
                  <li>
                    <span>Mean balanced accuracy</span>
                    <span className="amt">{percent(comparedRun.meanBalancedAccuracy)} · {percent(baselineRun.meanBalancedAccuracy)}</span>
                  </li>
                  <li>
                    <span>Median time to a full result</span>
                    <span className="amt">{(comparedRun.medianWallClockMs / 1000).toFixed(1)}s · {(baselineRun.medianWallClockMs / 1000).toFixed(1)}s</span>
                  </li>
                  <li>
                    <span>Median follow-up questions</span>
                    <span className="amt">{comparedRun.medianQuestionsAsked} · {baselineRun.medianQuestionsAsked}</span>
                  </li>
                  <li>
                    <span>
                      Asked for the missing deciding fact
                      <br />
                      <span className="cite">first question · at any point, of 10 households missing one</span>
                    </span>
                    <span className="amt">
                      {percent(comparedRun.questionRelevance)} / {percent(comparedRun.questionAskedAtAllRate)} ·{' '}
                      {percent(baselineRun.questionRelevance)} / {percent(baselineRun.questionAskedAtAllRate)}
                    </span>
                  </li>
                  {comparedRun.billedUSD !== null && baselineRun.billedUSD !== null && (
                    <li>
                      <span>
                        Cost per household screened
                        <br />
                        <span className="cite">as billed for this run</span>
                      </span>
                      <span className="amt">
                        ${(comparedRun.billedUSD / comparedRun.households).toFixed(4)} · $
                        {(baselineRun.billedUSD / baselineRun.households).toFixed(3)}
                      </span>
                    </li>
                  )}
                </ul>
              )}
              {baselineRun && (
                <p style={{ color: 'var(--ink-2)', marginTop: 14 }}>
                  The comparison is a general-purpose model doing the same job the way a careful
                  team would build it today: the same paragraph, the same rules, the same
                  follow-up loop and answer key, with its reply held to a schema that allows
                  only each rule&rsquo;s own options. The two are close on accuracy. The general
                  model&rsquo;s misses cluster in one place: five times it read &ldquo;rent with
                  utilities included&rdquo; as not paying for heating, where the rule says
                  energy paid through the rent counts. It was more thorough about asking for a
                  missing fact at some point, partly because it asked the maximum three
                  questions every time. The larger differences are time and cost.
                </p>
              )}
              <details className="disclosure">
                <summary>Every program</summary>
                <ul className="steps">
                  {Object.entries(engineRun.balancedAccuracyByProgram).map(([program, value]) => (
                    <li key={program}>
                      <span>{LABELS[program] ?? program}</span>
                      <span className="amt">
                        {percent(value)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
              <p style={{ color: 'var(--ink-2)', marginTop: 14 }}>
                The first run found a mistake in the rules rather than in the model: the
                dependent care credit needs a child under 13, and both the answer key and the
                screener counted every child. It is fixed, a conformance case now pins it, and
                the held-out run was repeated on the corrected rules. Run to run, the model&rsquo;s
                answers vary slightly: both runs got three verdicts wrong, not the same three.
              </p>
            </>
          ) : (
            <>
              <p className="big-figure pending-figure">Pending the live service</p>
              <p style={{ color: 'var(--ink-2)', marginTop: 8 }}>
                This is the figure that matters most. It will be scored on the {holdoutCount}{' '}
                households held back for this purpose: a third of the set, spread across every
                kind of household, that nothing is tuned against.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="band">
        <div className="shell-narrow">
          <h2>Why the figure is not simply &ldquo;percent correct&rdquo;</h2>
          <p style={{ color: 'var(--ink-2)', marginTop: 14 }}>
            Four out of five households in the set qualify for SNAP. A system that
            answered &ldquo;eligible&rdquo; to every household would therefore be 80% correct while
            being completely useless. The figure reported here is balanced accuracy: it
            weighs getting the ineligible households right equally with getting the
            eligible ones right, and that same do-nothing system would score 50%.
          </p>

          <h2 style={{ marginTop: 40 }}>Two kinds of wrong, and which one we fear</h2>
          <p style={{ color: 'var(--ink-2)', marginTop: 14 }}>
            Telling someone they are likely eligible when they are not costs them a wasted
            application and their trust. Telling someone they are not eligible when they
            are is the exact failure this product exists to fix, and it is silent — nobody
            ever finds out. Both are tracked separately rather than averaged away, and
            every household is shown every program, including the ones judged unlikely, so
            a person who knows their own situation can disagree with us.
          </p>

          <h2 style={{ marginTop: 40 }}>What these numbers do not cover</h2>
          <p style={{ color: 'var(--ink-2)', marginTop: 14 }}>
            The validation households are synthetic. Writing them from known facts is what
            makes their correct answers checkable, and it also makes them tidier than the
            way people really write. A strong score here is evidence that the rules are
            implemented correctly and that the follow-up questions are well chosen. It is
            not evidence about real applicants, and we will not present it as such.
          </p>
          <p style={{ color: 'var(--ink-2)', marginTop: 14 }}>
            SNAP, Medicaid and state earned income credits are screened under each
            state&rsquo;s own rules: the higher SNAP income limits and dropped savings tests
            most states use, Medicaid expansion or not, and the state credit rate. The other
            programs use federal limits, which some states and local agencies raise, so a
            household told it is unlikely to qualify for one of those may still qualify
            where it lives. Every result says so.
          </p>

          <h2 style={{ marginTop: 40 }}>Where the rules come from</h2>
          <p style={{ color: 'var(--ink-2)', marginTop: 14 }}>
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
