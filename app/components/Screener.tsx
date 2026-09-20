'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CriterionView, ScreenResponse } from '@/app/api/screen/route';

const SAMPLES: { tag: string; text: string }[] = [
  {
    tag: 'Retired, living alone — the loop asks one question here',
    text: "I'm 62, live alone in Ohio, and get about $1,150 a month. Rent is $700 and I pay my own gas and electric.",
  },
  {
    tag: 'Working parent, paid weekly',
    text: 'I work part time and make $430 a week. I have two kids, rent is $1,200 a month, and daycare costs $300.',
  },
  {
    tag: 'Two earners, no children',
    text: 'My husband and I both work, we bring in about $3,400 a month together, and we pay $1,500 rent.',
  },
];

const PROGRAM_ORDER = ['snap', 'eitc', 'lifeline'];
const PROGRAM_NAMES: Record<string, string> = {
  snap: 'SNAP',
  eitc: 'Earned Income Tax Credit',
  lifeline: 'Lifeline',
};

type Phase = 'empty' | 'reading' | 'asking' | 'results' | 'error';

interface Reply {
  instanceId: string;
  question: string;
  reply: string;
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

/**
 * Milliseconds below a second, seconds above it.
 *
 * A round trip of under a millisecond displayed as "0.0s" reads as a broken clock. The
 * whole claim rests on this number, so it has to be legible at the scale it actually
 * lands at.
 */
function duration(ms: number): string {
  if (ms < 1) return `${ms.toFixed(2)}ms`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * A running millisecond counter, so the number on screen is a measurement.
 *
 * The elapsed value is only ever written from inside an animation frame, never
 * synchronously while the effect runs, which would cascade a render on every start.
 */
function useStopwatch(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    startedAt.current = performance.now();
    let frame = requestAnimationFrame(function tick() {
      setElapsed(performance.now() - startedAt.current);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [running]);

  return running ? elapsed : 0;
}

function ConfidenceBar({ confidence, low }: { confidence: number; low: boolean }) {
  // Bars only, never a percentage. A confidence is conditional on the options supplied
  // and is not a probability that the household qualifies, so rendering it as "83%"
  // would invite exactly the reading it cannot support.
  return (
    <div
      className={low ? 'bar low' : 'bar'}
      title={low ? 'below the threshold: the engine could not settle this' : 'settled'}
      aria-label={low ? 'not settled' : 'settled'}
    >
      <span style={{ width: `${Math.round(confidence * 100)}%` }} />
    </div>
  );
}

/**
 * The criteria grid, filling in row by row.
 *
 * The reveal is presentation; the millisecond figure beside it is the measured round
 * trip. The parent remounts this component on each pass, so the count starts at zero
 * without any effect having to reset it, and the whole grid visibly re-reads after an
 * answer rather than updating in place.
 */
function CriteriaGrid({
  criteria,
  dimSettled,
}: {
  criteria: CriterionView[];
  dimSettled: boolean;
}) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const total = criteria.length;
    const perRow = Math.max(4, Math.min(14, 420 / Math.max(total, 1)));
    const timer = setInterval(() => {
      setRevealed((row) => {
        if (row + 1 >= total) clearInterval(timer);
        return row + 1;
      });
    }, perRow);
    return () => clearInterval(timer);
  }, [criteria.length]);

  const grouped = useMemo(() => {
    const map = new Map<string, CriterionView[]>();
    for (const c of criteria) {
      const list = map.get(c.programId) ?? [];
      list.push(c);
      map.set(c.programId, list);
    }
    return PROGRAM_ORDER.filter((p) => map.has(p)).map((p) => [p, map.get(p)!] as const);
  }, [criteria]);

  let index = 0;

  return (
    <div>
      {grouped.map(([programId, rows]) => (
        <section className="program-group" key={programId}>
          <div className="program-head">
            <span>{PROGRAM_NAMES[programId] ?? programId}</span>
            <span>{rows.length} criteria</span>
          </div>
          {rows.map((c) => {
            const position = index++;
            const pending = position >= revealed;
            const dim = dimSettled && c.settled;
            return (
              <div
                className={`criterion${dim ? ' dim' : ''}${pending ? ' pending' : ''}`}
                key={c.instanceId}
              >
                <div className="criterion-label">
                  {c.label}
                  {c.subjectLabel && (
                    <span className="criterion-subject"> — {c.subjectLabel}</span>
                  )}
                </div>
                <div className="criterion-answer">
                  {pending ? '' : c.chosenLabel}
                  {!pending && c.presumed && <span className="presumed"> (presumed)</span>}
                </div>
                <ConfidenceBar confidence={c.confidence} low={!c.settled} />
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

export function Screener({ asOf }: { asOf: string }) {
  const [paragraph, setParagraph] = useState('');
  const [phase, setPhase] = useState<Phase>('empty');
  const [data, setData] = useState<ScreenResponse | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [passCount, setPassCount] = useState(0);
  const [engineMsTotal, setEngineMsTotal] = useState(0);

  const busy = phase === 'reading';
  const elapsed = useStopwatch(busy);
  const questionRef = useRef<HTMLInputElement>(null);

  const run = useCallback(
    async (text: string, nextReplies: Reply[]) => {
      setPhase('reading');
      setError(null);
      try {
        const response = await fetch('/api/screen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paragraph: text, replies: nextReplies, asOf }),
        });
        const json = await response.json();
        if (!response.ok) {
          setError(json.error ?? 'Something went wrong.');
          setPhase('error');
          return;
        }
        const result = json as ScreenResponse;
        setData(result);
        setPassCount((n) => n + 1);
        setEngineMsTotal((ms) => ms + result.engineElapsedMs);
        setPhase(result.next ? 'asking' : 'results');
        setAnswer('');
      } catch {
        setError('Could not reach the screener.');
        setPhase('error');
      }
    },
    [asOf]
  );

  useEffect(() => {
    if (phase === 'asking') questionRef.current?.focus();
  }, [phase, data]);

  const start = (text: string) => {
    setParagraph(text);
    setReplies([]);
    setEngineMsTotal(0);
    setPassCount(0);
    void run(text, []);
  };

  const submitAnswer = (reply: string | null) => {
    if (!data?.next) return;
    if (reply === null) {
      // A skipped question still counts as put, so the loop moves on rather than
      // offering the same one again.
      setPhase('results');
      return;
    }
    const next = [
      ...replies,
      { instanceId: data.next.instanceId, question: data.next.question, reply },
    ];
    setReplies(next);
    void run(paragraph, next);
  };

  const reset = () => {
    setParagraph('');
    setData(null);
    setReplies([]);
    setPhase('empty');
    setError(null);
    setEngineMsTotal(0);
    setPassCount(0);
  };

  const ranked = useMemo(
    () =>
      data
        ? [...data.verdicts].sort(
            (a, b) => (b.annualValue ?? 0) - (a.annualValue ?? 0)
          )
        : [],
    [data]
  );

  return (
    <>
      {(phase === 'empty' || phase === 'error') && (
        <>
          <textarea
            value={paragraph}
            onChange={(e) => setParagraph(e.target.value)}
            placeholder="I'm 62, live alone in Ohio, and get about $1,150 a month. Rent is $700 and I pay my own gas and electric."
            aria-label="Describe your household"
          />
          <p className="disclaimer">
            This is a screening estimate from federal rules, not an eligibility
            determination. Your state&rsquo;s rules may differ. Apply through the official link
            to find out. Nothing you type is stored.
          </p>
          <div className="row">
            <button onClick={() => start(paragraph)} disabled={paragraph.trim().length === 0}>
              Check three programs
            </button>
          </div>
          <div className="samples">
            {SAMPLES.map((s) => (
              <button className="sample" key={s.tag} onClick={() => start(s.text)}>
                <span className="sample-tag">{s.tag}</span>
                {s.text}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <div className="error">
          <strong>{error}</strong>
          <div className="row">
            <button className="secondary" onClick={() => start(paragraph)}>
              Try again
            </button>
          </div>
        </div>
      )}

      {data && phase !== 'empty' && phase !== 'error' && (
        <>
          {data.isFixture && (
            <div className="notice">
              Answers come from the local fixture, not from a decision model. Figures show
              that the loop runs; they measure nothing about a model.
            </div>
          )}
          {data.thresholdNotice && <div className="notice">{data.thresholdNotice}</div>}

          {phase !== 'results' && (
            <div className="counter">
              <div>
                <span className="value">{data.criteriaEvaluated}</span>
                <span className="label">criteria, one pass</span>
              </div>
              <div>
                <span className="value">{duration(data.engineElapsedMs)}</span>
                <span className="label">engine round trip</span>
              </div>
              <div>
                <span className="value">{duration(elapsed)}</span>
                <span className="label">elapsed</span>
              </div>
              <div>
                <span className="value">{data.lowConfidenceCount}</span>
                <span className="label">below the threshold</span>
              </div>
            </div>
          )}

          {phase === 'asking' && data.next && (
            <div className="question-block">
              <p className="q">{data.next.question}</p>
              <p className="why">{data.next.reason}</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (answer.trim().length > 0) submitAnswer(answer.trim());
                }}
              >
                <input
                  ref={questionRef}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Answer in your own words"
                  aria-label={data.next.question}
                />
                <div className="row">
                  <button type="submit" disabled={answer.trim().length === 0}>
                    Answer
                  </button>
                  <button type="button" className="skip" onClick={() => submitAnswer(null)}>
                    Skip this question
                  </button>
                </div>
              </form>
            </div>
          )}

          {phase === 'results' && (
            <>
              <div className="counter">
                <div>
                  <span className="value">{money(data.totalAnnualValue)}</span>
                  <span className="label">a year, estimated</span>
                </div>
                <div>
                  <span className="value">{data.criteriaEvaluated}</span>
                  <span className="label">criteria evaluated</span>
                </div>
                <div>
                  <span className="value">{duration(engineMsTotal)}</span>
                  <span className="label">
                    engine time, {passCount} {passCount === 1 ? 'pass' : 'passes'}
                  </span>
                </div>
                <div>
                  <span className="value">{replies.length}</span>
                  <span className="label">questions asked</span>
                </div>
              </div>

              {ranked.map((v) => (
                <article className={`card${v.eligible ? ' eligible' : ''}`} key={v.programId}>
                  <div className="card-head">
                    <div>
                      <div className="card-name">{v.name}</div>
                      <div className="card-verdict">
                        {v.eligible ? 'Likely eligible' : 'Likely not eligible'}
                      </div>
                    </div>
                    {v.eligible && v.annualValue !== null && (
                      <div className="card-value">about {money(v.annualValue)}/year</div>
                    )}
                  </div>
                  <div className="card-detail">Decided by {v.decidingCriterion}.</div>
                  {v.notes.map((n, i) => (
                    <div className="card-detail" key={i}>
                      {n}
                    </div>
                  ))}
                  <a className="apply" href={v.applyUrl} target="_blank" rel="noreferrer">
                    Apply at the official {v.shortName} page →
                  </a>
                  {v.steps.length > 0 && (
                    <details>
                      <summary>Show the arithmetic</summary>
                      <ul className="steps">
                        {v.steps.map((s, i) => (
                          <li key={i}>
                            <span>
                              {s.label}
                              <br />
                              <span className="cite">
                                {s.detail}
                                {s.citation ? ` · ${s.citation}` : ''}
                              </span>
                            </span>
                            <span className="amt">
                              {s.amount < 0 ? '−' : ''}
                              {money(Math.abs(s.amount))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {v.tests.length > 0 && (
                    <details>
                      <summary>Show the tests</summary>
                      <ul className="steps">
                        {v.tests.map((t, i) => (
                          <li key={i}>
                            <span>
                              {t.name}
                              <br />
                              <span className="cite">{t.detail}</span>
                            </span>
                            <span className="amt">{t.passed ? 'passed' : 'failed'}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </article>
              ))}

              {replies.length > 0 && (
                <details open>
                  <summary>What was asked, and why</summary>
                  <ul className="steps">
                    {replies.map((r) => (
                      <li key={r.instanceId}>
                        <span>
                          {r.question}
                          <br />
                          <span className="cite">{r.reply}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="row">
                <button className="secondary" onClick={reset}>
                  Start over
                </button>
              </div>
            </>
          )}

          <details open={phase !== 'results'}>
            <summary>
              Every criterion, with what the engine made of it
              {phase === 'asking' && ' — settled rows dimmed'}
            </summary>
            <div style={{ marginTop: 14 }}>
              <CriteriaGrid
                key={passCount}
                criteria={data.criteria}
                dimSettled={phase === 'asking'}
              />
            </div>
          </details>
        </>
      )}
    </>
  );
}
