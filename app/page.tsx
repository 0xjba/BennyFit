import Link from 'next/link';

import { PaperStack } from '@/app/components/PaperStack';
import { Masthead, SiteFooter } from '@/app/components/SiteChrome';
import { TypedIntake } from '@/app/components/TypedIntake';
import { CITED, CLAIMS, type Claim } from '@/lib/claims';
import { BDT, COMPARE_ROWS, COMPETITORS } from '@/lib/competitors';
import { conventionalForms, conventionalQuestionCount } from '@/lib/conventional';

export const metadata = {
  title: 'BennyFit — benefits screening in one conversation',
  description:
    'BennyFit checks a household against federal benefit programs from a single plain-language description, and asks a follow-up question only when the answer changes the outcome.',
};

function Stat({ claim }: { claim: Claim }) {
  return (
    <div>
      <span className="n">
        {claim.status === 'measured' ? claim.value : <span className="pending">In validation</span>}
      </span>
      <span className="k">{claim.caption}</span>
    </div>
  );
}

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How is this different from an eligibility calculator?',
    a: 'A calculator asks a fixed list of questions and stops. BennyFit reads the household description once, works out what it already knows, and then asks only about the facts that would actually change the result. Many households are asked nothing at all, and none is asked more than three questions.',
  },
  {
    q: 'Where do the rules come from?',
    a: 'Directly from the federal sources: the USDA cost-of-living memos and the SNAP regulations, the IRS revenue procedures for the Earned Income Tax Credit, the HHS poverty guidelines, and the USAC Lifeline tables. Every dollar figure records the page it was read from and the date it was read, and those documents are kept alongside the rules so any number can be traced back.',
  },
  {
    q: 'What happens when the rules change?',
    a: 'Every figure is stored against the period it applies to, so the system picks the table in force on the date of the screening. The SNAP fiscal year turns over on 1 October and the change takes effect on its own. When a new table has not been published yet, the screening says so on screen rather than quietly using a stale number.',
  },
  {
    q: 'Is this an eligibility determination?',
    a: 'No, and it never presents itself as one. Every result is labelled as a screening estimate and links to the program’s own application. The system uses federal minimum rules; most states are more generous, so a household told it is unlikely to qualify may still qualify where it lives, and the result says that too.',
  },
  {
    q: 'What do you do with what people type?',
    a: 'Nothing. There is no database, the screening keeps no session, and household descriptions are not retained or used for analytics. The validation set the accuracy figures are measured on is entirely synthetic.',
  },
  {
    q: 'How do you measure accuracy?',
    a: 'Against 150 households whose correct answers are worked out from the federal rules independently of the system being tested. The headline figure is balanced accuracy, which cannot be inflated by the mix of the set — a system that simply answered “eligible” to everything would score 50%, not 80%. The full method is published.',
  },
  {
    q: 'Which programs are covered?',
    a: 'SNAP, the Earned Income Tax Credit and Lifeline, each against its full federal rule set rather than a simplified version. These three were chosen because they interact: qualifying for one can qualify a household for another, and BennyFit follows that automatically.',
  },
  {
    q: 'How does it fit into what we already run?',
    a: 'It works as a screening step in front of whatever intake you have. A household describes their situation once, and your team receives the programs they are likely to qualify for, the estimated annual value of each, and the specific reason behind each result.',
  },
];

export default function Landing() {
  const questionCount = conventionalQuestionCount();
  const applications = conventionalForms().length;

  return (
    <>
      <Masthead />

      {/* ---------------- hero ---------------- */}
      <section className="hero">
        <div className="shell">
          <div className="hero-stage">
            <div className="hero-grid">
              <div>
                <span className="eyebrow">Benefits eligibility screening</span>
                <h1>Every benefit they qualify for, from one paragraph.</h1>
              </div>
              <div>
                <p className="sub">
                  BennyFit screens a household against{' '}
                  <strong>{CLAIMS.programs.status === 'measured' ? CLAIMS.programs.value : ''} federal
                  benefit programs</strong>{' '}
                  from a single plain-language description — no forms, no questionnaire. Benny,
                  our agent, asks a follow-up only when the answer would change what they get.
                </p>
                <div className="hero-cta">
                  <Link href="/demo" className="btn lg">
                    Try the demo
                  </Link>
                  <Link href="/compare" className="btn ghost lg">
                    See the comparison
                  </Link>
                </div>
                <p className="hero-note">No sign-up. Nothing typed into the demo is stored.</p>
              </div>
            </div>

            <div className="hero-figs">
              <PaperStack questions={questionCount} applications={applications} />
              <div className="versus">vs</div>
              <TypedIntake />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- stats ---------------- */}
      <section className="band tight">
        <div className="shell">
          <div className="band-head center">
            <span className="eyebrow">What one paragraph is worth</span>
            <h2>The money people are already entitled to.</h2>
          </div>
          <div className="statrow">
            <Stat claim={CLAIMS.averageValue} />
            <Stat claim={CLAIMS.programs} />
            <Stat claim={CLAIMS.programsPerHousehold} />
            <Stat claim={CLAIMS.questions} />
          </div>
          <p className="disclaimer" style={{ marginTop: 30, textAlign: 'center' }}>
            The dollar figure is computed from the federal rules applied to our 150
            validation households, not from a model. Those households are synthetic, so it
            describes the validation set rather than the population.{' '}
            <Link href="/results">How this is measured</Link>.
          </p>
        </div>
      </section>

      {/* ---------------- problem ---------------- */}
      <section className="band">
        <div className="shell">
          <div className="band-head center">
            <span className="eyebrow">The gap</span>
            <h2>The money is appropriated. It just never reaches people.</h2>
            <p>
              Not because they are ineligible, and not because the money runs out. Because
              nobody ever told them, and because finding out is a day&rsquo;s work.
            </p>
          </div>
          <div className="card-grid c3">
            <div className="tile">
              <span className="figure">{CITED.eitcUnclaimedDollars.value}</span>
              <h3>left unclaimed every year</h3>
              <p>
                {CITED.eitcUnclaimedDollars.claim}, by {CITED.eitcUnclaimedPeople.value} eligible
                people.{' '}
                <a href={CITED.eitcUnclaimedDollars.href} target="_blank" rel="noreferrer">
                  {CITED.eitcUnclaimedDollars.source}
                </a>
              </p>
            </div>
            <div className="tile">
              <span className="figure">{CITED.unawareShare.value}</span>
              <h3>never knew they qualified</h3>
              <p>
                {CITED.unawareShare.claim}.{' '}
                <a href={CITED.unawareShare.href} target="_blank" rel="noreferrer">
                  {CITED.unawareShare.source}
                </a>
              </p>
            </div>
            <div className="tile">
              <span className="figure">{CITED.assistanceLift.value}</span>
              <h3>is what help does to enrollment</h3>
              <p>
                In a randomized trial of about 30,000 likely-eligible households, pairing
                outreach with help completing the application moved enrollment from 11% to 18%.{' '}
                <a href={CITED.assistanceLift.href} target="_blank" rel="noreferrer">
                  {CITED.assistanceLift.source}
                </a>
              </p>
            </div>
          </div>
          <p className="disclaimer" style={{ marginTop: 26, textAlign: 'center' }}>
            That trial measured people helping people. It is the reasoning BennyFit is built
            on, not a result BennyFit has produced.
          </p>
        </div>
      </section>

      {/* ---------------- benny, on the dark panel ---------------- */}
      <section className="band tight">
        <div className="shell">
          <div className="panel">
            <div>
              <span className="eyebrow">Meet Benny</span>
              <h2>
                Put simply, <span className="hl">Benny asks the one question that matters.</span>
              </h2>
              <p>
                Not a chatbot walking someone through a form. Benny reads the whole situation,
                works out which rules are already settled by it, and finds the single
                unanswered fact that would move the outcome most — then says what it is worth.
              </p>
              <p>
                For this household, thirty-one of the thirty-two rules were already decided by
                the paragraph. One was not.
              </p>
            </div>

            <div className="question-card">
              <div className="meta">Benny needs one thing</div>
              <div className="qq">
                Is that money from a job, or from benefits like Social Security?
              </div>
              <div className="worth">
                Worth about $1,248 a year — it changes the deduction, and the amount.
              </div>
              <div className="settled">
                <div className="settled-row">
                  <span>Household size, income, housing costs</span>
                  <span className="ok">settled</span>
                </div>
                <div className="settled-row">
                  <span>Age and disability tests</span>
                  <span className="ok">settled</span>
                </div>
                <div className="settled-row">
                  <span>Savings, students, citizenship</span>
                  <span className="ok">settled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- how ---------------- */}
      <section className="band" id="how">
        <div className="shell">
          <div className="band-head center">
            <span className="eyebrow">How it works</span>
            <h2>One description in. Every program checked.</h2>
          </div>
          <div className="steps-row">
            <div className="step">
              <div className="num">1</div>
              <h3>They describe their situation once</h3>
              <p>
                In their own words, the way they would tell a person. No forms, no sequence of
                screens, no vocabulary to learn.
              </p>
            </div>
            <div className="step">
              <div className="num">2</div>
              <h3>Benny checks every rule at once</h3>
              <p>
                Every eligibility rule across all eleven programs is checked against that one
                description together, not program by program. Income, deductions and thresholds
                are calculated from the official tables, never estimated.
              </p>
            </div>
            <div className="step">
              <div className="num">3</div>
              <h3>Benny asks only what matters</h3>
              <p>
                If something they did not mention would change the result, Benny asks about
                that one thing and explains why. If nothing would, it asks nothing and gives
                the answer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- why ---------------- */}
      <section className="band" id="why">
        <div className="shell">
          <div className="band-head center">
            <span className="eyebrow">Why BennyFit</span>
            <h2>Built to be checked, not just believed.</h2>
            <p>
              Screening tools are easy to build and hard to trust. Everything here is designed
              so that a wrong answer would be visible.
            </p>
          </div>
          <div className="card-grid c4">
            <div className="tile">
              <h3>Traceable to the source</h3>
              <p>
                Every dollar figure records the official page it came from and the date it was
                read. Nothing is transcribed from a summary or a third-party site.
              </p>
            </div>
            <div className="tile">
              <h3>It shows its working</h3>
              <p>
                Each result comes with the deduction-by-deduction arithmetic behind it and the
                specific rule that decided it, with the regulation cited.
              </p>
            </div>
            <div className="tile">
              <h3>Measured, not asserted</h3>
              <p>
                Accuracy is reported against a validation set whose correct answers are worked
                out from the rules independently, and the method is published in full.
              </p>
            </div>
            <div className="tile">
              <h3>Nothing is kept</h3>
              <p>
                No database, no session, no retention of what a household types, and no
                analytics on the text of it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- comparison ---------------- */}
      <section className="band">
        <div className="shell">
          <div className="band-head center">
            <span className="eyebrow">Compared with</span>
            <h2>How we sit against the screeners in use today.</h2>
            <p>
              Every claim below is something each product publishes about itself, linked to
              the page it came from. Two of them screen for more programs than we do, and
              the table says so.
            </p>
          </div>

          <div className="compare">
            <table>
              <thead>
                <tr>
                  <th />
                  {COMPETITORS.map((c) => (
                    <th key={c.id}>
                      <a href={c.href} target="_blank" rel="noreferrer">
                        {c.name}
                      </a>
                      <span className="th-sub">{c.what}</span>
                    </th>
                  ))}
                  <th className="ours">
                    BennyFit
                    <span className="th-sub">Three programs, in full</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">
                      {row.label}
                      {row.footnote && <span className="row-note">{row.footnote}</span>}
                    </th>
                    {COMPETITORS.map((c) => (
                      <td key={c.id} className={row.cells[c.id]?.tone === 'good' ? 'strong' : 'muted'}>
                        {row.cells[c.id]?.text ?? '—'}
                      </td>
                    ))}
                    <td className={`ours${row.cells.bennyfit?.tone === 'weak' ? ' behind' : ''}`}>
                      {row.cells.bennyfit?.text ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="disclaimer" style={{ marginTop: 22 }}>
            Read from each product&rsquo;s own pages on 21 September 2026. Where a figure is a
            marketing claim rather than a published measurement, the cell says so. Our own
            speed and cost per screening are still in validation and are not claimed here.
          </p>

          <div className="bdt">
            <div>
              <h3>And the largest staffed operator is gone.</h3>
              <p>
                {BDT.name} {BDT.fact}. {BDT.detail}{' '}
                <a href={BDT.href} target="_blank" rel="noreferrer">
                  {BDT.source}
                </a>
              </p>
            </div>
            <p className="bdt-point">
              Screening people one at a time works. It has never scaled, and the funding for
              it is not reliable.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- faq ---------------- */}
      <section className="band" id="faq">
        <div className="shell">
          <div className="band-head center">
            <span className="eyebrow">FAQ</span>
            <h2>Questions we get asked</h2>
          </div>
          <div className="faq">
            {FAQS.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- cta ---------------- */}
      <section className="band tight">
        <div className="shell">
          <div className="cta-panel">
            <h2>See it on a real household.</h2>
            <p>
              Type a situation in your own words and watch every rule across eleven programs get
              checked at once. It takes about thirty seconds.
            </p>
            <Link href="/demo" className="btn lg">
              Try the demo
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
