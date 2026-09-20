import Link from 'next/link';

import { AccuracyStrip } from '@/app/components/AccuracyStrip';
import { readResults } from '@/lib/results';

export const dynamic = 'force-dynamic';

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function Method() {
  const results = readResults();

  return (
    <>
      <main>
        <h1>How this works, and how it is measured</h1>

        <h2>What the model does, and what it does not</h2>
        <p className="lede">
          The decision engine never does arithmetic. It reads a household description and
          answers factual questions about it: whether someone is 60 or older, whether an
          income figure is from work or from benefits, whether a child lived at that
          address for most of the year. Every comparison between a number and a limit,
          every deduction and every dollar figure is computed in code, from tables read
          off federal sources, before the engine is shown anything. The engine is given
          the computed figure, not the raw text of it.
        </p>

        <h2>Why the probabilities are a control signal</h2>
        <p className="lede">
          Each answer is a distribution over the options that criterion offers, so an
          answer is structurally one of them. The engine cannot return an option
          belonging to a different criterion, because the shape has no way to express
          that. The spread of the distribution says how settled the answer is, and a flat
          distribution is the engine reporting that the description does not decide the
          question.
        </p>
        <p className="lede">
          That signal is what chooses the next question. Being unsure is not enough on its
          own: a criterion is only worth asking about if forcing its options apart changes
          the dollar total across the three programmes. A criterion nobody&rsquo;s answer could
          move is never asked, however uncertain it is. Among those that do move money,
          the one worth the most is asked first, and ties break toward the criterion that
          settles the most programmes at once.
        </p>

        <h2>What the numbers mean</h2>
        {!results ? (
          <p className="lede">No evaluation has been run yet.</p>
        ) : (
          <>
            {results.isFixture && (
              <div className="notice">
                The last run used the local fixture rather than a decision model. The
                fixture is a keyword matcher written to exercise the loop, and its cues
                were adjusted while looking at gold-set failures. Treat every figure below
                as a demonstration that the harness runs, not as a measurement of any
                model.
              </div>
            )}
            <ul className="steps">
              {Object.entries(results.balancedAccuracyByProgram).map(([program, value]) => (
                <li key={program}>
                  <span>
                    Balanced accuracy, {program}
                    <br />
                    <span className="cite">
                      mean of the true-positive and true-negative rates, over{' '}
                      {results.specifiedCount} fully specified households
                    </span>
                  </span>
                  <span className="amt">{percent(value)}</span>
                </li>
              ))}
              <li>
                <span>
                  Question relevance
                  <br />
                  <span className="cite">
                    share of the {results.underspecifiedCount} underspecified households
                    where the first question asked was the fact the description withheld
                  </span>
                </span>
                <span className="amt">{percent(results.questionRelevance)}</span>
              </li>
              <li>
                <span>
                  Criteria per household, median
                  <br />
                  <span className="cite">resolved in one batched pass</span>
                </span>
                <span className="amt">{results.medianCriteriaPerHousehold}</span>
              </li>
              <li>
                <span>
                  Questions asked, median
                  <br />
                  <span className="cite">capped at {results.maxQuestions}</span>
                </span>
                <span className="amt">{results.medianQuestionsAsked}</span>
              </li>
            </ul>

            <h2>Why balanced accuracy</h2>
            <p className="lede">
              The gold set is four-fifths eligible for SNAP. A system that answered
              &ldquo;eligible&rdquo; to everything would score 80% on plain accuracy while being
              useless, so the figure reported is the mean of the true-positive and
              true-negative rates, which that system would score 50% on.
            </p>

            <h2>Choosing the threshold</h2>
            <p className="lede">
              τ is the confidence at or above which an answer counts as settled. It was
              swept across the gold set rather than picked.
            </p>
            {results.tauSweep.length > 0 && (
              <ul className="steps">
                {results.tauSweep.map((row) => (
                  <li key={row.tau}>
                    <span>
                      τ = {row.tau}
                      {row.tau === results.tau && <strong> — in use</strong>}
                      <br />
                      <span className="cite">
                        mean balanced accuracy {percent(row.meanBalancedAccuracy)}
                      </span>
                    </span>
                    <span className="amt">{percent(row.questionRelevance)} relevant</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <h2>What this does not measure</h2>
        <p className="lede">
          The gold set is synthetic. Its households were written from structured facts,
          which makes their verdicts checkable but also makes them cleaner than the way
          people actually describe themselves. A high score here is evidence that the
          rules are implemented correctly and the loop picks sensible questions. It is not
          evidence about real applicants.
        </p>
        <p className="lede">
          The screening uses federal floor rules. Most states have raised the SNAP income
          limit and many have dropped the asset test, so a household told it does not
          qualify here may qualify at home. Nothing here is an eligibility determination,
          and every result links to the programme&rsquo;s own application.
        </p>

        <p className="disclaimer" style={{ marginTop: 36 }}>
          <Link href="/">Use the screener</Link> · <Link href="/demo">See the comparison</Link>
        </p>
      </main>
      <AccuracyStrip results={results} repoLink={false} />
    </>
  );
}
