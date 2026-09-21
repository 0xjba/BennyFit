/**
 * The held-out extraction set, fourth edition.
 *
 * Each earlier held-out set was scored once, exposed misses, was fixed against, and so
 * stopped being a measurement. All three now sit in the development set. These twenty
 * were written after the third round of fixes, without running them through the
 * parser first, and are scored once.
 *
 * The rule has not changed: the parser is not adjusted in response to these results.
 * The moment it is, this set joins the development set and a fifth has to be written.
 *
 * They use shapes absent from all eighty development cases: "2.5k", "kiddos",
 * stepchildren, state abbreviations after a city, the District of Columbia, a
 * grandparent raising grandchildren alone, roommates, amounts given before the word
 * that explains them, and sizes stated at the end rather than the start.
 */

import type { ExtractionCase } from './extraction';

export const HOLDOUT_WRITTEN = '2026-09-21';
export const HOLDOUT_EDITION = 4;

export const HOLDOUT_CASES: ExtractionCase[] = [
  {
    id: 'n01',
    paragraph: 'Me and my 4 kiddos in Portland, OR. I bring in about 2.5k a month. Rent $1,600.',
    expected: { householdSize: 5, incomeAmount: 2500, incomePeriod: 'monthly', rentMonthly: 1600, state: 'Oregon', childrenCount: 4 },
  },
  {
    id: 'n02',
    paragraph: 'I am a grandmother raising my 2 grandkids in Alabama. I get $1,420 a month in Social Security. Rent is $675.',
    expected: { householdSize: 3, incomeAmount: 1420, incomePeriod: 'monthly', rentMonthly: 675, state: 'Alabama', childrenCount: 2 },
  },
  {
    id: 'n03',
    paragraph: 'My husband and I have 2 kids together and he has a daughter from before who lives with us full time. We are in Ohio. He earns $4,000 a month. Rent $1,250.',
    expected: { householdSize: 5, incomeAmount: 4000, incomePeriod: 'monthly', rentMonthly: 1250, state: 'Ohio', childrenCount: 3 },
  },
  {
    id: 'n04',
    paragraph: 'Washington, DC. Single, no kids. $3,300 a month from my job, $1,700 a month in rent.',
    expected: { householdSize: 1, incomeAmount: 3300, incomePeriod: 'monthly', rentMonthly: 1700, state: 'District of Columbia', childrenCount: 0 },
  },
  {
    id: 'n05',
    paragraph: 'I have a roommate but we buy food separately. I make $1,900 a month in Texas. My half of the rent is $650.',
    expected: { incomeAmount: 1900, incomePeriod: 'monthly', rentMonthly: 650, state: 'Texas' },
  },
  {
    id: 'n06',
    paragraph: 'Our monthly income is $2,450 and our rent is $1,050. We live in Georgia with our three children.',
    expected: { householdSize: 5, incomeAmount: 2450, incomePeriod: 'monthly', rentMonthly: 1050, state: 'Georgia', childrenCount: 3 },
  },
  {
    id: 'n07',
    paragraph: 'I work two jobs in Michigan. One pays $1,200 a month and the other $800 a month. I have one son. Rent is $900.',
    expected: { householdSize: 2, rentMonthly: 900, state: 'Michigan', childrenCount: 1 },
  },
  {
    id: 'n08',
    paragraph: 'My fiancé and I live in Nashville, TN with our daughter. Our combined income is $52,000 per year. Rent is $1,500 a month.',
    expected: { householdSize: 3, incomeAmount: 52000, incomePeriod: 'annual', rentMonthly: 1500, state: 'Tennessee', childrenCount: 1 },
  },
  {
    id: 'n09',
    paragraph: 'Rent: $1,100. Income: $2,800/month. Household: 3 people. State: Virginia.',
    expected: { householdSize: 3, incomeAmount: 2800, incomePeriod: 'monthly', rentMonthly: 1100, state: 'Virginia' },
  },
  {
    id: 'n10',
    paragraph: 'Veteran, 58, living with my wife in Kentucky. My VA disability is $1,760 a month and she makes $1,300 a month. Mortgage $950.',
    expected: { householdSize: 2, rentMonthly: 950, state: 'Kentucky' },
  },
  {
    id: 'n11',
    paragraph: 'I am 24 and live with my parents in New Hampshire. I make $1,500 a month. I do not pay rent.',
    expected: { householdSize: 3, incomeAmount: 1500, incomePeriod: 'monthly', state: 'New Hampshire' },
  },
  {
    id: 'n12',
    paragraph: 'Two adults and a baby in Rhode Island. My partner earns $620 a week. We pay $1,350 rent.',
    expected: { householdSize: 3, incomeAmount: 620, incomePeriod: 'weekly', rentMonthly: 1350, state: 'Rhode Island', childrenCount: 1 },
  },
  {
    id: 'n13',
    paragraph: 'I get $2,100 on the 15th and the last day of each month. Living in Florida with my two sons. Rent is $1,650.',
    expected: { householdSize: 3, incomeAmount: 2100, incomePeriod: 'monthly', rentMonthly: 1650, state: 'Florida', childrenCount: 2 },
  },
  {
    id: 'n14',
    paragraph: 'We are a family of eight in Idaho. My husband makes $5,500 monthly working construction. Rent is $1,700.',
    expected: { householdSize: 8, incomeAmount: 5500, incomePeriod: 'monthly', rentMonthly: 1700, state: 'Idaho' },
  },
  {
    id: 'n15',
    paragraph: 'Currently unemployed with no income. Me and my daughter are staying in Arizona and rent is $950.',
    expected: { householdSize: 2, rentMonthly: 950, state: 'Arizona', childrenCount: 1 },
  },
  {
    id: 'n16',
    paragraph: 'I clean houses in California and make around $600 a week. My mom, my son and I share a two bedroom for $2,200 a month.',
    expected: { householdSize: 3, incomeAmount: 600, incomePeriod: 'weekly', rentMonthly: 2200, state: 'California', childrenCount: 1 },
  },
  {
    id: 'n17',
    paragraph: 'My wife and I have three kids, 1, 4 and 9, in North Dakota. I make $3,800 a month. Rent is $1,150.',
    expected: { householdSize: 5, incomeAmount: 3800, incomePeriod: 'monthly', rentMonthly: 1150, state: 'North Dakota', childrenCount: 3 },
  },
  {
    id: 'n18',
    paragraph: 'I receive SSI of $967 a month in Massachusetts. I live alone and my rent is $500 with a voucher.',
    expected: { householdSize: 1, incomeAmount: 967, incomePeriod: 'monthly', rentMonthly: 500, state: 'Massachusetts' },
  },
  {
    id: 'n19',
    paragraph: 'Semi-monthly paychecks of $1,400. Me, my husband, and 2 kids in Wyoming. Rent $1,000.',
    expected: { householdSize: 4, incomeAmount: 1400, incomePeriod: 'monthly', rentMonthly: 1000, state: 'Wyoming', childrenCount: 2 },
  },
  {
    id: 'n20',
    paragraph: 'In Alaska with my wife and our twin girls. I earn $72,000 a year on the slope. Our rent is $1,900.',
    expected: { householdSize: 4, incomeAmount: 72000, incomePeriod: 'annual', rentMonthly: 1900, state: 'Alaska', childrenCount: 2 },
  },
];
