import Link from 'next/link';

import { Wordmark } from './Logo';

export function Masthead({ cta = true }: { cta?: boolean }) {
  return (
    <header className="masthead">
      <div className="masthead-inner">
        <Link href="/" className="wordmark">
          <Wordmark />
        </Link>
        <nav className="nav">
          <Link href="/#how" className="hide-sm">
            How it works
          </Link>
          <Link href="/#why" className="hide-sm">
            Why BennyFit
          </Link>
          <Link href="/results" className="hide-sm">
            Results
          </Link>
          <Link href="/#faq" className="hide-sm">
            FAQ
          </Link>
          {cta && (
            <Link href="/demo" className="btn mint">
              Try the demo
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-grid">
          <div>
            <Link href="/" className="wordmark">
              <Wordmark size={26} />
            </Link>
            <p className="legal">
              BennyFit produces screening estimates from published federal and state program
              rules. It is not an eligibility determination and it is not affiliated with any
              government agency. Local agencies can apply limits more generous than those used
              here.
            </p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <span className="h">Product</span>
              <Link href="/demo">Demo</Link>
              <Link href="/compare">Compare</Link>
              <Link href="/results">Results</Link>
            </div>
            <div className="footer-col">
              <span className="h">Learn</span>
              <Link href="/#how">How it works</Link>
              <Link href="/#why">Why BennyFit</Link>
              <Link href="/#faq">FAQ</Link>
            </div>
            <div className="footer-col">
              <span className="h">Programs</span>
              <a href="https://www.fna.usda.gov/snap/state-directory" target="_blank" rel="noreferrer">
                SNAP
              </a>
              <a
                href="https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit"
                target="_blank"
                rel="noreferrer"
              >
                EITC
              </a>
              <a href="https://www.usac.org/lifeline/" target="_blank" rel="noreferrer">
                Lifeline
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
