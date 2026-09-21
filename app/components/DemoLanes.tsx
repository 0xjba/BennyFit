'use client';

import { useState } from 'react';

import type { LaneResult } from '@/app/api/baseline/route';
import type { ScreenResponse } from '@/app/api/screen/route';

const HOUSEHOLD =
  "I'm 62, live alone in Ohio, and get about $1,150 a month. Rent is $700 and I pay my own gas and electric.";

function duration(ms: number): string {
  if (ms < 1) return `${ms.toFixed(2)}ms`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export function DemoLanes() {
  const [paragraph, setParagraph] = useState(HOUSEHOLD);
  const [running, setRunning] = useState(false);
  const [readout, setReadout] = useState<ScreenResponse | null>(null);
  const [lanes, setLanes] = useState<LaneResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setReadout(null);
    setLanes(null);

    // Both lanes get the identical household and the identical criteria. The only
    // thing that differs between lane A and lane B is how the answer is obtained.
    const [readoutResponse, baselineResponse] = await Promise.allSettled([
      fetch('/api/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paragraph, replies: [] }),
      }).then((r) => r.json()),
      fetch('/api/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paragraph }),
      }).then((r) => r.json()),
    ]);

    if (readoutResponse.status === 'fulfilled' && !readoutResponse.value.error) {
      setReadout(readoutResponse.value as ScreenResponse);
    } else {
      setError('The readout lane did not complete.');
    }
    if (baselineResponse.status === 'fulfilled' && baselineResponse.value.lanes) {
      setLanes(baselineResponse.value.lanes as LaneResult[]);
    }
    setRunning(false);
  };

  return (
    <div>
      <textarea
        value={paragraph}
        onChange={(e) => setParagraph(e.target.value)}
        aria-label="Household description"
      />
      <div className="row">
        <button onClick={run} disabled={running || paragraph.trim().length === 0}>
          {running ? 'Running all three lanes…' : 'Run all three lanes on this household'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="lanes">
        <section className="lane">
          <header>
            <h3>Typed readout</h3>
            <p className="lane-sub">
              {readout ? readout.engine : 'the engine'} · one batched pass, no text generated
            </p>
          </header>
          <div className="lane-body">
            {!readout && <p className="lane-note">Not run yet.</p>}
            {readout && (
              <>
                <dl className="lane-stats">
                  <div>
                    <dt>criteria resolved</dt>
                    <dd>
                      {readout.criteriaEvaluated} of {readout.criteriaEvaluated}
                    </dd>
                  </div>
                  <div>
                    <dt>wall clock</dt>
                    <dd>{duration(readout.engineElapsedMs)}</dd>
                  </div>
                  <div>
                    <dt>structurally invalid answers</dt>
                    <dd>0</dd>
                  </div>
                  <div>
                    <dt>flagged as unsettled</dt>
                    <dd>{readout.lowConfidenceCount}</dd>
                  </div>
                </dl>
                <p className="lane-note">
                  An answer is a distribution over the options the criterion itself
                  supplies, so it cannot be an option belonging to a different criterion.
                  That is not a validation step that passed; it is a shape that has no way
                  to express the error.
                </p>
                {readout.next && (
                  <div className="lane-highlight">
                    <strong>Asked one question:</strong> {readout.next.question}
                    <div className="lane-sub">
                      {readout.next.reason} · worth {money(readout.next.voiSpread)} across the
                      three programmes
                    </div>
                  </div>
                )}
                {readout.isFixture && (
                  <p className="lane-note fixture-note">
                    Answers come from the local fixture, not a model. The timing is real;
                    it is the timing of a keyword matcher.
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {(lanes ?? []).map((lane) => (
          <section className="lane" key={lane.lane}>
            <header>
              <h3>{lane.lane === 'sameModel' ? 'Same model, generating' : 'General-purpose model, generating'}</h3>
              <p className="lane-sub">{lane.model} · asked to write JSON verdicts</p>
            </header>
            <div className="lane-body">
              {!lane.ran && <p className="lane-note">{lane.reason}</p>}
              {lane.ran && (
                <>
                  <dl className="lane-stats">
                    <div>
                      <dt>criteria resolved</dt>
                      <dd>
                        {lane.usable} of {lane.criteriaAsked}
                      </dd>
                    </div>
                    <div>
                      <dt>wall clock</dt>
                      <dd>{duration(lane.elapsedMs ?? 0)}</dd>
                    </div>
                    <div>
                      <dt>answers belonging to another criterion</dt>
                      <dd>{lane.faults?.crossWired ?? 0}</dd>
                    </div>
                    <div>
                      <dt>invented or missing</dt>
                      <dd>{(lane.faults?.invented ?? 0) + (lane.faults?.missing ?? 0)}</dd>
                    </div>
                  </dl>
                  {(lane.examples?.length ?? 0) > 0 && (
                    <ul className="fault-list">
                      {lane.examples!.map((e) => (
                        <li key={e.criterionId}>
                          <code>{e.criterionId}</code>{' '}
                          {e.fault === 'crossWired' ? (
                            <>
                              answered with an option belonging to <code>{e.borrowedFrom}</code>
                            </>
                          ) : e.fault === 'invented' ? (
                            'answered with an option no criterion offers'
                          ) : (
                            'left unanswered'
                          )}
                          {e.selfReportedConfidence !== null && (
                            <span className="lane-sub">
                              {' '}
                              (it reported {Math.round(e.selfReportedConfidence * 100)}%
                              confidence in that answer)
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {lane.parsed === false && (
                    <p className="lane-note">The response was not JSON at all.</p>
                  )}
                </>
              )}
            </div>
          </section>
        ))}

        {!lanes && !running && (
          <section className="lane">
            <header>
              <h3>Generation lanes</h3>
              <p className="lane-sub">not run yet</p>
            </header>
            <div className="lane-body">
              <p className="lane-note">
                Two lanes run the identical household and identical criteria through a model
                asked to write JSON. One holds the model fixed and changes only the readout
                method; the other changes the model as well, so &ldquo;a better model would not
                do that&rdquo; can be answered rather than argued.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
