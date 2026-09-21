/**
 * Reading numbers out of a household description.
 *
 * This is code, not a model. The engine is never asked to do arithmetic or to read a
 * figure off a page: it is asked whether the narrative supports a factual predicate.
 * Everything numeric is extracted here, converted here, and presented to the engine as
 * an already-computed figure.
 *
 * When a figure cannot be found the parser says so rather than guessing, and the
 * caller asks for it directly. A missing household size is a question for a form
 * field, not for a decision model.
 */

export type Period = 'weekly' | 'biweekly' | 'monthly' | 'annual';

export interface ParsedFacts {
  /** The state whose rules apply, when the description names one. */
  state: string | null;
  householdSize: number | null;
  /** As written, before any period conversion. */
  incomeAmount: number | null;
  incomePeriod: Period | null;
  rentMonthly: number | null;
  utilitiesMonthly: number | null;
  dependentCareMonthly: number | null;
  childSupportMonthly: number | null;
  medicalMonthly: number | null;
  savings: number | null;
  ages: number[];
  childrenCount: number | null;
  mentionsPrograms: string[];
}

export interface ParseResult {
  facts: ParsedFacts;
  /** Fields the description did not settle, which must be asked before screening. */
  missing: ('householdSize' | 'income')[];
  notes: string[];
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  a: 1, an: 1, alone: 1,
};

function money(text: string): number | null {
  const cleaned = text.replace(/,/g, '');
  const m =
    cleaned.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(k\b)?/i) ??
    cleaned.match(/^\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(k\b)?/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  return m[2] ? value * 1000 : value;
}

/**
 * Every money amount in the text, with the clause it appears in.
 *
 * Classifying by a fixed window of surrounding characters does not work: in "I get
 * about $1,150 a month. Rent is $700" the word "rent" sits well inside any window wide
 * enough to catch "get about", and the income gets filed as a housing cost. Splitting
 * on clause boundaries first keeps each amount with the words that actually describe
 * it.
 */
function moneyMentions(
  text: string
): { amount: number; context: string; sentence: string; index: number }[] {
  const out: { amount: number; context: string; sentence: string; index: number }[] = [];

  // Clause boundaries: sentence punctuation, semicolons, a comma that is not a
  // thousands separator, and a conjunction joining two independent statements.
  const boundary = /[.;]|(?<![0-9]),(?![0-9])|\s+\band\b\s+(?=(?:i|we|my|the|rent|it)\b)/gi;
  let cursor = 0;
  const clauses: { text: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = boundary.exec(text)) !== null) {
    clauses.push({ text: text.slice(cursor, m.index), start: cursor });
    cursor = m.index + m[0].length;
  }
  clauses.push({ text: text.slice(cursor), start: cursor });

  // A dollar sign, a figure followed by "dollars" or "bucks", or a bare figure of three
  // or more digits placed where only money goes: "pay 850 for rent", "rent is 900",
  // "2400 a month". A bare figure anywhere else is left alone, because it is as likely
  // to be a year, a street number or a zip code.
  const PERIOD_AFTER = '\\s*(?:a|per|each|every)\\s+(?:month|week|year)|\\s*(?:monthly|weekly|annually)\\b|\\s+(?:for|in|on)\\s+(?:rent|the\\s+rent|mortgage)\\b';
  const re = new RegExp(
    '\\$\\s*[0-9][0-9,]*(?:\\.[0-9]{1,2})?\\s*(?:k\\b)?' +
      '|\\b[0-9][0-9,]*(?:\\.[0-9]{1,2})?(?=\\s*(?:dollars|bucks)\\b)' +
      `|(?<=\\b(?:rent|mortgage)\\s*(?:is|of|:)?\\s*)[0-9][0-9,]{2,}\\b(?!\\s*(?:%|people|persons|years?|kids?|children))` +
      `|(?<![$0-9,.])\\b[0-9]{1,3}(?:,[0-9]{3})+(?=${PERIOD_AFTER})|(?<![$0-9,.])\\b[0-9]{3,6}(?=${PERIOD_AFTER})`,
    'gi'
  );
  for (const clause of clauses) {
    // Where a clause holds more than one amount, each is described by the words between
    // it and its neighbours rather than by the whole clause. In "I make $1,750 monthly
    // in Idaho and pay $900 in rent" the word "rent" belongs to the second amount only;
    // reading it against the whole clause filed both as rent and lost the income.
    const hits: RegExpExecArray[] = [];
    re.lastIndex = 0;
    let h: RegExpExecArray | null;
    while ((h = re.exec(clause.text)) !== null) hits.push(h);

    for (let k = 0; k < hits.length; k++) {
      const hit = hits[k];
      const amount = money(hit[0]);
      if (amount === null) continue;
      // The words between two amounts are shared unless a conjunction divides them:
      // in "pay 1200 for rent and earn 3000 a month", "for rent" describes the first
      // amount and "earn" the second.
      const split = (left: number, right: number) => {
        const gap = clause.text.slice(left, right);
        const conj = [...gap.matchAll(/\s(?:and|but|while|plus)\s/gi)].pop();
        return conj ? { end: left + conj.index!, start: left + conj.index! } : { end: right, start: left };
      };
      const from = k === 0 ? 0 : split(hits[k - 1].index + hits[k - 1][0].length, hit.index).start;
      const to = k === hits.length - 1 ? clause.text.length : split(hit.index + hit[0].length, hits[k + 1].index).end;
      const local = clause.text.slice(from, to);
      const at = clause.start + hit.index;
      const sentenceStart = Math.max(text.lastIndexOf('.', at - 1), text.lastIndexOf('!', at - 1), text.lastIndexOf('?', at - 1)) + 1;
      const endCandidates = ['.', '!', '?'].map((c) => text.indexOf(c, at)).filter((i) => i !== -1);
      const sentenceEnd = endCandidates.length > 0 ? Math.min(...endCandidates) : text.length;
      out.push({
        amount,
        context: local.toLowerCase(),
        sentence: text.slice(sentenceStart, sentenceEnd).toLowerCase(),
        index: at,
      });
    }
  }
  return out;
}

function periodNear(context: string): Period | null {
  // Biweekly before weekly: "every other week" contains "every week" once "other" is
  // skipped, and a pay period of every two weeks read as weekly overstates income by half.
  if (/every\s*(two|2)\s*weeks|\bbi-?weekly\b|every other (week|mon|tue|wed|thu|fri|sat|sun)|fortnight/.test(context)) return 'biweekly';
  if (/\b(a|per|each|every)\s*week\b|\bweekly\b/.test(context)) return 'weekly';
  if (/every\s*(two|2)\s*weeks|\bbi-?weekly\b|every other (week|mon|tue|wed|thu|fri|sat|sun)|fortnight/.test(context)) return 'biweekly';
  if (/twice a month|twice monthly|semi-?monthly|1st and (the )?15th/.test(context)) return 'monthly';
  if (/\b(a|per|each|every)\s*month\b|\bmonthly\b|\/mo\b|a month/.test(context)) return 'monthly';
  if (/\b(a|per|each)\s*year\b|\bannually\b|\bannual\b|\/yr\b|a year/.test(context)) return 'annual';
  return null;
}

export function toMonthly(amount: number, period: Period): number {
  switch (period) {
    case 'weekly':
      // 52 weeks over 12 months, not 4 weeks, which would understate by 8%.
      return (amount * 52) / 12;
    case 'biweekly':
      return (amount * 26) / 12;
    case 'monthly':
      return amount;
    case 'annual':
      return amount / 12;
  }
}

const STATES: Record<string, string> = {
  al: 'Alabama', ak: 'Alaska', az: 'Arizona', ar: 'Arkansas', ca: 'California',
  co: 'Colorado', ct: 'Connecticut', de: 'Delaware', dc: 'District of Columbia',
  fl: 'Florida', ga: 'Georgia', hi: 'Hawaii', id: 'Idaho', il: 'Illinois',
  ind: 'Indiana', ia: 'Iowa', ks: 'Kansas', ky: 'Kentucky', la: 'Louisiana',
  me: 'Maine', md: 'Maryland', ma: 'Massachusetts', mi: 'Michigan', mn: 'Minnesota',
  ms: 'Mississippi', mo: 'Missouri', mt: 'Montana', ne: 'Nebraska', nv: 'Nevada',
  nh: 'New Hampshire', nj: 'New Jersey', nm: 'New Mexico', ny: 'New York',
  nc: 'North Carolina', nd: 'North Dakota', oh: 'Ohio', ok: 'Oklahoma', or: 'Oregon',
  pa: 'Pennsylvania', ri: 'Rhode Island', sc: 'South Carolina', sd: 'South Dakota',
  tn: 'Tennessee', tx: 'Texas', ut: 'Utah', vt: 'Vermont', va: 'Virginia',
  wa: 'Washington', wv: 'West Virginia', wi: 'Wisconsin', wy: 'Wyoming',
};

const STATE_NAMES = [...new Set(Object.values(STATES))];

/**
 * The state the household lives in, which decides several of the rules.
 *
 * Full names are matched first, because "Washington" is a state and "DC" is not part
 * of it, and because an abbreviation like "in" or "or" would otherwise match ordinary
 * words. Abbreviations are only accepted in the shapes people actually write them:
 * after a comma, or in capitals.
 */
export function detectState(text: string): string | null {
  // Longest first, so "West Virginia" is not read as "Virginia".
  for (const name of [...STATE_NAMES].sort((a, b) => b.length - a.length)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text)) return name;
  }
  const abbreviation = text.match(/,\s*([A-Z]{2})\b|\bin\s+([A-Z]{2})\b/);
  if (abbreviation) {
    const code = (abbreviation[1] ?? abbreviation[2]).toLowerCase();
    if (STATES[code]) return STATES[code];
  }
  return null;
}

const PROGRAM_PATTERNS: [string, RegExp][] = [
  ['snap', /\bsnap\b|food stamps|\bebt\b/i],
  ['medicaid', /\bmedicaid\b/i],
  ['ssi', /\bssi\b|supplemental security income/i],
  ['ssdi', /\bssdi\b|social security disability/i],
  ['social_security', /social security(?!\s*(disability|number))/i],
  ['tanf', /\btanf\b|welfare|cash assistance/i],
  ['fpha', /section 8|public housing|housing voucher/i],
  ['veterans_pension', /veterans? pension|survivors? pension|va pension/i],
  ['unemployment', /unemployment/i],
  ['lifeline', /\blifeline\b/i],
];

export function parseHousehold(paragraph: string): ParseResult {
  const text = paragraph.replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  const notes: string[] = [];

  // --- ages -------------------------------------------------------------
  const ages: number[] = [];
  for (const m of text.matchAll(/\b(?:i'?m|i am|aged?|age)\s*(\d{1,3})\b/gi)) {
    ages.push(parseInt(m[1], 10));
  }
  for (const m of text.matchAll(/\b(\d{1,3})\s*(?:years? old|yo\b|y\/o)/gi)) {
    ages.push(parseInt(m[1], 10));
  }
  // "aged 4 and 8", "ages 3, 5 and 11" — a single phrase carrying several ages, which
  // the singular patterns above read only the first of.
  for (const m of text.matchAll(/\bages?d?\s+((?:\d{1,2}\s*(?:,|and|&)\s*)+\d{1,2})\b/gi)) {
    for (const n of m[1].split(/\s*(?:,|and|&)\s*/)) {
      const age = parseInt(n, 10);
      if (Number.isFinite(age)) ages.push(age);
    }
  }

  // --- children ---------------------------------------------------------
  let childrenCount: number | null = null;
  const CHILD_NOUN =
    '(?:kids?|children|child|sons?|daughters?|boys?|girls?|babies|baby|newborns?|infants?|toddlers?|grand(?:kids?|children|sons?|daughters?)|little ones)';
  const childMatch =
    text.match(new RegExp(`\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s+(?:younger\\s+|little\\s+|small\\s+)?${CHILD_NOUN}\\b`, 'i')) ??
    text.match(new RegExp(`\\b(?:my|our|a|her|his|their)\\s+(${CHILD_NOUN})\\b`, 'i'));
  if (childMatch) {
    const token = childMatch[1].toLowerCase();
    childrenCount = /^\d+$/.test(token) ? parseInt(token, 10) : (NUMBER_WORDS[token] ?? 1);
  }
  // "Single mom of one", "a dad of three": the count follows the parent.
  const parentOf = text.match(/\b(?:mom|mother|mum|dad|father|parent)\s+of\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
  if (parentOf && childrenCount === null) {
    const token = parentOf[1].toLowerCase();
    childrenCount = /^\d+$/.test(token) ? parseInt(token, 10) : NUMBER_WORDS[token];
  }
  // Twins are two children and triplets three, however they are described.
  if (/\btwins\b|\btwin\s+(?:boys|girls|sons|daughters|babies)\b/i.test(text)) childrenCount = 2;
  if (/\btriplets\b/i.test(text)) childrenCount = 3;
  if (/\bno (kids|children)\b|\bchildless\b/i.test(text)) childrenCount = 0;

  // --- household size ---------------------------------------------------
  //
  // In order of how directly the description says it. An explicit count always wins:
  // the inference at the bottom exists for descriptions that never state a size, and
  // it must never overrule one that does. "Our household is 7 people ... my husband
  // earns" used to come back as two, because only "household of N" was recognised and
  // everything else fell through to counting a partner.
  let householdSize: number | null = null;
  const NUM = '(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)';
  const toNumber = (token: string) =>
    /^\d+$/.test(token) ? parseInt(token, 10) : NUMBER_WORDS[token.toLowerCase()];

  const EXPLICIT = [
    new RegExp(`\\b(?:household|family|home)\\s+(?:of|is|has)\\s+${NUM}(?:\\s+(?:people|persons|members))?\\b`, 'i'),
    new RegExp(`\\b${NUM}[\\s-]+(?:person|people|member)s?\\s+(?:household|family|home)\\b`, 'i'),
    new RegExp(`\\b${NUM}\\s+(?:people|persons)\\s+(?:total|altogether|live|living|in\\s+(?:our|my|the|this))\\b`, 'i'),
    new RegExp(`\\bwe(?:'re|\\s+are)\\s+(?:a\\s+family\\s+of\\s+)?${NUM}\\b(?!\\s*(?:years?|months?|kids?|children|adults?))`, 'i'),
    new RegExp(`\\b${NUM}\\s+of\\s+us\\b`, 'i'),
    new RegExp(`\\bhousehold\\s+size\\s+(?:is\\s+|of\\s+)?${NUM}\\b`, 'i'),
  ];
  const explicit = EXPLICIT.map((re) => text.match(re)).find((m) => m !== null);

  const hasPartner =
    /\bmy\s+(wife|husband|partner|spouse|girlfriend|boyfriend|fianc[eé]e?)\b|\bwe\s+are\s+married\b|\bwe\s+both\b|\bboth\s+of\s+us\b/i.test(
      text
    );

  // Adults other than a partner who are named as part of the household: "me, my
  // mother, and my three kids" is five people, not four. Each relation counts once;
  // "my parents" counts two.
  // A possessive covers the whole list after it: "my niece and nephew" is two.
  const RELATION =
    '(?:elderly\\s+|aging\\s+|older\\s+|younger\\s+|little\\s+)?(?:mother-in-law|father-in-law|mother|mom|mum|father|dad|parents|grandmother|grandma|grandfather|grandpa|sister|brother|aunt|uncle|cousin|niece|nephew|roommate)';
  const RELATIVES = new RegExp(
    `\\b(?:my|our)\\s+${RELATION}(?:\\s*(?:,|and|&)\\s*(?:my\\s+|our\\s+)?${RELATION})*\\b`,
    'gi'
  );
  const relations = new Set(
    [...text.matchAll(RELATIVES)].flatMap((m) =>
      [...m[0].matchAll(new RegExp(RELATION, 'gi'))].map((r) => r[0].toLowerCase().split(/\s+/).pop()!)
    )
  );
  const relativeCount = [...relations].reduce((n, r) => n + (r === 'parents' ? 2 : 1), 0);

  const ADULTS = new RegExp(`\\b${NUM}\\s+(?:adults?|parents|grown-?ups)\\b`, 'i');

  if (explicit) {
    householdSize = toNumber(explicit[1]);
  } else if (
    /\b(?:live|living|lives)\s+alone\b|\bby\s+myself\b|\bon\s+my\s+own\b|\bjust\s+(?:me|myself)\b|\bit'?s\s+only\s+me\b/i.test(
      text
    ) &&
    !childrenCount &&
    !hasPartner &&
    relativeCount === 0
  ) {
    // "On my own" also describes a single parent, so it only means a household of one
    // when nobody else is mentioned.
    householdSize = 1;
  } else if (ADULTS.test(text)) {
    // "Two adults, one kid" — count the adults, and add any children found.
    const adults = toNumber(text.match(ADULTS)![1]);
    householdSize = adults + (childrenCount ?? 0);
  } else if (/\b(?:married|retired|elderly|older)\s+couple\b|\bcouple\b/i.test(text)) {
    householdSize = 2 + (childrenCount ?? 0);
  } else if (hasPartner || childrenCount !== null || relativeCount > 0) {
    // Nothing stated outright: one adult, a partner if one appears, any other relatives
    // named, and any children.
    const children = childrenCount ?? 0;
    householdSize = 1 + (hasPartner ? 1 : 0) + relativeCount + children;
    const parts: string[] = [];
    if (hasPartner) parts.push('a partner');
    if (relativeCount > 0) parts.push([...relations].join(', '));
    if (children > 0) parts.push(`${children} ${children === 1 ? 'child' : 'children'}`);
    notes.push(
      `Household size of ${householdSize} inferred from ${parts.join(' and ')} plus the ` +
        'person describing the household, because the description did not state it.'
    );
  }

  // --- money ------------------------------------------------------------
  const mentions = moneyMentions(text);
  let incomeAmount: number | null = null;
  let incomePeriod: Period | null = null;
  let rentMonthly: number | null = null;
  let utilitiesMonthly: number | null = null;
  let dependentCareMonthly: number | null = null;
  let childSupportMonthly: number | null = null;
  let medicalMonthly: number | null = null;
  let savings: number | null = null;

  for (const mention of mentions) {
    const c = mention.context;
    // "I get paid every other Friday, usually around $780" states the period in one
    // clause and the amount in the next. The clause decides when it can; the sentence
    // is the fallback, so a period two clauses away is not borrowed from an unrelated
    // statement.
    const period = periodNear(c) ?? periodNear(mention.sentence);
    const monthly = period ? toMonthly(mention.amount, period) : mention.amount;

    if (/rent|mortgage|housing/.test(c)) {
      rentMonthly = monthly;
    } else if (/utilit|electric|gas|heating|heat and/.test(c)) {
      utilitiesMonthly = monthly;
    } else if (/day ?care|child ?care|babysit/.test(c)) {
      dependentCareMonthly = monthly;
    } else if (/child support/.test(c)) {
      childSupportMonthly = monthly;
    } else if (/medical|prescription|medication|doctor|insulin/.test(c)) {
      medicalMonthly = monthly;
    } else if (/savings|saved|in the bank|account|inheritance/.test(c)) {
      savings = mention.amount;
    } else if (/make|earn|income|paid|pay ?check|get about|bring|wage|salary|receive|check/.test(c)) {
      if (incomeAmount === null) {
        incomeAmount = mention.amount;
        incomePeriod = period;
      }
    } else if (incomeAmount === null) {
      incomeAmount = mention.amount;
      incomePeriod = period;
    }
  }

  if (incomeAmount !== null && incomePeriod === null) {
    notes.push(
      `An income of $${incomeAmount.toLocaleString('en-US')} was found with no period stated.`
    );
  }

  const mentionsPrograms = PROGRAM_PATTERNS.filter(([, re]) => re.test(text)).map(([id]) => id);

  const missing: ParseResult['missing'] = [];
  if (householdSize === null) missing.push('householdSize');
  if (incomeAmount === null && !/\bno income\b|\bnothing coming in\b/i.test(lower)) {
    missing.push('income');
  }

  return {
    facts: {
      state: detectState(text),
      householdSize,
      incomeAmount,
      incomePeriod,
      rentMonthly,
      utilitiesMonthly,
      dependentCareMonthly,
      childSupportMonthly,
      medicalMonthly,
      savings,
      ages: [...new Set(ages)].sort((a, b) => a - b),
      childrenCount,
      mentionsPrograms,
    },
    missing,
    notes,
  };
}
