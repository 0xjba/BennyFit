'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The other side of the hero: literally what a person types.
 *
 * Not a chat transcript and not a mock conversation — a plain block of text in a plain
 * box, typed out once so it reads as something a person did rather than something a
 * designer arranged. The result line appears after the text lands.
 *
 * Honours prefers-reduced-motion by showing the finished state immediately.
 */

/**
 * The household, and what BennyFit actually returns for it.
 *
 * The figures below are what the live screener produces for this exact text, not a
 * dressed-up example. If the rules change and the answer moves, this has to move too.
 */
const TEXT =
  'I work part time and make $430 a week. I have two kids aged 4 and 8, we live in Michigan, rent is $1,200 a month, and daycare costs $300.';

const CHIPS = [
  { k: 'Programs they qualify for', v: '10' },
  { k: 'A year, estimated', v: '$22,458' },
  { k: 'Questions asked', v: '1' },
];

export function TypedIntake() {
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      // Still not written synchronously in the effect body, which would cascade a
      // render on mount; one frame later is instant to a reader either way.
      const id = requestAnimationFrame(() => {
        setTyped(TEXT);
        setDone(true);
      });
      return () => cancelAnimationFrame(id);
    }

    let timer: ReturnType<typeof setInterval> | undefined;

    const begin = () => {
      if (started.current) return;
      started.current = true;
      let i = 0;
      timer = setInterval(() => {
        i += 1;
        setTyped(TEXT.slice(0, i));
        if (i >= TEXT.length) {
          clearInterval(timer);
          setTimeout(() => setDone(true), 350);
        }
      }, 26);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) begin();
      },
      { threshold: 0.35 }
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (timer) clearInterval(timer);
    };
  }, []);

  return (
    <figure className="intake" ref={ref}>
      <div className="intake-box">
        <span className="intake-label">Describe your household</span>
        <p className="intake-text">
          {typed}
          {!done && <span className="caret" aria-hidden="true" />}
        </p>
      </div>

      <div className={`intake-result${done ? ' in' : ''}`} aria-live="polite">
        {CHIPS.map((c) => (
          <div key={c.k}>
            <span className="v">{c.v}</span>
            <span className="k">{c.k}</span>
          </div>
        ))}
      </div>

      <figcaption>
        <strong>One paragraph.</strong> Every rule in all twenty-one programs checked against
        it at once, under Michigan&rsquo;s own limits, and one question asked because it was
        worth asking.
      </figcaption>
    </figure>
  );
}
