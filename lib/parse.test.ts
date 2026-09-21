import { describe, expect, it } from 'vitest';

import { parseHousehold, toMonthly } from './parse';

const facts = (text: string) => parseHousehold(text).facts;

describe('household size', () => {
  it('takes a stated size over one inferred from a partner', () => {
    // Only "household of N" used to count as a stated size, so this fell through to
    // the inference branch, found "my husband", and returned two.
    expect(
      facts('Our household is 7 people in Nebraska. My husband earns $3,300 a month.').householdSize
    ).toBe(7);
  });

  it('reads the ways people actually state a size', () => {
    expect(facts('Our family is five people in Louisiana.').householdSize).toBe(5);
    expect(facts('Six people live in our home in New Mexico.').householdSize).toBe(6);
    expect(facts('There are three of us.').householdSize).toBe(3);
    expect(facts('We are a family of 4.').householdSize).toBe(4);
    expect(facts('Two adults and three kids.').householdSize).toBe(5);
  });

  it('reads one person, including in forms other than "live alone"', () => {
    expect(facts('Living alone in Mississippi on $980 a month.').householdSize).toBe(1);
    expect(facts('Just myself in South Carolina.').householdSize).toBe(1);
    expect(facts('I live by myself.').householdSize).toBe(1);
  });

  it('does not read a parent doing something alone as a household of one', () => {
    expect(facts('I take care of my 4 kids alone in Arkansas.').householdSize).toBe(5);
  });

  it('reads a couple as two', () => {
    expect(facts('Married couple, no children, in West Virginia.').householdSize).toBe(2);
    expect(facts('Retired couple in Montana living on pensions.').householdSize).toBe(2);
  });

  it('says when a size was inferred rather than stated', () => {
    const result = parseHousehold('My wife and I have two kids.');
    expect(result.facts.householdSize).toBe(4);
    expect(result.notes.join(' ')).toContain('did not state it');
  });

  it('leaves the size unknown rather than guessing when nothing settles it', () => {
    expect(facts('Retired veteran in Virginia, 72 years old.').householdSize).toBeNull();
  });
});

describe('children', () => {
  it('counts twins as two', () => {
    expect(facts('me and my twin boys who are 7').childrenCount).toBe(2);
  });

  it('counts a partner’s child', () => {
    expect(facts('Me and my girlfriend plus her son.').childrenCount).toBe(1);
  });
});

describe('each amount is read with the words around it', () => {
  it('does not file income as rent because rent appears later in the clause', () => {
    // One clause, two amounts. Reading the whole clause for both filed the income as
    // rent too, and the household's income disappeared.
    const f = facts('I make $1,750 monthly in Idaho and pay $900 in rent.');
    expect(f.incomeAmount).toBe(1750);
    expect(f.incomePeriod).toBe('monthly');
    expect(f.rentMonthly).toBe(900);
  });

  it('still takes a period stated elsewhere in the same sentence', () => {
    const f = facts('I get paid every other Friday, usually around $780.');
    expect(f.incomeAmount).toBe(780);
    expect(f.incomePeriod).toBe('biweekly');
  });
});

describe('shapes from the second held-out set', () => {
  it('reads a size written as an adjective or a count', () => {
    expect(facts("We're a two-person household in Vermont.").householdSize).toBe(2);
    expect(facts('A 4 person household in Colorado.').householdSize).toBe(4);
    expect(facts('5 people total in our house in Alabama.').householdSize).toBe(5);
    expect(facts('We are six: two parents and four kids.').householdSize).toBe(6);
  });

  it('counts relatives other than children and a partner', () => {
    expect(facts('It is me, my mother, and my three kids in Maryland.').householdSize).toBe(5);
    expect(facts('I am raising my niece and nephew in Tennessee on my own.').householdSize).toBe(3);
    expect(facts('My mom and dad live with me and my 2 kids.').householdSize).toBe(5);
  });

  it('reads "on my own" as one person only when nobody else is mentioned', () => {
    expect(facts('Widower, 70, by myself in Oregon.').householdSize).toBe(1);
    expect(facts('I live on my own with my daughter.').householdSize).toBe(2);
  });

  it('counts a newborn and a parent-of-N as children', () => {
    const f = facts('I live in Austin, TX with my wife and our newborn.');
    expect(f.householdSize).toBe(3);
    expect(f.childrenCount).toBe(1);
    expect(facts('Single mom of one in Florida.').householdSize).toBe(2);
  });

  it('reads amounts without a dollar sign where only money can go', () => {
    const f = facts('I earn 2400 dollars a month working retail in Ohio. I live alone and pay 850 for rent.');
    expect(f.incomeAmount).toBe(2400);
    expect(f.incomePeriod).toBe('monthly');
    expect(f.rentMonthly).toBe(850);
  });

  it('does not read a year or a street number as money', () => {
    const f = facts('Born in 1985, we live at 4500 Main St. I pay 1200 for rent and earn 3000 a month.');
    expect(f.incomeAmount).toBe(3000);
    expect(f.rentMonthly).toBe(1200);
  });
});

describe('shapes from the third held-out set', () => {
  it('reads "45k a year" with no dollar sign', () => {
    const f = facts('Me + 2 kids in Wisconsin. I make 45k a year as a CNA.');
    expect(f.incomeAmount).toBe(45000);
    expect(f.incomePeriod).toBe('annual');
  });

  it('keeps "City, State" in one clause', () => {
    const f = facts('I rent an apartment in Chicago, Illinois for $1,275 and make $2,900 a month.');
    expect(f.rentMonthly).toBe(1275);
    expect(f.incomeAmount).toBe(2900);
  });

  it('reads "hh" as household', () => {
    expect(facts('hh of 4 in Kansas, income $3,100/mo').householdSize).toBe(4);
    expect(facts('HH size: 3').householdSize).toBe(3);
  });

  it('counts a child described by age, and each child named singly', () => {
    const f = facts('I have a 2 year old son. My rent is $650.');
    expect(f.childrenCount).toBe(1);
    expect(f.householdSize).toBe(2);
    expect(facts('I live with my son and my daughter.').childrenCount).toBe(2);
  });

  it('counts an adult child in the household but not as a child', () => {
    const f = facts('I live with my husband, our adult son, and our daughter who is 12.');
    expect(f.householdSize).toBe(4);
    expect(f.childrenCount).toBe(1);
  });

  it('reads "we both work" as a partner', () => {
    expect(facts('We have 4 kids and both work in South Dakota.').householdSize).toBe(6);
  });
});

describe('shapes from the fourth held-out set', () => {
  it('reads a decimal point as a decimal point', () => {
    // The "." in "2.5k" was taken for a sentence end, which left "5k" and read $5,000.
    expect(facts('I bring in about 2.5k a month.').incomeAmount).toBe(2500);
  });

  it('tells the District from the state', () => {
    expect(facts('Washington, DC. Single, no kids.').state).toBe('District of Columbia');
    expect(facts('We live in Washington state near Seattle.').state).toBe('Washington');
  });

  it('counts kiddos and a child from an earlier relationship', () => {
    expect(facts('Me and my 4 kiddos in Portland, OR.').householdSize).toBe(5);
    const f = facts('My husband and I have 2 kids together and he has a daughter from before who lives with us.');
    expect(f.childrenCount).toBe(3);
    expect(f.householdSize).toBe(5);
  });

  it('reads fiancé with its accent', () => {
    expect(facts('My fiancé and I live in Nashville, TN with our daughter.').householdSize).toBe(3);
  });

  it('reads label-and-colon forms', () => {
    const f = facts('Rent: $1,100. Income: $2,800/month. Household: 3 people. State: Virginia.');
    expect(f.householdSize).toBe(3);
    expect(f.incomePeriod).toBe('monthly');
    expect(f.rentMonthly).toBe(1100);
  });

  it('reads housing described without the word rent', () => {
    expect(facts('My mom, my son and I share a two bedroom for $2,200 a month.').rentMonthly).toBe(2200);
  });

  it('splits two amounts joined by "and" even after a dollar sign', () => {
    const f = facts('Our monthly income is $2,450 and our rent is $1,050. We live in Georgia with our three children.');
    expect(f.incomeAmount).toBe(2450);
    expect(f.rentMonthly).toBe(1050);
    expect(f.householdSize).toBe(5);
  });
});

describe('pay twice a month', () => {
  it('is 24 paychecks a year, not 12', () => {
    // "$1,350 on the 1st and the 15th" was read as $1,350 a month, half the income.
    const f = facts('Single mom of one in Florida. I get paid $1,350 on the 1st and the 15th.');
    expect(f.incomeAmount).toBe(1350);
    expect(f.incomePeriod).toBe('semimonthly');
    expect(toMonthly(1350, 'semimonthly')).toBe(2700);
    expect(facts('My paycheck is $1,600 twice a month.').incomePeriod).toBe('semimonthly');
  });
});
