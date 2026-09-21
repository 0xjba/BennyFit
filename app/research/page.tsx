import Link from 'next/link';

import { PaperReader } from '@/app/components/PaperReader';
import { Masthead, SiteFooter } from '@/app/components/SiteChrome';
import { AUTHOR } from '@/lib/author';
import data from '@/research/data.json';
import reader from '@/public/research/pages.json';

export const metadata = {
  title: 'Research | BennyFit',
  description:
    'The technical report behind BennyFit: how it screens households for 21 benefit programs with a typed-readout model, and how it compares with a general-purpose model doing the same job.',
};

const J = data.endToEnd.jevCompared;
const B = data.endToEnd.sonnet;
const F = data.endToEnd.jevFinal;
const six = data.reading.editions.filter((e) => e.edition === 6);
const codeSix = six.find((e) => e.reader === 'code')!;
const jevSix = six.find((e) => e.reader === 'code+jev')!;
const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

function Icon({ name }: { name: 'github' | 'linkedin' | 'mail' }) {
  const paths = {
    github:
      'M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z',
    linkedin:
      'M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z',
    mail: 'M2 5.5A2.5 2.5 0 0 1 4.5 3h15A2.5 2.5 0 0 1 22 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18.5v-13Zm2.3-.5 7.7 6.16L19.7 5H4.3ZM20 6.9l-7.38 5.9a1 1 0 0 1-1.24 0L4 6.9v11.6c0 .28.22.5.5.5h15a.5.5 0 0 0 .5-.5V6.9Z',
  };
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
      <path d={paths[name]} />
    </svg>
  );
}

export default function Research() {
  const links = [
    { href: AUTHOR.github, label: 'GitHub', icon: 'github' as const },
    ...(AUTHOR.linkedin ? [{ href: AUTHOR.linkedin, label: 'LinkedIn', icon: 'linkedin' as const }] : []),
    { href: `mailto:${AUTHOR.email}`, label: AUTHOR.email, icon: 'mail' as const },
  ];

  return (
    <>
      <Masthead />

      {/* ---------------- who ---------------- */}
      <section className="band tight author">
        <div className="shell-narrow">
          <span className="eyebrow">Research</span>
          <h1 className="author-name">
            I&rsquo;m {AUTHOR.name}.
          </h1>
          {AUTHOR.bio && <p className="lede author-lede">{AUTHOR.bio}</p>}
          {AUTHOR.why && <p className="author-why">{AUTHOR.why}</p>}
          <div className="author-links">
            {links.map((l) => (
              <a key={l.label} href={l.href} className="social" target={l.icon === 'mail' ? undefined : '_blank'} rel="noreferrer" aria-label={l.label}>
                <Icon name={l.icon} />
                <span>{l.label}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- the numbers ---------------- */}
      <section className="band tight research-numbers">
        <div className="shell">
          <div className="band-head center">
            <span className="eyebrow">What the measurements say</span>
            <h2>
              The same answers, {data.endToEnd.ratios.speed.toFixed(1)}&times; faster and{' '}
              {Math.round(data.endToEnd.ratios.cost)}&times; cheaper.
            </h2>
            <p>
              BennyFit runs every eligibility judgement through Jev, TypeSafe&rsquo;s typed-readout
              model. We put Claude Sonnet 5 through the identical pipeline, on the same held-out
              households, and measured both.
            </p>
          </div>
          <div className="statrow">
            <div>
              <span className="n">{data.endToEnd.ratios.speed.toFixed(1)}&times;</span>
              <span className="k">
                faster to a full screening: {J.medianSeconds.toFixed(1)} s against{' '}
                {B.medianSeconds.toFixed(1)} s with Claude Sonnet 5
              </span>
            </div>
            <div>
              <span className="n">{Math.round(data.endToEnd.ratios.cost)}&times;</span>
              <span className="k">
                cheaper per household: ${J.costPerHouseholdUSD!.toFixed(5)} against $
                {B.costPerHouseholdUSD!.toFixed(3)}, as billed
              </span>
            </div>
            <div>
              <span className="n">{pct(J.specified.right / J.specified.total)}</span>
              <span className="k">
                of verdicts right on held-out households, against{' '}
                {pct(B.specified.right / B.specified.total)} for Claude Sonnet 5
              </span>
            </div>
            <div>
              <span className="n">{pct(jevSix.rate, 0)}</span>
              <span className="k">
                of facts read from fresh text with Jev choosing, against {pct(codeSix.rate, 0)} for
                code alone
              </span>
            </div>
          </div>
          <div className="statrow" style={{ marginTop: 44 }}>
            <div>
              <span className="n">{Math.round((1 - F.questionsTotal / J.questionsTotal) * 100)}%</span>
              <span className="k">
                fewer follow-up questions ({J.questionsTotal} to {F.questionsTotal}) once they are
                chosen by expected value
              </span>
            </div>
            <div>
              <span className="n">{J.medianCriteria}</span>
              <span className="k">eligibility checks answered for a household in one request</span>
            </div>
            <div>
              <span className="n">{data.setup.programs}</span>
              <span className="k">programs, with state rules across {data.setup.jurisdictions} jurisdictions</span>
            </div>
            <div>
              <span className="n">
                {data.setup.conformance.passed}/{data.setup.conformance.total}
              </span>
              <span className="k">hand-computed rule cases that match their federal sources</span>
            </div>
          </div>

          <div className="card-grid c3" style={{ marginTop: 64 }}>
            <div className="tile">
              <h3>One pass, every rule</h3>
              <p>
                Jev answers all of a household&rsquo;s checks in a single request, each as a
                probability over a fixed set of options. A general-purpose model writing the same
                answers had to be split into batches to stay within its schema limits.
              </p>
            </div>
            <div className="tile">
              <h3>Probabilities, not prose</h3>
              <p>
                Every answer arrives as a distribution, so BennyFit can tell a settled fact from an
                open one and ask only where the expected change in benefits is worth a
                person&rsquo;s time.
              </p>
            </div>
            <div className="tile">
              <h3>Numbers stay in code</h3>
              <p>
                Jev never writes a figure. Code finds every amount, Jev says what each one is, and
                code does the arithmetic, so an amount cannot be invented or mistyped.
              </p>
            </div>
          </div>
          <p className="disclaimer" style={{ marginTop: 30, textAlign: 'center' }}>
            Measured on {J.households} synthetic held-out households, {J.programs} programs each.
            The accuracy difference is not statistically significant, and on households missing a
            deciding fact the general-purpose model did better; the report below covers both,
            with the method and every limitation. <Link href="/results">Results</Link>
          </p>
        </div>
      </section>

      {/* ---------------- the report ---------------- */}
      <section className="band tight" id="report">
        <div className="shell">
          <div className="band-head center">
            <span className="eyebrow">Technical report</span>
            <h2>Screening households for U.S. benefit programs from a short description</h2>
            <p>
              A typed-readout decision model compared with schema-constrained generation.{' '}
              {AUTHOR.name}, September 2026. {reader.pages.length} pages.
            </p>
          </div>
          <PaperReader pages={reader.pages} pdf={reader.pdf} />
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
