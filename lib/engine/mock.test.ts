import { describe, expect, it } from 'vitest';

import { MockEngine } from './mock';

const engine = new MockEngine();

async function ask(state: string, id: string, criteria: Record<string, string>) {
  const response = await engine.ask({ state, questions: { [id]: { type: 'noul', instructions: '', criteria } } });
  return response.answers[id];
}

const YES_NO = { true: 'yes', false: 'no' };

describe('the fixture follows negation', () => {
  it('reads a negated cue as absent', async () => {
    const positive = await ask('  A: I have $4,000 saved.', 'snap.resources_over_limit', YES_NO);
    const negative = await ask('  A: No, I have nothing saved.', 'snap.resources_over_limit', YES_NO);
    expect(positive.choice).toBe('true');
    expect(negative.choice).toBe('false');
  });

  it('reads a negated investment mention as no investment income', async () => {
    const answer = await ask('  A: No, I have no investments.', 'eitc.investment_income_over_limit', YES_NO);
    expect(answer.choice).toBe('false');
  });

  it('still reads an unnegated cue as present', async () => {
    const answer = await ask('  A: I made about $3,000 from investments.', 'eitc.investment_income_over_limit', YES_NO);
    expect(answer.choice).toBe('true');
  });

  it('ignores the text of the question put to the household', async () => {
    // The question names every cue that would answer it affirmatively.
    const state = '- Q: Does everyone in your household get SSI, TANF, or General Assistance?\n  A: No, none of us get any of those.';
    const answer = await engine.ask({
      state,
      questions: {
        'snap.categorical': {
          type: 'choice',
          instructions: '',
          criteria: { ssi: 'a', tanf: 'b', ga: 'c', none: 'd' },
        },
      },
    });
    expect(answer.answers['snap.categorical'].choice).toBe('none');
  });

  it('is deterministic for a given state', async () => {
    const a = await ask('  A: I work full time.', 'eitc.has_earned_income', YES_NO);
    const b = await ask('  A: I work full time.', 'eitc.has_earned_income', YES_NO);
    expect(a.probabilities).toEqual(b.probabilities);
  });
});
