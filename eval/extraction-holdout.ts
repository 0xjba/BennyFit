/**
 * The held-out extraction set, fifth edition.
 *
 * Each earlier held-out set was scored once, exposed misses, was fixed against, and so
 * stopped being a measurement. All four now sit in the development set. These twenty
 * were written after the fourth round of fixes, without running them through the
 * parser first, and are scored once.
 *
 * The rule has not changed: the parser is not adjusted in response to these results.
 * The moment it is, this set joins the development set and a sixth has to be written.
 *
 * They use shapes absent from all hundred development cases: "St." inside a place
 * name, "rent's" and "rent runs", "every Friday", "$1.2k", foster children, a child
 * described only by age, children listed in brackets, a misspelled "roomate", lowercase
 * state names, and a partner described in the third person.
 */

import type { ExtractionCase } from './extraction';

export const HOLDOUT_WRITTEN = '2026-09-21';
export const HOLDOUT_EDITION = 5;

export const HOLDOUT_CASES: ExtractionCase[] = [
  {
    id: 'p01',
    paragraph: 'We live in St. Louis, MO. I make $2,700 a month and my rent is $1,000. I have 2 kids.',
    expected: { householdSize: 3, incomeAmount: 2700, incomePeriod: 'monthly', rentMonthly: 1000, state: 'Missouri', childrenCount: 2 },
  },
  {
    id: 'p02',
    paragraph: "rent's $900 and i get about $1,300 a month from ssdi. just me in texas",
    expected: { householdSize: 1, incomeAmount: 1300, incomePeriod: 'monthly', rentMonthly: 900, state: 'Texas' },
  },
  {
    id: 'p03',
    paragraph: 'Every Friday I get paid $480. I have a son and a daughter and we live in Maine. Rent runs $1,100.',
    expected: { householdSize: 3, incomeAmount: 480, incomePeriod: 'weekly', rentMonthly: 1100, state: 'Maine', childrenCount: 2 },
  },
  {
    id: 'p04',
    paragraph: 'Husband, me and our boys (7 and 10) in Colorado. He makes $1.2k a week. Rent is $2,000.',
    expected: { householdSize: 4, incomeAmount: 1200, incomePeriod: 'weekly', rentMonthly: 2000, state: 'Colorado', childrenCount: 2 },
  },
  {
    id: 'p05',
    paragraph: 'My wife and I foster two kids in Oregon. I earn $4,500 a month. Our mortgage payment is $1,650.',
    expected: { householdSize: 4, incomeAmount: 4500, incomePeriod: 'monthly', rentMonthly: 1650, state: 'Oregon', childrenCount: 2 },
  },
  {
    id: 'p06',
    paragraph: 'I have a 17 year old in high school. We live in Iowa. I make $2,300 a month and pay $800 in rent.',
    expected: { householdSize: 2, incomeAmount: 2300, incomePeriod: 'monthly', rentMonthly: 800, state: 'Iowa', childrenCount: 1 },
  },
  {
    id: 'p07',
    paragraph: 'I live with a roomate in Pennsylvania, we split everything. My income is $2,000 a month. My share of rent is $700.',
    expected: { incomeAmount: 2000, incomePeriod: 'monthly', rentMonthly: 700, state: 'Pennsylvania' },
  },
  {
    id: 'p08',
    paragraph: 'Family of 6 in utah. My husband works and brings home $5,100 a month. Rent $1,750.',
    expected: { householdSize: 6, incomeAmount: 5100, incomePeriod: 'monthly', rentMonthly: 1750, state: 'Utah' },
  },
  {
    id: 'p09',
    paragraph: 'I am a single father in Illinois. My three children are 3, 8 and 13. I earn $48,000 a year. Rent is $1,400 a month.',
    expected: { householdSize: 4, incomeAmount: 48000, incomePeriod: 'annual', rentMonthly: 1400, state: 'Illinois', childrenCount: 3 },
  },
  {
    id: 'p10',
    paragraph: 'Retired, 75, widowed, in Florida. My Social Security check is $1,850 a month. I own my condo.',
    expected: { householdSize: 1, incomeAmount: 1850, incomePeriod: 'monthly', state: 'Florida' },
  },
  {
    id: 'p11',
    paragraph: 'My partner and I both work in Virginia. He makes $2,600 a month and I make $1,900 a month. No kids. Rent is $1,500.',
    expected: { householdSize: 2, rentMonthly: 1500, state: 'Virginia', childrenCount: 0 },
  },
  {
    id: 'p12',
    paragraph: 'I am 8 months pregnant and live with my mom in Mississippi. I make $1,100 a month. Rent is $600.',
    expected: { householdSize: 2, incomeAmount: 1100, incomePeriod: 'monthly', rentMonthly: 600, state: 'Mississippi' },
  },
  {
    id: 'p13',
    paragraph: 'Our household: me, my wife, 3 kids, and my father-in-law. We are in Texas. I earn $4,200 a month. Mortgage $1,300.',
    expected: { householdSize: 6, incomeAmount: 4200, incomePeriod: 'monthly', rentMonthly: 1300, state: 'Texas', childrenCount: 3 },
  },
  {
    id: 'p14',
    paragraph: 'Income $1,650 per month. Rent $1,025 per month. Household of two, my daughter and me, in Georgia.',
    expected: { householdSize: 2, incomeAmount: 1650, incomePeriod: 'monthly', rentMonthly: 1025, state: 'Georgia' },
  },
  {
    id: 'p15',
    paragraph: 'I drive for a delivery app in Nevada, roughly $700 a week before gas. Me and my son. Rent is $1,300.',
    expected: { householdSize: 2, incomeAmount: 700, incomePeriod: 'weekly', rentMonthly: 1300, state: 'Nevada', childrenCount: 1 },
  },
  {
    id: 'p16',
    paragraph: 'There are 3 adults in our house in Ohio: me, my brother and my aunt. Together we make $3,900 a month. Rent $1,200.',
    expected: { householdSize: 3, incomeAmount: 3900, incomePeriod: 'monthly', rentMonthly: 1200, state: 'Ohio' },
  },
  {
    id: 'p17',
    paragraph: 'We are in South Carolina with our 4 month old. My husband makes $1,500 biweekly. Rent is $1,150.',
    expected: { householdSize: 3, incomeAmount: 1500, incomePeriod: 'biweekly', rentMonthly: 1150, state: 'South Carolina', childrenCount: 1 },
  },
  {
    id: 'p18',
    paragraph: 'I make $31,000 a year in Kentucky. I live alone in a trailer and lot rent is $400.',
    expected: { householdSize: 1, incomeAmount: 31000, incomePeriod: 'annual', rentMonthly: 400, state: 'Kentucky' },
  },
  {
    id: 'p19',
    paragraph: 'Me, my wife, and our five kids in Indiana. I make $920 a week. Rent is $1,300.',
    expected: { householdSize: 7, incomeAmount: 920, incomePeriod: 'weekly', rentMonthly: 1300, state: 'Indiana', childrenCount: 5 },
  },
  {
    id: 'p20',
    paragraph: 'I earn $2,450 a month in Michigan and support my 2 younger siblings who live with me. Rent is $950.',
    expected: { householdSize: 3, incomeAmount: 2450, incomePeriod: 'monthly', rentMonthly: 950, state: 'Michigan' },
  },
];
