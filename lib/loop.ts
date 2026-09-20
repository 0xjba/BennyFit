/**
 * The elicitation loop.
 *
 * One request resolves every criterion of every program against one state. If nothing
 * is both uncertain and load-bearing, the loop stops and the verdicts stand. Otherwise
 * it asks the single question worth the most, appends the answer to the state, and
 * re-reads everything.
 *
 * The re-read is a full re-read, not a patch of the one criterion that was asked
 * about. That is deliberate: one fact can settle criteria across several programs at
 * once, and a household that says yes to SSI has just answered a SNAP question and a
 * Lifeline question in the same breath. It is also cheap, because the whole point of a
 * typed readout is that re-reading every criterion is one batched pass rather than one
 * generation per criterion.
 */

import { Cents } from './money';
import {
  HouseholdShape,
  InstantiatedCriterion,
  Program,
  instantiate,
  loadPrograms,
} from './criteria';
import { EngineClient, EngineQuestion, EngineRequest } from './engine/types';
import { Answers, ScreeningState, Verdicts, evaluate, totalAnnualValue } from './evaluate';
import { ParseResult, parseHousehold } from './parse';
import { Candidate, nextQuestion, reasonFor } from './voi';

export const DEFAULT_TAU = 0.5;
export const DEFAULT_MAX_QUESTIONS = 3;

export interface AskedQuestion {
  instanceId: string;
  question: string;
  reason: string;
  reply: string;
  voiSpreadCents: Cents;
  programsAffected: number;
  confidenceBefore: number;
}

export interface Pass {
  index: number;
  criteriaEvaluated: number;
  engineElapsedMs: number;
  lowConfidenceCount: number;
  totalAnnualValueCents: Cents;
}

export interface ScreenResult {
  state: ScreeningState;
  parse: ParseResult;
  criteria: InstantiatedCriterion[];
  answers: Answers;
  verdicts: Verdicts;
  asked: AskedQuestion[];
  passes: Pass[];
  engine: string;
  isFixture: boolean;
  tau: number;
  maxQuestions: number;
  totalElapsedMs: number;
  totalAnnualValueCents: Cents;
}

/**
 * Work out who is in the household, so per-member criteria can be instantiated.
 *
 * Labels are positional rather than invented: the description rarely names anyone, and
 * a made-up name in a question would be worse than none.
 */
export function shapeOf(parse: ParseResult): HouseholdShape {
  const size = parse.facts.householdSize ?? 1;
  const children = Math.min(parse.facts.childrenCount ?? 0, Math.max(0, size - 1));
  const adults = Math.max(1, size - children);

  const members: HouseholdShape['members'] = [];
  for (let i = 0; i < adults; i++) {
    members.push({ label: i === 0 ? 'the person describing the household' : `adult ${i + 1}`, isChild: false });
  }
  for (let i = 0; i < children; i++) {
    members.push({ label: children === 1 ? 'the child' : `child ${i + 1}`, isChild: true });
  }
  return { members };
}

/**
 * The state string the engine reads.
 *
 * Every figure here has already been computed. The engine is never shown a raw weekly
 * wage and asked what it comes to monthly; it is shown the monthly figure and asked
 * only about facts a reader could confirm from the narrative.
 */
export function renderState(
  paragraph: string,
  parse: ParseResult,
  replies: { question: string; reply: string }[]
): string {
  const f = parse.facts;
  const lines: string[] = ['The household described, in their own words:', '', paragraph.trim(), ''];

  const computed: string[] = [];
  if (f.householdSize !== null) computed.push(`Household size: ${f.householdSize}`);
  if (f.incomeAmount !== null) {
    const period = f.incomePeriod ?? 'unstated period';
    computed.push(`Stated income: $${f.incomeAmount.toLocaleString('en-US')} per ${period}`);
  }
  if (f.rentMonthly !== null) computed.push(`Monthly housing cost: $${Math.round(f.rentMonthly)}`);
  if (f.utilitiesMonthly !== null) computed.push(`Monthly utilities: $${Math.round(f.utilitiesMonthly)}`);
  if (f.ages.length > 0) computed.push(`Ages mentioned: ${f.ages.join(', ')}`);
  if (f.childrenCount !== null) computed.push(`Children mentioned: ${f.childrenCount}`);
  if (f.savings !== null) computed.push(`Savings mentioned: $${Math.round(f.savings)}`);

  if (computed.length > 0) {
    lines.push('Figures already established from the description:', ...computed.map((c) => `- ${c}`), '');
  }

  if (replies.length > 0) {
    lines.push('Answers the household gave when asked:');
    // Question and answer are labelled rather than run together, so a reader can tell
    // which words came from the household and which came from the question put to
    // them. The local fixture relies on that distinction; a real engine does not need
    // it, but it costs nothing and makes the state easier to read.
    for (const r of replies) lines.push(`- Q: ${r.question}\n  A: ${r.reply}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function buildRequest(state: string, criteria: InstantiatedCriterion[]): EngineRequest {
  const questions: Record<string, EngineQuestion> = {};
  for (const c of criteria) {
    questions[c.instanceId] = {
      type: c.type,
      instructions: c.instructions,
      criteria: c.criteria,
    };
  }
  return { state, questions };
}

export interface ScreenOptions {
  engine: EngineClient;
  /** Returns the household's reply to a question, or null to skip it. */
  askUser: (question: string, criterion: InstantiatedCriterion) => Promise<string | null>;
  asOf?: string;
  tau?: number;
  maxQuestions?: number;
  /** Called after every pass, for interfaces that show the loop running. */
  onPass?: (pass: Pass, answers: Answers, verdicts: Verdicts) => void;
}

export async function screen(paragraph: string, options: ScreenOptions): Promise<ScreenResult> {
  const startedAt = performance.now();
  const tau = options.tau ?? DEFAULT_TAU;
  const maxQuestions = options.maxQuestions ?? DEFAULT_MAX_QUESTIONS;
  const asOf = options.asOf ?? new Date().toISOString().slice(0, 10);

  const parse = parseHousehold(paragraph);
  const shape = shapeOf(parse);
  const programs: Program[] = loadPrograms();
  const criteria = instantiate(programs, shape);
  const programNames = Object.fromEntries(programs.map((p) => [p.id, p.shortName]));

  const replies: { question: string; reply: string }[] = [];
  const asked: AskedQuestion[] = [];
  const askedIds = new Set<string>();
  const passes: Pass[] = [];

  let state: ScreeningState = {
    paragraph,
    facts: parse.facts,
    shape,
    asOf,
  };

  let stateText = renderState(paragraph, parse, replies);
  let response = await options.engine.ask(buildRequest(stateText, criteria));
  let answers: Answers = response.answers;
  let verdicts = evaluate(state, answers);

  const recordPass = (elapsed: number) => {
    const pass: Pass = {
      index: passes.length,
      criteriaEvaluated: criteria.length,
      engineElapsedMs: elapsed,
      lowConfidenceCount: Object.values(answers).filter((a) => a.confidence < tau).length,
      totalAnnualValueCents: totalAnnualValue(verdicts),
    };
    passes.push(pass);
    options.onPass?.(pass, answers, verdicts);
  };

  recordPass(response.elapsedMs);

  while (asked.length < maxQuestions) {
    const candidate: Candidate | null = nextQuestion(state, answers, criteria, {
      tau,
      asked: askedIds,
    });
    if (!candidate) break;

    const question = candidate.criterion.askIfUnsure;
    const reply = await options.askUser(question, candidate.criterion);

    // A skipped question is still a question that was put, and must not be put again.
    askedIds.add(candidate.criterion.instanceId);
    if (reply === null) continue;

    replies.push({ question, reply });
    asked.push({
      instanceId: candidate.criterion.instanceId,
      question,
      reason: reasonFor(candidate, programNames),
      reply,
      voiSpreadCents: candidate.voi.spreadCents,
      programsAffected: candidate.voi.programsAffected,
      confidenceBefore: candidate.confidence,
    });

    stateText = renderState(paragraph, parse, replies);
    response = await options.engine.ask(buildRequest(stateText, criteria));
    answers = response.answers;
    verdicts = evaluate(state, answers);
    recordPass(response.elapsedMs);
  }

  return {
    state,
    parse,
    criteria,
    answers,
    verdicts,
    asked,
    passes,
    engine: options.engine.name,
    isFixture: options.engine.isFixture,
    tau,
    maxQuestions,
    totalElapsedMs: performance.now() - startedAt,
    totalAnnualValueCents: totalAnnualValue(verdicts),
  };
}
