/**
 * A stack of application forms.
 *
 * The point the hero has to land is weight, and "three applications, 32 questions" does
 * not carry any. A dozen sheets of paper does. The sheets fan out on load and settle,
 * which is the only motion here — enough to read as a pile being dropped on a desk.
 *
 * The labels name the three real applications a household faces today, and the field
 * count matches the questions those forms actually ask.
 */

const SHEETS = 12;

/** An irregular sign pattern, so the fan does not alternate in a visible rhythm. */
const DRIFT = [1, -1, 1, 1, -1, -1, 1, -1];

export function PaperStack({ questions }: { questions: number }) {
  return (
    <figure className="paperstack" aria-label={`Three application forms containing ${questions} questions`}>
      <div className="paperstack-inner">
        {Array.from({ length: SHEETS }).map((_, i) => {
          const depth = SHEETS - 1 - i;
          return (
            <div
              className="sheet"
              key={i}
              style={
                {
                  '--i': depth,
                  // Alternating but not regularly, so the pile looks dropped rather
                  // than dealt. The top sheet sits square; everything under it drifts.
                  '--rot': `${DRIFT[depth % DRIFT.length] * (1.4 + depth * 0.78)}deg`,
                  '--dx': `${DRIFT[(depth + 2) % DRIFT.length] * (3 + depth * 3.1)}px`,
                  '--dy': `${depth * -4.4}px`,
                } as React.CSSProperties
              }
              aria-hidden="true"
            >
              <svg viewBox="0 0 220 280" preserveAspectRatio="none" focusable="false">
                <rect x="20" y="22" width="92" height="7" rx="3.5" className="ink-line" />
                <rect x="20" y="44" width="180" height="4" rx="2" />
                <rect x="20" y="56" width="150" height="4" rx="2" />
                <rect x="20" y="78" width="11" height="11" rx="2.5" className="box" />
                <rect x="40" y="81" width="120" height="4" rx="2" />
                <rect x="20" y="98" width="11" height="11" rx="2.5" className="box" />
                <rect x="40" y="101" width="146" height="4" rx="2" />
                <rect x="20" y="118" width="11" height="11" rx="2.5" className="box" />
                <rect x="40" y="121" width="96" height="4" rx="2" />
                <rect x="20" y="146" width="180" height="4" rx="2" />
                <rect x="20" y="158" width="128" height="4" rx="2" />
                <rect x="20" y="180" width="11" height="11" rx="2.5" className="box" />
                <rect x="40" y="183" width="140" height="4" rx="2" />
                <rect x="20" y="200" width="11" height="11" rx="2.5" className="box" />
                <rect x="40" y="203" width="104" height="4" rx="2" />
                <rect x="20" y="228" width="180" height="4" rx="2" />
                <rect x="20" y="240" width="72" height="4" rx="2" />
                <rect x="132" y="252" width="68" height="16" rx="8" className="sign" />
              </svg>
            </div>
          );
        })}

        <span className="sheet-tag tag-1">SNAP application</span>
        <span className="sheet-tag tag-2">EITC worksheet</span>
        <span className="sheet-tag tag-3">Lifeline form</span>
      </div>

      <figcaption>
        <strong>{questions} questions</strong> across three separate applications, most of
        them asking for the same facts again.
      </figcaption>
    </figure>
  );
}
