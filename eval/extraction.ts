/**
 * Extraction: can the system read the facts out of how people actually write?
 *
 * The gold set cannot answer this honestly. Its paragraphs are rendered from templates
 * written alongside the parser, so scoring the parser against them mostly measures
 * whether the parser understands the phrasings the generator was taught to produce.
 *
 * These paragraphs were written the other way round: deliberately in the shapes people
 * use and templates do not — round numbers in words, "2 grand", pay dates instead of
 * periods, lowercase run-on sentences, a household size you have to count. The facts
 * were labelled by hand. The parser was not adjusted to fit them, and some of them it
 * gets wrong. That is the number worth reporting.
 *
 * A field left out of `expected` is not scored for that paragraph.
 *
 * This is the development set: the parser may be tuned against it freely. The
 * reported figure comes from `extraction-holdout.ts`, which may not be tuned against.
 */

import { parseHousehold } from '@/lib/parse';

export interface ExtractionCase {
  id: string;
  paragraph: string;
  expected: {
    householdSize?: number;
    incomeAmount?: number;
    incomePeriod?: 'weekly' | 'biweekly' | 'monthly' | 'annual';
    rentMonthly?: number;
    state?: string;
    childrenCount?: number;
  };
}

export const EXTRACTION_CASES: ExtractionCase[] = [
  {
    id: 'x01',
    paragraph: 'me and my 3 kids live in Georgia. i make about $1,900 a month at the warehouse and rent is $1,050',
    expected: { householdSize: 4, incomeAmount: 1900, incomePeriod: 'monthly', rentMonthly: 1050, state: 'Georgia', childrenCount: 3 },
  },
  {
    id: 'x02',
    paragraph: "My wife and I are both retired. We get $2,340 a month between us from Social Security. We own our home outright in Arizona.",
    expected: { householdSize: 2, incomeAmount: 2340, incomePeriod: 'monthly', state: 'Arizona' },
  },
  {
    id: 'x03',
    paragraph: 'I get paid every other Friday, usually around $780. Single mom, one daughter who is 6. Rent $900. Ohio.',
    expected: { householdSize: 2, incomeAmount: 780, incomePeriod: 'biweekly', rentMonthly: 900, state: 'Ohio', childrenCount: 1 },
  },
  {
    id: 'x04',
    paragraph: 'Household of five in Texas. My husband brings home $52,000 a year and I stay home with the kids.',
    expected: { householdSize: 5, incomeAmount: 52000, incomePeriod: 'annual', state: 'Texas' },
  },
  {
    id: 'x05',
    paragraph: "It's just me. I'm on SSDI, $1,410 monthly, and I pay $675 in rent in Pennsylvania.",
    expected: { householdSize: 1, incomeAmount: 1410, incomePeriod: 'monthly', rentMonthly: 675, state: 'Pennsylvania' },
  },
  {
    id: 'x06',
    paragraph: 'I work 30 hours a week at $15 an hour. I have two boys. We live in Michigan and rent is $1,150.',
    expected: { childrenCount: 2, rentMonthly: 1150, state: 'Michigan' },
  },
  {
    id: 'x07',
    paragraph: 'There are 4 of us. I make 2 grand a month, rent is 1200. We are in North Carolina.',
    expected: { householdSize: 4, state: 'North Carolina' },
  },
  {
    id: 'x08',
    paragraph: 'I bring in roughly $400 a week driving for a delivery app. Live alone in Nevada, $1,000 rent.',
    expected: { householdSize: 1, incomeAmount: 400, incomePeriod: 'weekly', rentMonthly: 1000, state: 'Nevada' },
  },
  {
    id: 'x09',
    paragraph: 'We are a family of 3 — me, my partner and our baby. Combined we earn about $3,100/mo. Rent $1,400. Colorado.',
    expected: { householdSize: 3, incomeAmount: 3100, incomePeriod: 'monthly', rentMonthly: 1400, state: 'Colorado', childrenCount: 1 },
  },
  {
    id: 'x10',
    paragraph: "I'm 67, widowed, living by myself in Florida on a pension of $1,850 a month. No rent, the house is paid off.",
    expected: { householdSize: 1, incomeAmount: 1850, incomePeriod: 'monthly', state: 'Florida' },
  },
  {
    id: 'x11',
    paragraph: 'My income is $28k a year. I have 2 kids aged 3 and 7. Renting for $950 in Kentucky.',
    expected: { incomeAmount: 28000, incomePeriod: 'annual', rentMonthly: 950, state: 'Kentucky', childrenCount: 2 },
  },
  {
    id: 'x12',
    paragraph: 'Lost my job last month. Getting $450 a week in unemployment. Married, no kids, in New Jersey, rent is $1,700 a month.',
    expected: { incomeAmount: 450, incomePeriod: 'weekly', rentMonthly: 1700, state: 'New Jersey' },
  },
  {
    id: 'x13',
    paragraph: 'i live w my mom and 2 younger sisters in oklahoma. i work part time making like 900 a month',
    expected: { state: 'Oklahoma' },
  },
  {
    id: 'x14',
    paragraph: 'Hello, I am a single father of three children. I earn $2,650 per month. My rent is $1,300. I live in Tennessee.',
    expected: { householdSize: 4, incomeAmount: 2650, incomePeriod: 'monthly', rentMonthly: 1300, state: 'Tennessee', childrenCount: 3 },
  },
  {
    id: 'x15',
    paragraph: 'We live in Washington state. Take home is $1,200 twice a month. Two adults, one kid. $1,600 rent.',
    expected: { householdSize: 3, rentMonthly: 1600, state: 'Washington', childrenCount: 1 },
  },
  {
    id: 'x16',
    paragraph: 'Retired veteran in Virginia, 72 years old, about $1,600 a month from VA and Social Security combined, rent $800.',
    expected: { householdSize: 1, incomeAmount: 1600, incomePeriod: 'monthly', rentMonthly: 800, state: 'Virginia' },
  },
  {
    id: 'x17',
    paragraph: 'I make $19.50 an hour, full time. My son lives with me half the week. Rent $1,100 in Oregon.',
    expected: { rentMonthly: 1100, state: 'Oregon', childrenCount: 1 },
  },
  {
    id: 'x18',
    paragraph: 'Grandmother raising my two grandkids in Alabama. I get $1,020 a month SSI. We live in public housing.',
    expected: { householdSize: 3, incomeAmount: 1020, incomePeriod: 'monthly', state: 'Alabama' },
  },
  {
    id: 'x19',
    paragraph: "Two of us, both working minimum wage jobs in Missouri, together about $2,800 monthly, we pay $850 rent.",
    expected: { householdSize: 2, incomeAmount: 2800, incomePeriod: 'monthly', rentMonthly: 850, state: 'Missouri' },
  },
  {
    id: 'x20',
    paragraph: 'I have 4 kids. I clean houses and make maybe $300-$400 a week, cash. Rent is $1,250 a month in Illinois.',
    expected: { householdSize: 5, incomePeriod: 'weekly', rentMonthly: 1250, state: 'Illinois', childrenCount: 4 },
  },

  // The first held-out set, retired to development on 2026-09-21 after the household
  // size bug it exposed was fixed against it. It can no longer measure anything.

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
  // The second held-out set, retired to development on 2026-09-21. It was scored once
  // at 86.3% and then fixed against: stated sizes like "a two-person household",
  // relatives other than children, amounts without a dollar sign.
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
  // The third held-out set, retired to development on 2026-09-21. It was scored once
  // at 91.4% and then fixed against: "45k" without a dollar sign, "hh of N", a child
  // described by age, adult children, "both" as a partner, amounts in reverse order.
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
  // The fourth held-out set, retired to development on 2026-09-21. It was scored once
  // at 87.7% and then fixed against: "2.5k", Washington DC, "kiddos", stepchildren,
  // "fiancé", label-and-colon forms, rent described as a share.
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

export interface FieldResult {
  field: string;
  expected: unknown;
  got: unknown;
  correct: boolean;
}

export interface ExtractionResult {
  id: string;
  paragraph: string;
  fields: FieldResult[];
}

export function runExtraction(cases: ExtractionCase[] = EXTRACTION_CASES): {
  results: ExtractionResult[];
  byField: Record<string, { correct: number; total: number }>;
  overall: { correct: number; total: number };
} {
  const results: ExtractionResult[] = [];
  const byField: Record<string, { correct: number; total: number }> = {};

  for (const c of cases) {
    const facts = parseHousehold(c.paragraph).facts;
    const fields: FieldResult[] = [];

    for (const [field, expected] of Object.entries(c.expected)) {
      const got = (facts as unknown as Record<string, unknown>)[field];
      const correct =
        typeof expected === 'number' && typeof got === 'number'
          ? Math.abs(got - expected) < 0.5
          : got === expected;
      fields.push({ field, expected, got, correct });
      byField[field] = byField[field] ?? { correct: 0, total: 0 };
      byField[field].total += 1;
      if (correct) byField[field].correct += 1;
    }

    results.push({ id: c.id, paragraph: c.paragraph, fields });
  }

  const overall = Object.values(byField).reduce(
    (acc, f) => ({ correct: acc.correct + f.correct, total: acc.total + f.total }),
    { correct: 0, total: 0 }
  );

  return { results, byField, overall };
}
