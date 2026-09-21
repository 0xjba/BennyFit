/**
 * The household on the landing page, and what BennyFit actually returns for it.
 *
 * The figures are what the live screener produces for this exact text, not a
 * dressed-up example. `hero.test.ts` runs the text through the screener and fails when
 * the two drift apart, which is how the page came to show ten programs after the
 * screener had moved on to fifteen.
 *
 * There is no "questions asked" figure. How many follow-ups a household sees depends
 * on the engine reading the paragraph and on what the household answers, so it is not
 * a property of the text.
 */

export const HERO_TEXT =
  'I work part time and make $430 a week. I have two kids aged 4 and 8, we live in Michigan, rent is $1,200 a month, and daycare costs $300.';

export const HERO_FIGURES = { programs: 15, annualDollars: 23694, rulesChecked: 80 };
