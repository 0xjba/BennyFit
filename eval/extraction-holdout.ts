/**
 * The held-out extraction set, second edition.
 *
 * The first held-out set exposed a household size bug and was then fixed against, so
 * it stopped being a measurement and moved into the development set. These twenty
 * replace it. They were written after the fix, without running them through the
 * parser first, and are scored once.
 *
 * The rule is the same as before: the parser is not adjusted in response to these
 * results. The moment it is, this set joins the development set and a third has to be
 * written.
 *
 * They lean on phrasings absent from all forty development cases — amounts with no
 * dollar sign, numbers in words, cities instead of states, hourly wages, relatives
 * other than children — because a held-out set that only repeats the development
 * shapes would pass by coincidence.
 */

import type { ExtractionCase } from './extraction';

export const HOLDOUT_WRITTEN = '2026-09-21';
export const HOLDOUT_EDITION = 2;

export const HOLDOUT_CASES: ExtractionCase[] = [
  {
    id: 'k01',
    paragraph: 'It is me, my mother, and my three kids in Maryland. I take home $2,950 a month. Rent is $1,650.',
    expected: { householdSize: 5, incomeAmount: 2950, incomePeriod: 'monthly', rentMonthly: 1650, state: 'Maryland', childrenCount: 3 },
  },
  {
    id: 'k02',
    paragraph: "We're a two-person household in Vermont. Combined income is $3,200 a month and the rent is $1,300.",
    expected: { householdSize: 2, incomeAmount: 3200, incomePeriod: 'monthly', rentMonthly: 1300, state: 'Vermont' },
  },
  {
    id: 'k03',
    paragraph: 'I earn 2400 dollars a month working retail in Ohio. I live alone and pay 850 for rent.',
    expected: { householdSize: 1, incomeAmount: 2400, incomePeriod: 'monthly', rentMonthly: 850, state: 'Ohio' },
  },
  {
    id: 'k04',
    paragraph: 'Family of seven here in Utah. My husband makes $4,800 monthly. Our mortgage is $1,500.',
    expected: { householdSize: 7, incomeAmount: 4800, incomePeriod: 'monthly', rentMonthly: 1500, state: 'Utah' },
  },
  {
    id: 'k05',
    paragraph: 'I live in Austin, TX with my wife and our newborn. I make $950 a week. Rent is $1,700 a month.',
    expected: { householdSize: 3, incomeAmount: 950, incomePeriod: 'weekly', rentMonthly: 1700, state: 'Texas', childrenCount: 1 },
  },
  {
    id: 'k06',
    paragraph: 'Monthly take-home pay of $1,875. Single, no children, renting a studio in Georgia for $925.',
    expected: { incomeAmount: 1875, incomePeriod: 'monthly', rentMonthly: 925, state: 'Georgia' },
  },
  {
    id: 'k07',
    paragraph: 'I am raising my niece and nephew in Tennessee on my own. I get $1,480 a month from my job. Rent $780.',
    expected: { householdSize: 3, incomeAmount: 1480, incomePeriod: 'monthly', rentMonthly: 780, state: 'Tennessee' },
  },
  {
    id: 'k08',
    paragraph: 'A 4 person household in Colorado. We bring in $62,000 a year. Rent is $2,100 a month.',
    expected: { householdSize: 4, incomeAmount: 62000, incomePeriod: 'annual', rentMonthly: 2100, state: 'Colorado' },
  },
  {
    id: 'k09',
    paragraph: 'Me and my three daughters live in Kentucky. My paycheck is $1,100 every 2 weeks. Rent: $875.',
    expected: { householdSize: 4, incomeAmount: 1100, incomePeriod: 'biweekly', rentMonthly: 875, state: 'Kentucky', childrenCount: 3 },
  },
  {
    id: 'k10',
    paragraph: 'Widower, 70, by myself in Oregon. Social Security is $1,640 per month and my rent is $995.',
    expected: { householdSize: 1, incomeAmount: 1640, incomePeriod: 'monthly', rentMonthly: 995, state: 'Oregon' },
  },
  {
    id: 'k11',
    paragraph: '5 people total in our house in Alabama. Between us we make $3,500 a month. Rent is $900.',
    expected: { householdSize: 5, incomeAmount: 3500, incomePeriod: 'monthly', rentMonthly: 900, state: 'Alabama' },
  },
  {
    id: 'k12',
    paragraph: 'I make $17 an hour at a warehouse in Indiana, full time. My two kids live with me. Rent is $1,050.',
    expected: { rentMonthly: 1050, state: 'Indiana', childrenCount: 2 },
  },
  {
    id: 'k13',
    paragraph: 'Our home has 3 people: me, my husband and my dad. We get $2,600 a month. We live in Arizona. Rent $1,400.',
    expected: { householdSize: 3, incomeAmount: 2600, incomePeriod: 'monthly', rentMonthly: 1400, state: 'Arizona' },
  },
  {
    id: 'k14',
    paragraph: 'Living in Philadelphia, Pennsylvania with my son. I earn $38,000 annually. Rent is $1,250.',
    expected: { householdSize: 2, incomeAmount: 38000, incomePeriod: 'annual', rentMonthly: 1250, state: 'Pennsylvania', childrenCount: 1 },
  },
  {
    id: 'k15',
    paragraph: 'Just the two of us in Nevada, both retired. $2,850 a month in pensions. No rent, house is ours.',
    expected: { householdSize: 2, incomeAmount: 2850, incomePeriod: 'monthly', state: 'Nevada' },
  },
  {
    id: 'k16',
    paragraph: 'I have 5 children and my wife stays home. I earn $3,900 a month in Mississippi. Rent is $1,100.',
    expected: { householdSize: 7, incomeAmount: 3900, incomePeriod: 'monthly', rentMonthly: 1100, state: 'Mississippi', childrenCount: 5 },
  },
  {
    id: 'k17',
    paragraph: 'Disabled and living alone in Maine. SSDI gives me $1,520 a month. I rent a room for $600.',
    expected: { householdSize: 1, incomeAmount: 1520, incomePeriod: 'monthly', rentMonthly: 600, state: 'Maine' },
  },
  {
    id: 'k18',
    paragraph: 'We are six: two parents and four kids, in Oklahoma. Income about $4,100 a month, rent $1,200.',
    expected: { householdSize: 6, incomeAmount: 4100, incomePeriod: 'monthly', rentMonthly: 1200, state: 'Oklahoma', childrenCount: 4 },
  },
  {
    id: 'k19',
    paragraph: 'Single mom of one in Florida. I get paid $1,350 on the 1st and the 15th. Rent is $1,500.',
    expected: { householdSize: 2, incomeAmount: 1350, rentMonthly: 1500, state: 'Florida', childrenCount: 1 },
  },
  {
    id: 'k20',
    paragraph: 'Household of 3 in New York. I make roughly $5,200 a month. Rent is $2,400.',
    expected: { householdSize: 3, incomeAmount: 5200, incomePeriod: 'monthly', rentMonthly: 2400, state: 'New York' },
  },
];
