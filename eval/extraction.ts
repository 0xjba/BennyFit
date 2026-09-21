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
