/**
 * Reading a household description with the decision engine choosing among candidates.
 *
 * The regex parser in parse.ts reads well what it was written for and misses what it
 * was not: "rent's $900", "every Friday I get paid $480", "roughly $700 a week before
 * gas". Writing a pattern for each phrasing does not converge; every fresh set of
 * descriptions has turned up a new batch.
 *
 * So the work is split the way TypeSafe recommends for extraction (the pre-parsed
 * value cookbook, cached in sources/raw/typesafe):
 *
 *   1. Code over-finds every span that could be an amount of money.
 *   2. The engine says what each one is and how often it is paid, as a choice among
 *      fixed options. It never writes a number, so it cannot invent or garble one.
 *   3. Code copies the chosen span, converts it, and does every sum.
 *
 * Counting is kept in code, because the engine does not count reliably. The engine
 * gives its own household size and number of children as a cross-check: where the two
 * agree the count stands, where code found nothing a confident engine answer fills
 * it, and where they disagree the field is left for the household to state, because a
 * wrong household size silently changes every limit.
 *
 * The state is read by code, which is already right on every case written so far.
 */

import type { EngineClient, EngineQuestion } from './engine/types';
import { ParseResult, ParsedFacts, Period, parseHousehold, toMonthly } from './parse';

export interface MoneyCandidate {
  /** Question-safe key, stable for one paragraph. */
  key: string;
  /** The span exactly as written. */
  span: string;
  value: number;
  /** The words around it, so a repeated figure can be told apart. */
  snippet: string;
}

const NUMBER = /(\$\s*)?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(k\b|grand\b)?(\s*(?:dollars|bucks)\b)?/gi;

/**
 * Every span that could be an amount of money, tuned to over-find.
 *
 * Only what can plainly not be money is dropped: an age, a count of people, a date,
 * a single digit with no dollar sign. Everything else goes to the engine, which can
 * answer "not money" for it.
 */
export function findMoneyCandidates(text: string): MoneyCandidate[] {
  const out: MoneyCandidate[] = [];
  const seen = new Set<string>();

  // "$300-$400 a week" is one amount stated as a range, not two incomes. It becomes a
  // single candidate at the midpoint, and its parts are not offered separately.
  const RANGE = /\$\s*(\d[\d,]*)\s*(?:-|–|to)\s*\$?\s*(\d[\d,]*)/gi;
  const inRange: [number, number][] = [];
  for (const r of text.matchAll(RANGE)) {
    const low = Number(r[1].replace(/,/g, ''));
    const high = Number(r[2].replace(/,/g, ''));
    if (!(high > low)) continue;
    const at = r.index ?? 0;
    inRange.push([at, at + r[0].length]);
    const value = (low + high) / 2;
    seen.add(`${value}`);
    out.push({
      key: `amount_${out.length + 1}`,
      span: r[0].trim(),
      value,
      snippet: text.slice(Math.max(0, at - 50), Math.min(text.length, at + r[0].length + 50)).trim(),
    });
  }

  for (const m of text.matchAll(NUMBER)) {
    if (inRange.some(([from, to]) => (m.index ?? 0) >= from && (m.index ?? 0) < to)) continue;
    const [whole, dollar, digits, decimals, suffix, word] = m;
    const at = m.index ?? 0;
    const after = text.slice(at + whole.length, at + whole.length + 24).toLowerCase();
    const before = text.slice(Math.max(0, at - 12), at).toLowerCase();
    const hasMoneyMark = Boolean(dollar || suffix || word);

    if (!hasMoneyMark) {
      if (digits.replace(/,/g, '').length < 2) continue;
      if (/^\s*(?:-|\s)?(?:years?|yrs?|months?|mos?|weeks?)\b|^\s*(?:kids?|kiddos?|children|people|persons|adults?|of us|bedrooms?|hours?|hrs?|days?)\b|^(?:st|nd|rd|th)\b/.test(after)) continue;
      if (/\b(?:aged?|ages|i'?m|i am|is|are)\s*$/.test(before) && Number(digits) < 120) continue;
      if (/^(?:19|20)\d\d$/.test(digits)) continue;
    }

    let value = parseFloat(digits.replace(/,/g, '') + (decimals ?? ''));
    if (suffix) value *= 1000;
    if (!Number.isFinite(value) || value <= 0) continue;

    const span = whole.trim();
    const dedupe = `${value}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({
      key: `amount_${out.length + 1}`,
      span,
      value,
      snippet: text.slice(Math.max(0, at - 50), Math.min(text.length, at + whole.length + 50)).trim(),
    });
  }
  return out;
}

export const ROLES: Record<string, string> = {
  income: 'money the household receives: pay, wages, tips, benefits, a pension, Social Security, SSI, unemployment, support received',
  housing: 'rent, a share of rent, a mortgage payment or lot rent',
  care: 'what is paid for daycare, child care or care for a disabled adult',
  utilities: 'a gas, electric, heating, water or other utility bill paid separately from rent',
  medical: 'medical costs: prescriptions, doctor visits, insurance premiums',
  child_support_paid: 'child support the household pays to someone else',
  savings: 'money saved or in the bank',
  other: 'anything else, including a price, a debt, an hourly wage, or a number that is not money',
};

export const PERIODS: Record<string, string> = {
  weekly: 'every week',
  biweekly: 'every two weeks',
  twice_monthly: 'twice a month, such as on the 1st and 15th',
  monthly: 'every month',
  annual: 'every year',
  once: 'a single amount, not a repeating one',
  not_stated: 'how often is not stated',
};

const COUNT_OPTIONS = (from: number, to: number) => {
  const out: Record<string, string> = {};
  for (let n = from; n <= to; n++) out[String(n)] = String(n);
  out.not_stated = 'the description does not make this clear';
  return out;
};

export function readingQuestions(candidates: MoneyCandidate[]): Record<string, EngineQuestion> {
  const questions: Record<string, EngineQuestion> = {
    'read.household_size': {
      type: 'choice',
      instructions:
        'How many people live in this household and share food, counting the person describing it?',
      criteria: COUNT_OPTIONS(1, 12),
    },
    'read.children': {
      type: 'choice',
      instructions: 'How many children under 18 live in this household?',
      criteria: COUNT_OPTIONS(0, 10),
    },
  };
  for (const c of candidates) {
    questions[`read.role.${c.key}`] = {
      type: 'choice',
      instructions: `In this description, what is the amount "${c.span}", where it says: "${c.snippet}"?`,
      criteria: ROLES,
    };
    questions[`read.period.${c.key}`] = {
      type: 'choice',
      instructions: `How often is the amount "${c.span}" paid or received, where it says: "${c.snippet}"?`,
      criteria: PERIODS,
    };
  }
  return questions;
}

/** Confidence at or above which an engine count may fill a gap code left. */
export const COUNT_CONFIDENCE = 0.6;

const TO_PERIOD: Record<string, Period | null> = {
  weekly: 'weekly',
  biweekly: 'biweekly',
  twice_monthly: 'semimonthly',
  monthly: 'monthly',
  annual: 'annual',
  once: null,
  not_stated: null,
};

function monthlyOf(value: number, period: string): number {
  const p = TO_PERIOD[period];
  return p ? toMonthly(value, p) : value;
}

/**
 * Read a paragraph with the engine choosing among candidates, falling back to the
 * regex parser for anything the engine leaves open.
 */
export async function readHousehold(paragraph: string, engine: EngineClient): Promise<ParseResult> {
  const code = parseHousehold(paragraph);
  const text = paragraph.replace(/\s+/g, ' ').trim();
  const candidates = findMoneyCandidates(text);

  const response = await engine.ask({ state: text, questions: readingQuestions(candidates) });
  const a = response.answers;
  const facts: ParsedFacts = { ...code.facts };
  const notes = [...code.notes];

  // --- money: the engine says what each amount is; code does the arithmetic ------
  const byRole: Record<string, { c: MoneyCandidate; period: string }[]> = {};
  for (const c of candidates) {
    const role = a[`read.role.${c.key}`]?.choice ?? 'other';
    const period = a[`read.period.${c.key}`]?.choice ?? 'not_stated';
    (byRole[role] ??= []).push({ c, period });
  }

  const incomes = byRole.income ?? [];
  if (incomes.length === 1) {
    const { c, period } = incomes[0];
    facts.incomeAmount = c.value;
    facts.incomePeriod = TO_PERIOD[period] ?? null;
  } else if (incomes.length > 1) {
    // Several incomes, say two jobs or two earners: added up in code, as a month.
    const stated = incomes.filter((i) => i.period !== 'not_stated' && i.period !== 'once');
    if (stated.length === incomes.length) {
      facts.incomeAmount = Math.round(incomes.reduce((sum, i) => sum + monthlyOf(i.c.value, i.period), 0) * 100) / 100;
      facts.incomePeriod = 'monthly';
      notes.push(`Income is the sum of ${incomes.length} amounts: ${incomes.map((i) => i.c.span).join(', ')}.`);
    }
  }

  const monthlyFor = (role: string): number | null => {
    const hits = byRole[role];
    if (!hits || hits.length === 0) return null;
    return hits.reduce((sum, h) => sum + monthlyOf(h.c.value, h.period === 'not_stated' ? 'monthly' : h.period), 0);
  };
  facts.rentMonthly = monthlyFor('housing') ?? code.facts.rentMonthly;
  facts.utilitiesMonthly = monthlyFor('utilities') ?? code.facts.utilitiesMonthly;
  facts.dependentCareMonthly = monthlyFor('care') ?? code.facts.dependentCareMonthly;
  facts.medicalMonthly = monthlyFor('medical') ?? code.facts.medicalMonthly;
  facts.childSupportMonthly = monthlyFor('child_support_paid') ?? code.facts.childSupportMonthly;
  facts.savings = byRole.savings?.[0]?.c.value ?? code.facts.savings;
  if (incomes.length === 0 && facts.incomeAmount === null) {
    facts.incomeAmount = code.facts.incomeAmount;
    facts.incomePeriod = code.facts.incomePeriod;
  }

  // --- counts: code counts, the engine cross-checks ----------------------------------
  const settle = (field: 'householdSize' | 'childrenCount', id: string) => {
    const answer = a[id];
    const engineValue = answer && answer.choice !== 'not_stated' ? Number(answer.choice) : null;
    const codeValue = code.facts[field];
    if (codeValue !== null && engineValue !== null && codeValue !== engineValue) {
      facts[field] = null;
      notes.push(`Read ${field === 'householdSize' ? 'the household size' : 'the number of children'} two ways (${codeValue} and ${engineValue}), so it is asked rather than assumed.`);
    } else if (codeValue === null && engineValue !== null && (answer?.confidence ?? 0) >= COUNT_CONFIDENCE) {
      facts[field] = engineValue;
    }
  };
  settle('householdSize', 'read.household_size');
  settle('childrenCount', 'read.children');

  const missing: ParseResult['missing'] = [];
  if (facts.householdSize === null) missing.push('householdSize');
  if (facts.incomeAmount === null && !/\bno income\b|\bnothing coming in\b/i.test(text)) missing.push('income');

  return { facts, missing, notes };
}

/** Whether an engine can read this way: a typed readout, not a fixture or a generator. */
export function readsWithEngine(engine: EngineClient): boolean {
  return !engine.isFixture && (engine as { typedReadout?: boolean }).typedReadout === true;
}
