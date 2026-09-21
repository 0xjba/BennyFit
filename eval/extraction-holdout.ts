/**
 * The held-out extraction set, third edition.
 *
 * Each earlier held-out set was scored once, exposed misses, was fixed against, and so
 * stopped being a measurement. Both now sit in the development set. These twenty were
 * written after the second round of fixes, without running them through the parser
 * first, and are scored once.
 *
 * The rule has not changed: the parser is not adjusted in response to these results.
 * The moment it is, this set joins the development set and a fourth has to be written.
 *
 * They use shapes absent from all sixty development cases: "45k", "+", "w/",
 * semimonthly pay written as dates, a household that shrinks part of the week,
 * grandparents raising grandchildren, adult children at home, shorthand like "hh",
 * cities without a state. Some are hard on purpose. A set the parser passes easily
 * is not measuring much.
 */

import type { ExtractionCase } from './extraction';

export const HOLDOUT_WRITTEN = '2026-09-21';
export const HOLDOUT_EDITION = 3;

export const HOLDOUT_CASES: ExtractionCase[] = [
  {
    id: 'm01',
    paragraph: 'Me + 2 kids in Wisconsin. I make 45k a year as a CNA. Rent is $1,150.',
    expected: { householdSize: 3, incomeAmount: 45000, incomePeriod: 'annual', rentMonthly: 1150, state: 'Wisconsin', childrenCount: 2 },
  },
  {
    id: 'm02',
    paragraph: 'My wife and I are raising our two grandsons in West Virginia. Our pensions come to $2,700 a month. We own the house.',
    expected: { householdSize: 4, incomeAmount: 2700, incomePeriod: 'monthly', state: 'West Virginia', childrenCount: 2 },
  },
  {
    id: 'm03',
    paragraph: 'single dad w/ 3 kids, iowa. take home about $1,050 a week. rent $950',
    expected: { householdSize: 4, incomeAmount: 1050, incomePeriod: 'weekly', rentMonthly: 950, state: 'Iowa', childrenCount: 3 },
  },
  {
    id: 'm04',
    paragraph: 'Household size is 2. Located in New Jersey. Gross monthly income $4,400. Monthly rent $1,900.',
    expected: { householdSize: 2, incomeAmount: 4400, incomePeriod: 'monthly', rentMonthly: 1900, state: 'New Jersey' },
  },
  {
    id: 'm05',
    paragraph: 'I live with my husband, our adult son, and our daughter who is 12. We are in Missouri. My husband makes $3,600 a month. Rent is $1,000.',
    expected: { householdSize: 4, incomeAmount: 3600, incomePeriod: 'monthly', rentMonthly: 1000, state: 'Missouri' },
  },
  {
    id: 'm06',
    paragraph: 'I am 67 and live by myself in South Carolina. I get $1,290 a month from Social Security and pay $700 rent.',
    expected: { householdSize: 1, incomeAmount: 1290, incomePeriod: 'monthly', rentMonthly: 700, state: 'South Carolina' },
  },
  {
    id: 'm07',
    paragraph: 'We are a family of 5 in North Carolina. My paycheck is $1,600 twice a month. Rent is $1,350.',
    expected: { householdSize: 5, incomeAmount: 1600, incomePeriod: 'monthly', rentMonthly: 1350, state: 'North Carolina' },
  },
  {
    id: 'm08',
    paragraph: 'hh of 4 in Kansas, income $3,100/mo, rent $825/mo',
    expected: { householdSize: 4, incomeAmount: 3100, incomePeriod: 'monthly', rentMonthly: 825, state: 'Kansas' },
  },
  {
    id: 'm09',
    paragraph: 'I work part time making about $900 a month in New Mexico. I have a 2 year old son. My rent is $650.',
    expected: { householdSize: 2, incomeAmount: 900, incomePeriod: 'monthly', rentMonthly: 650, state: 'New Mexico', childrenCount: 1 },
  },
  {
    id: 'm10',
    paragraph: 'Pregnant with my first and living with my boyfriend in Arkansas. He makes $2,200 a month. Rent $725.',
    expected: { householdSize: 2, incomeAmount: 2200, incomePeriod: 'monthly', rentMonthly: 725, state: 'Arkansas' },
  },
  {
    id: 'm11',
    paragraph: 'There are four of us in Minnesota: me, my wife, and our two boys. I earn $58,000 a year. Mortgage $1,450.',
    expected: { householdSize: 4, incomeAmount: 58000, incomePeriod: 'annual', rentMonthly: 1450, state: 'Minnesota', childrenCount: 2 },
  },
  {
    id: 'm12',
    paragraph: 'I rent an apartment in Chicago, Illinois for $1,275 and make $2,900 a month. It is just me.',
    expected: { householdSize: 1, incomeAmount: 2900, incomePeriod: 'monthly', rentMonthly: 1275, state: 'Illinois' },
  },
  {
    id: 'm13',
    paragraph: 'My sister and I share a place in Connecticut. I make $2,100 a month, she makes $1,800. Our rent is $1,600.',
    expected: { householdSize: 2, rentMonthly: 1600, state: 'Connecticut' },
  },
  {
    id: 'm14',
    paragraph: 'Seven of us live here in Nebraska, three adults and four children. We bring home $5,000 a month. Rent is $1,400.',
    expected: { householdSize: 7, incomeAmount: 5000, incomePeriod: 'monthly', rentMonthly: 1400, state: 'Nebraska', childrenCount: 4 },
  },
  {
    id: 'm15',
    paragraph: 'Laid off last month in Washington state. Unemployment pays me $540 a week. My two daughters live with me. Rent is $1,800.',
    expected: { householdSize: 3, incomeAmount: 540, incomePeriod: 'weekly', rentMonthly: 1800, state: 'Washington', childrenCount: 2 },
  },
  {
    id: 'm16',
    paragraph: 'Retired couple in Delaware. Social Security for both of us is $3,050 a month. We pay $1,100 in rent.',
    expected: { householdSize: 2, incomeAmount: 3050, incomePeriod: 'monthly', rentMonthly: 1100, state: 'Delaware' },
  },
  {
    id: 'm17',
    paragraph: 'Me, my girlfriend, and her 3 kids live together in Louisiana. I make $19 an hour. Rent is $1,050.',
    expected: { householdSize: 5, rentMonthly: 1050, state: 'Louisiana', childrenCount: 3 },
  },
  {
    id: 'm18',
    paragraph: 'I make $2,000 every two weeks in Montana. My son is 6. Rent is $1,200.',
    expected: { householdSize: 2, incomeAmount: 2000, incomePeriod: 'biweekly', rentMonthly: 1200, state: 'Montana', childrenCount: 1 },
  },
  {
    id: 'm19',
    paragraph: 'We have 4 kids and both work in South Dakota. Together we make $6,200 a month. Our rent is $1,300.',
    expected: { householdSize: 6, incomeAmount: 6200, incomePeriod: 'monthly', rentMonthly: 1300, state: 'South Dakota', childrenCount: 4 },
  },
  {
    id: 'm20',
    paragraph: 'Living in Hawaii with my mom. I earn $3,400 per month and our rent is $2,300.',
    expected: { householdSize: 2, incomeAmount: 3400, incomePeriod: 'monthly', rentMonthly: 2300, state: 'Hawaii' },
  },
];
