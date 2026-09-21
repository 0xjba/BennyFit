import { describe, expect, it } from 'vitest';

import { parseHousehold } from './parse';

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
