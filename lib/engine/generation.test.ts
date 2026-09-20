import { describe, expect, it } from 'vitest';

import { classify } from './generation';
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
