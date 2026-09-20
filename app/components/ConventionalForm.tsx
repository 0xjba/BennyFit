'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { ConventionalForm as Form } from '@/lib/conventional';

const PER_PAGE = 4;

function duration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

/**
 * The conventional path: one application per programme, paginated.
 *
 * The timer is real and the question count is real. What it does not do is claim to
 * be the whole burden: a genuine SNAP application also asks for documents, and the
 * survey figure of roughly five hours covers gathering those and two trips to an
 * office. This measures only the part the screener replaces, which is the answering.
 */
export function ConventionalForm({ forms }: { forms: Form[] }) {
  const [started, setStarted] = useState(false);
  const [formIndex, setFormIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  const total = useMemo(() => forms.reduce((s, f) => s + f.questions.length, 0), [forms]);
  const answered = Object.keys(answers).length;
  const form = forms[formIndex];
  const pages = Math.ceil(form.questions.length / PER_PAGE);
  const questions = form.questions.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const done = formIndex === forms.length - 1 && page === pages - 1 && answered >= total;

  useEffect(() => {
    if (!started || done) return;
    if (startedAt.current === 0) startedAt.current = performance.now();
    const timer = setInterval(() => setElapsed(performance.now() - startedAt.current), 100);
    return () => clearInterval(timer);
  }, [started, done]);

  if (!started) {
    return (
      <div className="lane-body">
        <p className="lane-note">
          Three programmes, three applications. {total} questions in total, asked one form
          at a time, the way they are today.
        </p>
        <button onClick={() => setStarted(true)}>Start the applications</button>
      </div>
    );
  }

  const next = () => {
    if (page < pages - 1) {
      setPage(page + 1);
    } else if (formIndex < forms.length - 1) {
      setFormIndex(formIndex + 1);
      setPage(0);
    }
  };

  const back = () => {
    if (page > 0) {
      setPage(page - 1);
    } else if (formIndex > 0) {
      setFormIndex(formIndex - 1);
      setPage(Math.ceil(forms[formIndex - 1].questions.length / PER_PAGE) - 1);
    }
  };

  return (
    <div className="lane-body">
      <div className="form-progress">
        <span>
          Application {formIndex + 1} of {forms.length}: <strong>{form.programName}</strong>
        </span>
        <span>
          page {page + 1} of {pages}
        </span>
      </div>
      <div className="form-progress">
        <span>
          {answered} of {total} questions answered
        </span>
        <span className="timer">{duration(elapsed)}</span>
      </div>

      {questions.map((q) => (
        <fieldset className="form-question" key={q.id}>
          <legend>{q.question}</legend>
          {q.alsoAskedBy.length > 0 && (
            <div className="repeat-flag">
              also asked on the {q.alsoAskedBy.join(' and ')} application
            </div>
          )}
          <div className="form-options">
            {q.options.map((o) => (
              <label key={o.value}>
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === o.value}
                  onChange={() => setAnswers({ ...answers, [q.id]: o.value })}
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="row">
        <button className="secondary" onClick={back} disabled={formIndex === 0 && page === 0}>
          Back
        </button>
        <button
          onClick={next}
          disabled={formIndex === forms.length - 1 && page === pages - 1}
        >
          Next
        </button>
      </div>

      {done && (
        <p className="lane-note">
          {total} questions answered in {duration(elapsed)}, and this is only the screening
          part. A real application also asks for documents.
        </p>
      )}
    </div>
  );
}
