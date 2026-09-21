/**
 * The held-out extraction set, sixth edition.
 *
 * Written on 2026-09-21 after the engine-assisted reader (lib/read.ts) was built and
 * before either reader had seen any of it. It is scored once by each: the code parser
 * on its own, and code with the engine choosing among candidates. That makes it the
 * like-for-like comparison of the two on text neither was shaped by.
 *
 * The rule has not changed: nothing is adjusted in response to these results. The
 * moment anything is, this set joins the development set and a seventh is written.
 *
 * Shapes absent from the 120 development cases: a range of pay, "every other week",
 * tips on top of a wage, overtime, a pet in the list of who lives here, "a little over
 * 2k", joint custody, a deployed spouse, child support received, "before taxes".
 */

import type { ExtractionCase } from './extraction';

export const HOLDOUT_WRITTEN = '2026-09-21';
export const HOLDOUT_EDITION = 6;

export const HOLDOUT_CASES: ExtractionCase[] = [
  {
    id: 'q01',
    paragraph: 'Me, my son, and our dog in a small apartment in Ohio. I make $2,050 a month and rent is $795.',
    expected: { householdSize: 2, incomeAmount: 2050, incomePeriod: 'monthly', rentMonthly: 795, state: 'Ohio', childrenCount: 1 },
  },
  {
    id: 'q02',
    paragraph: 'I get paid every other week, about $1,150 after taxes. It is just me and my daughter in Georgia. Our rent is $1,020.',
    expected: { householdSize: 2, incomeAmount: 1150, incomePeriod: 'biweekly', rentMonthly: 1020, state: 'Georgia', childrenCount: 1 },
  },
  {
    id: 'q03',
    paragraph: 'Waitress in Nevada. Base pay is about $900 a month and tips add around $1,100 a month. Two kids. Rent $1,450.',
    expected: { householdSize: 3, incomeAmount: 2000, incomePeriod: 'monthly', rentMonthly: 1450, state: 'Nevada', childrenCount: 2 },
  },
  {
    id: 'q04',
    paragraph: 'My husband is deployed right now and I am home with our three kids in North Carolina. His pay comes to $3,400 a month. Rent is $1,275.',
    expected: { householdSize: 5, incomeAmount: 3400, incomePeriod: 'monthly', rentMonthly: 1275, state: 'North Carolina', childrenCount: 3 },
  },
  {
    id: 'q05',
    paragraph: 'I make somewhere between $1,600 and $1,900 a month depending on hours. Living alone in Missouri, rent is $650.',
    expected: { householdSize: 1, incomePeriod: 'monthly', rentMonthly: 650, state: 'Missouri' },
  },
  {
    id: 'q06',
    paragraph: 'Retired couple in Arizona living on a little over 2k a month from Social Security. We rent a mobile home lot for $450.',
    expected: { householdSize: 2, incomePeriod: 'monthly', rentMonthly: 450, state: 'Arizona' },
  },
  {
    id: 'q07',
    paragraph: 'I earn $52,000 a year before taxes as a medical assistant in Minnesota. I have my two boys. Our rent is $1,600 a month.',
    expected: { householdSize: 3, incomeAmount: 52000, incomePeriod: 'annual', rentMonthly: 1600, state: 'Minnesota', childrenCount: 2 },
  },
  {
    id: 'q08',
    paragraph: 'Single dad in Kansas. I get $1,300 every two weeks and $400 a month in child support for my daughter. Rent is $875.',
    expected: { householdSize: 2, rentMonthly: 875, state: 'Kansas', childrenCount: 1 },
  },
  {
    id: 'q09',
    paragraph: 'We have joint custody so my two kids are with me half the week. I live in Oregon, make $2,900 a month, rent is $1,350.',
    expected: { incomeAmount: 2900, incomePeriod: 'monthly', rentMonthly: 1350, state: 'Oregon' },
  },
  {
    id: 'q10',
    paragraph: 'I am 80 and my granddaughter, who is 19, lives with me in Pennsylvania. My Social Security is $1,480 a month. I own the house.',
    expected: { householdSize: 2, incomeAmount: 1480, incomePeriod: 'monthly', state: 'Pennsylvania', childrenCount: 0 },
  },
  {
    id: 'q11',
    paragraph: 'My regular pay is $640 a week and I usually get another $100 a week in overtime. Me and my wife in Texas. Rent $1,050.',
    expected: { householdSize: 2, incomeAmount: 740, incomePeriod: 'weekly', rentMonthly: 1050, state: 'Texas' },
  },
  {
    id: 'q12',
    paragraph: 'Household of six in Louisiana: my wife, our four children and me. Monthly income is $3,750. Rent $1,125.',
    expected: { householdSize: 6, incomeAmount: 3750, incomePeriod: 'monthly', rentMonthly: 1125, state: 'Louisiana', childrenCount: 4 },
  },
  {
    id: 'q13',
    paragraph: 'Rent is $980 and I pay my own electric, about $140 a month. I make $1,700 a month at a call center in Kentucky. I live alone.',
    expected: { householdSize: 1, incomeAmount: 1700, incomePeriod: 'monthly', rentMonthly: 980, state: 'Kentucky' },
  },
  {
    id: 'q14',
    paragraph: 'Twins, both 3, and me in Maryland. I get paid $1,250 twice a month. Daycare is $900 a month for both. Rent $1,500.',
    expected: { householdSize: 3, incomeAmount: 1250, incomePeriod: 'semimonthly', rentMonthly: 1500, state: 'Maryland', childrenCount: 2 },
  },
  {
    id: 'q15',
    paragraph: 'I live with my girlfriend and her two kids in Indiana. I bring home $750 a week, she does not work. Our rent is $1,100.',
    expected: { householdSize: 4, incomeAmount: 750, incomePeriod: 'weekly', rentMonthly: 1100, state: 'Indiana', childrenCount: 2 },
  },
  {
    id: 'q16',
    paragraph: 'Unemployment gives me $1,560 every two weeks in New Jersey. My husband and I have a 5 year old. Rent is $1,850.',
    expected: { householdSize: 3, incomeAmount: 1560, incomePeriod: 'biweekly', rentMonthly: 1850, state: 'New Jersey', childrenCount: 1 },
  },
  {
    id: 'q17',
    paragraph: 'Seattle, WA. Just me. Salary is $61,000. Rent is $1,950 a month.',
    expected: { householdSize: 1, incomeAmount: 61000, incomePeriod: 'annual', rentMonthly: 1950, state: 'Washington' },
  },
  {
    id: 'q18',
    paragraph: 'Me and my three nephews that I have guardianship of, in Alabama. I make about $2,200 a month. Rent runs $700.',
    expected: { householdSize: 4, incomeAmount: 2200, incomePeriod: 'monthly', rentMonthly: 700, state: 'Alabama', childrenCount: 3 },
  },
  {
    id: 'q19',
    paragraph: 'I do rideshare in Colorado and clear roughly $1,000 every week after gas. Rent is $1,700. My partner and I have a baby.',
    expected: { householdSize: 3, incomeAmount: 1000, incomePeriod: 'weekly', rentMonthly: 1700, state: 'Colorado', childrenCount: 1 },
  },
  {
    id: 'q20',
    paragraph: 'My income is SSI, $967 a month, plus I babysit for about $200 a month. I live in Mississippi with my adult son. Rent $500.',
    expected: { householdSize: 2, incomeAmount: 1167, incomePeriod: 'monthly', rentMonthly: 500, state: 'Mississippi', childrenCount: 0 },
  },
];
