import { describe, expect, it } from 'vitest';

import { classify, GenerationEngine, answerSchema, safeKeys } from './generation';
import type { EngineQuestion } from './types';

const QUESTIONS: Record<string, EngineQuestion> = {
  'snap.categorical': {
    type: 'choice',
    instructions: '',
    criteria: { ssi: 'a', tanf: 'b', ga: 'c', none: 'd' },
  },
  'snap.income_period': {
    type: 'choice',
    instructions: '',
    criteria: { weekly: 'a', biweekly: 'b', monthly: 'c', annual: 'd' },
  },
  'lifeline.receives_snap': { type: 'noul', instructions: '', criteria: { true: 'a', false: 'b' } },
};

describe('generation faults a schema validator cannot see', () => {
  it('accepts an option that belongs to the criterion', () => {
    const { answers, faults } = classify(
      {
        'snap.categorical': { choice: 'ssi', confidence: 0.9 },
        'snap.income_period': { choice: 'monthly', confidence: 0.8 },
        'lifeline.receives_snap': { choice: 'true', confidence: 0.7 },
      },
      QUESTIONS
    );
    expect(Object.values(faults).every((n) => n === 0)).toBe(true);
    expect(answers['snap.categorical'].choice).toBe('ssi');
    expect(answers['snap.categorical'].selfReportedConfidence).toBe(0.9);
  });

  it('catches an option borrowed from another criterion', () => {
    // Valid JSON. Valid option id. Wrong criterion. A validator checking only the
    // shape of the document passes this without complaint.
    const { answers, faults } = classify(
      {
        'snap.categorical': { choice: 'weekly', confidence: 0.95 },
        'snap.income_period': { choice: 'monthly' },
        'lifeline.receives_snap': { choice: 'false' },
      },
      QUESTIONS
    );
    expect(faults.crossWired).toBe(1);
    expect(answers['snap.categorical'].fault).toBe('crossWired');
    expect(answers['snap.categorical'].borrowedFrom).toBe('snap.income_period');
    // The model was confident about the answer it got structurally wrong.
    expect(answers['snap.categorical'].selfReportedConfidence).toBe(0.95);
  });

  it('catches an invented option that belongs to no criterion', () => {
    const { faults } = classify({ 'snap.categorical': { choice: 'medicaid' } }, QUESTIONS);
    expect(faults.invented).toBe(1);
  });

  it('catches a criterion left unanswered', () => {
    const { faults } = classify({ 'snap.categorical': { choice: 'none' } }, QUESTIONS);
    expect(faults.missing).toBe(2);
  });

  it('accepts a bare string answer as a choice', () => {
    const { answers, faults } = classify(
      { 'snap.categorical': 'none', 'snap.income_period': 'weekly', 'lifeline.receives_snap': 'true' },
      QUESTIONS
    );
    expect(faults.crossWired).toBe(0);
    expect(answers['snap.categorical'].choice).toBe('none');
    expect(answers['snap.categorical'].selfReportedConfidence).toBeNull();
  });
});

describe('structured outputs', () => {
  const qs = {
    'eitc.child_age#1': { type: 'choice' as const, instructions: 'age', criteria: { under_17: 'a', over_17: 'b' } },
    'snap.works': { type: 'noul' as const, instructions: 'works', criteria: { true: 'yes', false: 'no' } },
  };

  it('maps ids with # to safe keys and back', () => {
    const { toSafe, toId } = safeKeys(Object.keys(qs));
    expect(toSafe.get('eitc.child_age#1')).toBe('eitc.child_age_1');
    expect(toId.get('eitc.child_age_1')).toBe('eitc.child_age#1');
  });

  it('restricts every answer to its own options and requires all of them', () => {
    const { toSafe } = safeKeys(Object.keys(qs));
    const schema = answerSchema(qs, toSafe) as {
      required: string[];
      properties: Record<string, { properties: { choice: { enum: string[] } } }>;
    };
    expect(schema.required).toEqual(['eitc.child_age_1', 'snap.works']);
    expect(schema.properties['eitc.child_age_1'].properties.choice.enum).toEqual(['under_17', 'over_17']);
    expect(schema.properties['snap.works'].properties.choice.enum).toEqual(['true', 'false']);
  });
});

describe('the baseline behind the engine interface', () => {
  const stub = (answers: Record<string, unknown>) =>
    ({
      model: 'stub',
      run: async (_s: string, questions: Record<string, unknown>) => ({
        model: 'stub',
        elapsedMs: 1,
        usage: { inputTokens: 10, outputTokens: 5 },
        parsed: true,
        structured: true,
        ...classify(answers, questions as never),
      }),
    }) as never;

  const questions = {
    a: { type: 'choice' as const, instructions: '', criteria: { x: '', y: '', z: '' } },
    b: { type: 'noul' as const, instructions: '', criteria: { true: '', false: '' } },
  };

  it('gives the chosen option its stated confidence and splits the rest', async () => {
    const engine = new GenerationEngine(stub({ a: { choice: 'y', confidence: 0.7 }, b: { choice: 'true', confidence: 0.9 } }));
    const r = await engine.ask({ state: '', questions });
    expect(r.answers.a.choice).toBe('y');
    expect(r.answers.a.probabilities.y).toBeCloseTo(0.7);
    expect(r.answers.a.probabilities.x).toBeCloseTo(0.15);
    expect(r.answers.b.probabilities.true).toBeCloseTo(0.9);
  });

  it('never lets a low stated confidence flip the choice', async () => {
    const engine = new GenerationEngine(stub({ a: { choice: 'z', confidence: 0.1 }, b: { choice: 'false', confidence: 0.2 } }));
    const r = await engine.ask({ state: '', questions });
    expect(r.answers.a.choice).toBe('z');
    expect(r.answers.b.choice).toBe('false');
  });

  it('treats a missing answer as unknown and counts the fault', async () => {
    const engine = new GenerationEngine(stub({ a: { choice: 'x', confidence: 1 } }));
    const r = await engine.ask({ state: '', questions });
    expect(r.answers.b.confidence).toBe(0);
    expect(engine.faultTotals.missing).toBe(1);
  });
});
