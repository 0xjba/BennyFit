/**
 * Named competitors, with sourced facts.
 *
 * Every claim about another product here is something they publish about themselves,
 * with the page it came from and the date it was read. Nothing is inferred, nothing is
 * estimated, and where a figure is their marketing claim rather than a measurement,
 * the row says so.
 *
 * The coverage row is deliberately unflattering to us. Two of these screen far more
 * programs than BennyFit does, and a comparison that hid that would be worthless to
 * anyone evaluating it seriously.
 *
 * Read 2026-09-21.
 */

export interface Competitor {
  id: string;
  name: string;
  what: string;
  href: string;
  source: string;
}

export const COMPETITORS: Competitor[] = [
  {
    id: 'singlestop',
    name: 'Single Stop',
    what: 'Benefits screener sold to colleges, credit unions and utilities',
    href: 'https://singlestop.org/screener-and-resources',
    source: 'singlestop.org',
  },
  {
    id: 'findhelp',
    name: 'findhelp',
    what: 'Social care network with a benefits eligibility check',
    href: 'https://company.findhelp.com/blog/2026/07/08/benefits-eligibility-check/',
    source: 'company.findhelp.com',
  },
  {
    id: 'mrelief',
    name: 'mRelief',
    what: 'Nonprofit SNAP screener, web and SMS',
    href: 'https://digitalgovernmenthub.org/publications/mrelief/',
    source: 'Digital Government Hub',
  },
];

export interface CompareRow {
  label: string;
  /** Keyed by competitor id, plus `bennyfit`. */
  cells: Record<string, { text: string; tone?: 'good' | 'weak' | 'plain' }>;
  footnote?: string;
}

export const COMPARE_ROWS: CompareRow[] = [
  {
    label: 'Programs screened',
    cells: {
      singlestop: { text: '20+', tone: 'good' },
      findhelp: { text: '10 core federal and state programs', tone: 'good' },
      mrelief: { text: 'SNAP only', tone: 'plain' },
      bennyfit: { text: '3, each against its complete federal rule set', tone: 'weak' },
    },
    footnote:
      'The one row where breadth is not ours. Two of these screen far more programs at a ' +
      'yes-or-no level. BennyFit goes the other way: three programs implemented in full, ' +
      'with the deductions, the thresholds and the arithmetic behind every figure.',
  },
  {
    label: 'Estimated dollar value for this household',
    cells: {
      singlestop: { text: 'Aggregate only — "$20K average annual support found"', tone: 'plain' },
      findhelp: { text: 'Population average — "$2,800 annually"', tone: 'plain' },
      mrelief: {
        text: 'None. States that amounts would add too many screening questions',
        tone: 'plain',
      },
      bennyfit: { text: 'Per household, per program, with the arithmetic shown', tone: 'good' },
    },
    footnote:
      'mRelief is explicit that it does not estimate amounts "due to the complexity it ' +
      'would add to the screening questions in order to have an accurate estimate". That ' +
      'is the trade BennyFit is built to avoid: the arithmetic happens in code from the ' +
      'official tables, so an amount costs no extra questions.',
  },
  {
    label: 'Questions asked',
    cells: {
      singlestop: { text: 'A questionnaire, about 15 minutes', tone: 'plain' },
      findhelp: { text: '"A few direct questions", 60–90 seconds', tone: 'good' },
      mrelief: { text: 'A short fixed set of yes/no and multiple choice', tone: 'good' },
      bennyfit: { text: 'None, unless one would change the answer. Never more than three', tone: 'good' },
    },
  },
  {
    label: 'Accuracy method published',
    cells: {
      singlestop: { text: '96% claimed; no method or validation set published', tone: 'plain' },
      findhelp: { text: 'No accuracy figure published', tone: 'plain' },
      mrelief: {
        text: 'No figure; states it deliberately skews toward over-inclusion',
        tone: 'plain',
      },
      bennyfit: { text: 'Both error directions reported, method and validation set published', tone: 'good' },
    },
    footnote:
      'mRelief says it "indexes towards being more inclusive on who may be eligible, so as ' +
      'to generate as few false negatives as possible" — a deliberate, reasonable choice ' +
      'that accepts false positives in exchange. BennyFit reports both rates separately so ' +
      'you can see which way it errs rather than having to assume.',
  },
  {
    label: 'Shows why it reached the answer',
    cells: {
      singlestop: { text: 'Referrals and an eligibility estimate', tone: 'plain' },
      findhelp: { text: 'Programs you may qualify for', tone: 'plain' },
      mrelief: { text: 'Likely qualify, and where to apply', tone: 'plain' },
      bennyfit: { text: 'The deciding rule, the deductions, and the regulation cited', tone: 'good' },
    },
  },
  {
    label: 'Programs that qualify each other',
    cells: {
      singlestop: { text: 'Not described', tone: 'plain' },
      findhelp: { text: 'Not described', tone: 'plain' },
      mrelief: { text: 'Single program', tone: 'plain' },
      bennyfit: { text: 'Followed automatically — SNAP enrollment qualifies Lifeline', tone: 'good' },
    },
  },
  {
    label: 'Coverage',
    cells: {
      singlestop: { text: 'Not stated on the screener page', tone: 'plain' },
      findhelp: { text: 'All 50 states and DC', tone: 'good' },
      mrelief: { text: 'All 53 states and territories', tone: 'good' },
      bennyfit: { text: 'Federal floor rules; state variation not yet modelled', tone: 'weak' },
    },
    footnote:
      'Another row where we are behind today. BennyFit applies federal minimum rules, and ' +
      '42 states and DC raise the SNAP income limit above that floor. Every result says so ' +
      'on screen rather than quietly under-screening.',
  },
];

/**
 * What happened to the largest staffed operator in this space.
 *
 * Relevant because it is the clearest evidence available that screening people one at a
 * time does not scale economically, and because two of the biggest drivers of SNAP
 * applications in Pennsylvania disappeared with it.
 */
export const BDT = {
  name: 'Benefits Data Trust',
  fact: 'shut down in August 2024 after twenty years, laying off all 273 employees',
  detail:
    'It had helped hundreds of thousands of people across seven states under contracts ' +
    'with state agencies and health insurers, and was one of the largest drivers of SNAP ' +
    'applications in Pennsylvania.',
  source: 'The Philadelphia Inquirer',
  href: 'https://www.inquirer.com/health/benefits-data-trust-closing-august-23-20240823.html',
};
