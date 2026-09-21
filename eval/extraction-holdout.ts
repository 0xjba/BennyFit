/**
 * The held-out extraction set.
 *
 * Written after the parser was last changed, and scored once. The parser must not be
 * adjusted in response to these results: the moment it is, this set stops being a
 * measurement and becomes a second development set, and a new held-out set has to be
 * written to replace it. `eval/extraction.ts` is the development set and may be tuned
 * against freely; this one may not.
 *
 * The phrasings deliberately avoid the shapes in the development set, so that fixing a
 * development case cannot quietly pass a held-out one by string coincidence.
 */

import type { ExtractionCase } from './extraction';

export const HOLDOUT_WRITTEN = '2026-09-21';

export const HOLDOUT_CASES: ExtractionCase[] = [
  {
    id: 'h01',
    paragraph: 'Our family is five people in Louisiana. Dad works offshore and makes about $4,200 monthly. Mortgage is $1,100.',
    expected: { householdSize: 5, incomeAmount: 4200, incomePeriod: 'monthly', rentMonthly: 1100, state: 'Louisiana' },
  },
  {
    id: 'h02',
    paragraph: "I'm a college student in Iowa, I live alone and work at a cafe for around $650 a month. My share of rent is $500.",
    expected: { householdSize: 1, incomeAmount: 650, incomePeriod: 'monthly', rentMonthly: 500, state: 'Iowa' },
  },
  {
    id: 'h03',
    paragraph: 'Single dad here with 2 daughters, ages 9 and 12. I earn $41,000 annually in Minnesota. Rent runs $1,350.',
    expected: { householdSize: 3, incomeAmount: 41000, incomePeriod: 'annual', rentMonthly: 1350, state: 'Minnesota', childrenCount: 2 },
  },
  {
    id: 'h04',
    paragraph: 'Me and my girlfriend plus her son. I get $620 every week from my job in Indiana. We pay $1,000 in rent.',
    expected: { incomeAmount: 620, incomePeriod: 'weekly', rentMonthly: 1000, state: 'Indiana', childrenCount: 1 },
  },
  {
    id: 'h05',
    paragraph: 'I am 81 and I live on my own in Maine. Social Security pays me $1,290 per month. I rent a small apartment for $725.',
    expected: { householdSize: 1, incomeAmount: 1290, incomePeriod: 'monthly', rentMonthly: 725, state: 'Maine' },
  },
  {
    id: 'h06',
    paragraph: 'Six people live in our home in New Mexico. Between two jobs we make $3,900 a month. Rent: $1,250.',
    expected: { householdSize: 6, incomeAmount: 3900, incomePeriod: 'monthly', rentMonthly: 1250, state: 'New Mexico' },
  },
  {
    id: 'h07',
    paragraph: 'Married couple, no children, both disabled, in West Virginia. We get $1,960 a month on SSI together. Rent $600.',
    expected: { householdSize: 2, incomeAmount: 1960, incomePeriod: 'monthly', rentMonthly: 600, state: 'West Virginia' },
  },
  {
    id: 'h08',
    paragraph: 'I have three little ones under 5 and work nights. Paycheck is $1,040 every two weeks. Utah, rent is $1,175.',
    expected: { incomeAmount: 1040, incomePeriod: 'biweekly', rentMonthly: 1175, state: 'Utah', childrenCount: 3 },
  },
  {
    id: 'h09',
    paragraph: 'Just myself in South Carolina. I do hair from home and clear about $22,000 a year. My rent is $875 monthly.',
    expected: { householdSize: 1, incomeAmount: 22000, incomePeriod: 'annual', rentMonthly: 875, state: 'South Carolina' },
  },
  {
    id: 'h10',
    paragraph: 'We are two adults and three kids in Kansas. I make $2,300 a month and my husband is out of work. Rent is $1,050.',
    expected: { householdSize: 5, incomeAmount: 2300, incomePeriod: 'monthly', rentMonthly: 1050, state: 'Kansas', childrenCount: 3 },
  },
  {
    id: 'h11',
    paragraph: 'I receive $980 monthly in disability. Living alone in Mississippi, paying $550 for rent.',
    expected: { householdSize: 1, incomeAmount: 980, incomePeriod: 'monthly', rentMonthly: 550, state: 'Mississippi' },
  },
  {
    id: 'h12',
    paragraph: 'My partner and I have one toddler. We live in Connecticut and together earn $4,600 a month. Rent is $1,800.',
    expected: { householdSize: 3, incomeAmount: 4600, incomePeriod: 'monthly', rentMonthly: 1800, state: 'Connecticut', childrenCount: 1 },
  },
  {
    id: 'h13',
    paragraph: 'Family of four in Wisconsin. Our income is $58,000 per year. We rent for $1,425 a month.',
    expected: { householdSize: 4, incomeAmount: 58000, incomePeriod: 'annual', rentMonthly: 1425, state: 'Wisconsin' },
  },
  {
    id: 'h14',
    paragraph: 'I take care of my 4 kids alone in Arkansas. I work at a factory for $540 a week. Our rent is $825.',
    expected: { householdSize: 5, incomeAmount: 540, incomePeriod: 'weekly', rentMonthly: 825, state: 'Arkansas', childrenCount: 4 },
  },
  {
    id: 'h15',
    paragraph: 'Retired couple in Montana living on $2,700 a month from pensions. The house is paid for.',
    expected: { householdSize: 2, incomeAmount: 2700, incomePeriod: 'monthly', state: 'Montana' },
  },
  {
    id: 'h16',
    paragraph: 'I am pregnant with my first and live by myself in Delaware. I earn $1,600 a month. Rent is $1,050.',
    expected: { householdSize: 1, incomeAmount: 1600, incomePeriod: 'monthly', rentMonthly: 1050, state: 'Delaware' },
  },
  {
    id: 'h17',
    paragraph: 'There are three of us: me and my twin boys who are 7. I make $1,750 monthly in Idaho and pay $900 in rent.',
    expected: { householdSize: 3, incomeAmount: 1750, incomePeriod: 'monthly', rentMonthly: 900, state: 'Idaho', childrenCount: 2 },
  },
  {
    id: 'h18',
    paragraph: 'Our household is 7 people in Nebraska. My husband earns $3,300 a month and I babysit for extra. Rent $1,200.',
    expected: { householdSize: 7, incomeAmount: 3300, incomePeriod: 'monthly', rentMonthly: 1200, state: 'Nebraska' },
  },
  {
    id: 'h19',
    paragraph: 'I bartend in Rhode Island, tips included I average $2,100 a month. Live alone, $1,300 rent.',
    expected: { householdSize: 1, incomeAmount: 2100, incomePeriod: 'monthly', rentMonthly: 1300, state: 'Rhode Island' },
  },
  {
    id: 'h20',
    paragraph: 'Five of us live in a rental in South Dakota. I get paid $1,500 twice a month. Rent is $1,150.',
    expected: { householdSize: 5, rentMonthly: 1150, state: 'South Dakota' },
  },
];
