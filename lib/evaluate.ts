/**
 * The evaluator. Everything else calls this.
 *
 * Given a household state and a set of answers, it produces a verdict per program and
 * a dollar value for each program a household appears eligible for. It is pure: the
 * same state and answers always produce the same verdicts, which is what lets the
 * value-of-information rule ask what a different answer would be worth.
 */

import { Cents, dollars } from './money';
import {
  EitcFacts,
  FilingStatus,
  LifelineFacts,
  SnapFacts,
  Step,
  eitcCredit,
  lifelineEligibility,
  snapEligibility,
} from './compute';
import {
  Expr,
  HouseholdShape,
  InstantiatedCriterion,
  Program,
  baseId,
  instantiate,
  loadPrograms,
  parseVerdict,
} from './criteria';
import { EngineAnswer } from './engine/types';
import { ParsedFacts, Period, toMonthly } from './parse';
import {
  activeSnapSet,
  eitcThresholdsFor,
  lifelineThresholdsFor,
} from './thresholds';

export interface ScreeningState {
  paragraph: string;
  facts: ParsedFacts;
  shape: HouseholdShape;
  /** The date the screening is for. Selects every threshold table. */
  asOf: string;
}

export type Answers = Record<string, EngineAnswer>;

export interface ProgramVerdict {
  programId: string;
  name: string;
  shortName: string;
  eligible: boolean;
  annualValueCents: Cents | null;
  monthlyValueCents: Cents | null;
  decidingCriterion: string;
  tests: { name: string; passed: boolean; detail: string }[];
  steps: Step[];
  applyUrl: string;
  valueBasis: string;
  notes: string[];
}

export type Verdicts = Record<string, ProgramVerdict>;

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

interface Directives {
  categoricallyEligible: boolean;
  hasElderlyOrDisabledMember: boolean;
  earnedShare: 'all' | 'none' | 'split' | null;
  incomePeriod: Period | null;
  allMembersHomeless: boolean;
  onTribalLands: boolean;
  filingStatus: FilingStatus | null;
  excludedMembers: Set<number>;
  disqualifiedChildren: Set<number>;
  forcedPass: Set<string>;
  forcedFail: Set<string>;
  skipped: Set<string>;
}

function emptyDirectives(): Directives {
  return {
    categoricallyEligible: false,
    hasElderlyOrDisabledMember: false,
    earnedShare: null,
    incomePeriod: null,
    allMembersHomeless: false,
    onTribalLands: false,
    filingStatus: null,
    excludedMembers: new Set(),
    disqualifiedChildren: new Set(),
    forcedPass: new Set(),
    forcedFail: new Set(),
    skipped: new Set(),
  };
}

function applyDirective(d: Directives, token: string, subjectIndex: number | null): void {
  const [verb, rest] = token.split(':', 2);

  switch (verb) {
    case 'pass':
      d.forcedPass.add(rest);
      return;
    case 'fail':
      d.forcedFail.add(rest);
      return;
    case 'skip':
      d.skipped.add(rest);
      return;
    case 'require':
      // Marks another criterion as relevant. Relevance is handled by `applies`, which
      // reads the same `requires` link from the other direction, so nothing to do.
      return;
    case 'exclude_member':
      if (subjectIndex !== null) d.excludedMembers.add(subjectIndex);
      return;
    case 'disqualify_child':
      if (subjectIndex !== null) d.disqualifiedChildren.add(subjectIndex);
      return;
    case 'set': {
      const [field, value] = (rest ?? '').split('=', 2);
      switch (field) {
        case 'categoricallyEligible':
          d.categoricallyEligible = value === 'true';
          return;
        case 'hasElderlyOrDisabledMember':
          d.hasElderlyOrDisabledMember = value === 'true';
          return;
        case 'earnedShare':
          d.earnedShare = value as Directives['earnedShare'];
          return;
        case 'incomePeriod':
          d.incomePeriod = value as Period;
          return;
        case 'allMembersHomeless':
          d.allMembersHomeless = value === 'true';
          return;
        case 'onTribalLands':
          d.onTribalLands = value === 'true';
          return;
        case 'filingStatus':
          d.filingStatus = value as FilingStatus;
          return;
        default:
          // resourceLimit and shelterCap are consequences of
          // hasElderlyOrDisabledMember, which compute.ts derives itself.
          return;
      }
    }
    default:
      return;
  }
}

/** Whether a criterion applies at all, given how its prerequisites were answered. */
function applies(
  criterion: InstantiatedCriterion,
  answers: Answers,
  criteria: InstantiatedCriterion[]
): boolean {
  if (criterion.requires) {
    const prerequisite = criteria.find(
      (c) =>
        baseId(c.instanceId) === criterion.requires &&
        c.subjectIndex === criterion.subjectIndex
    );
    if (!prerequisite) return false;
    const answer = answers[prerequisite.instanceId];
    if (!answer) return false;
    if (prerequisite.type === 'noul' && answer.choice !== 'true') return false;
    if (prerequisite.type === 'choice' && answer.choice === 'none') return false;
  }

  if (criterion.skipIf) {
    const blocker = criteria.find((c) => baseId(c.instanceId) === criterion.skipIf);
    const answer = blocker ? answers[blocker.instanceId] : undefined;
    if (answer && answer.choice !== 'false' && answer.choice !== 'none') return false;
  }

  return true;
}

function collectDirectives(
  criteria: InstantiatedCriterion[],
  answers: Answers
): Directives {
  const d = emptyDirectives();

  // File order, so that a file reads top to bottom as the order things happen in.
  for (const criterion of criteria) {
    const answer = answers[criterion.instanceId];
    if (!answer) continue;
    if (!applies(criterion, answers, criteria)) continue;

    const effect = criterion.effect;
    if (!effect) continue;

    if (criterion.type === 'noul') {
      const tokens = answer.choice === 'true' ? effect.onTrue : effect.onFalse;
      for (const token of tokens ?? []) applyDirective(d, token, criterion.subjectIndex);
    }

    for (const [option, tokens] of Object.entries(effect.onOption ?? {})) {
      if (answer.choice === option) {
        for (const token of tokens) applyDirective(d, token, criterion.subjectIndex);
      }
    }
    for (const [option, tokens] of Object.entries(effect.onNot ?? {})) {
      if (answer.choice !== option) {
        for (const token of tokens) applyDirective(d, token, criterion.subjectIndex);
      }
    }
  }

  return d;
}

// ---------------------------------------------------------------------------
// Turning a state plus directives into the inputs the arithmetic needs
// ---------------------------------------------------------------------------

const SPLIT_SHARE = 0.5;

interface Income {
  monthlyCents: Cents;
  earnedMonthlyCents: Cents;
  unearnedMonthlyCents: Cents;
  notes: string[];
}

function incomeFrom(state: ScreeningState, d: Directives): Income {
  const notes: string[] = [];
  const period: Period = d.incomePeriod ?? state.facts.incomePeriod ?? 'monthly';

  if (state.facts.incomePeriod === null && d.incomePeriod === null) {
    notes.push('No period was stated for the income figure; it was read as monthly.');
  }

  const amount = state.facts.incomeAmount ?? 0;
  const monthlyCents = dollars(toMonthly(amount, period));

  let earned = 0;
  switch (d.earnedShare) {
    case 'all':
      earned = monthlyCents;
      break;
    case 'none':
      earned = 0;
      break;
    case 'split':
      earned = Math.round(monthlyCents * SPLIT_SHARE);
      notes.push(
        'The household has both earned and unearned income and the split was not ' +
          'stated, so it was divided evenly. Only the earned half attracts the 20% ' +
          'earned income deduction, so the real figure may differ.'
      );
      break;
    default:
      earned = 0;
      notes.push('The source of the income was not established; it was treated as unearned.');
  }

  return {
    monthlyCents,
    earnedMonthlyCents: earned,
    unearnedMonthlyCents: monthlyCents - earned,
    notes,
  };
}

function householdSizeFrom(state: ScreeningState, d: Directives): number {
  const base = state.facts.householdSize ?? state.shape.members.length ?? 1;
  return Math.max(1, base - d.excludedMembers.size);
}

function qualifyingChildrenFrom(state: ScreeningState, d: Directives): number {
  const children = state.shape.members.filter((m) => m.isChild).length;
  const stated = state.facts.childrenCount;
  const total = children > 0 ? children : (stated ?? 0);
  return Math.max(0, total - d.disqualifiedChildren.size);
}

// ---------------------------------------------------------------------------
// Verdict expressions
// ---------------------------------------------------------------------------

function evalExpr(expr: Expr, value: (name: string) => boolean): boolean {
  switch (expr.kind) {
    case 'ref':
      return value(expr.name);
    case 'not':
      return !evalExpr(expr.of, value);
    case 'and':
      return evalExpr(expr.left, value) && evalExpr(expr.right, value);
    case 'or':
      return evalExpr(expr.left, value) || evalExpr(expr.right, value);
  }
}

function criterionTruth(
  program: Program,
  name: string,
  criteria: InstantiatedCriterion[],
  answers: Answers
): boolean {
  const wanted = `${program.id}.${name}`;
  const instances = criteria.filter((c) => baseId(c.instanceId) === wanted);
  if (instances.length === 0) return false;

  // A per-member criterion is true for the household when it holds of any member.
  return instances.some((instance) => {
    const answer = answers[instance.instanceId];
    if (!answer) return false;
    if (instance.type === 'noul') return answer.choice === 'true';
    return answer.choice !== 'none';
  });
}

// ---------------------------------------------------------------------------
// The evaluator
// ---------------------------------------------------------------------------

export function evaluate(state: ScreeningState, answers: Answers): Verdicts {
  const programs = loadPrograms();
  const criteria = instantiate(programs, state.shape);
  const d = collectDirectives(criteria, answers);

  const size = householdSizeFrom(state, d);
  const income = incomeFrom(state, d);
  const verdicts: Verdicts = {};

  for (const program of programs) {
    const computed: Record<string, boolean> = {};
    let tests: ProgramVerdict['tests'] = [];
    let steps: Step[] = [];
    let annualValueCents: Cents | null = null;
    let monthlyValueCents: Cents | null = null;
    let decidedBy = 'verdict expression';
    const notes = [...income.notes];

    if (program.id === 'snap') {
      const active = activeSnapSet(state.asOf);
      if (active.notice) notes.push(active.notice);

      const facts: SnapFacts = {
        householdSize: size,
        earnedMonthlyCents: income.earnedMonthlyCents,
        unearnedMonthlyCents: income.unearnedMonthlyCents,
        medicalMonthlyCents: criterionTruth(program, 'medical_expenses', criteria, answers)
          ? dollars(state.facts.medicalMonthly ?? 0)
          : 0,
        dependentCareMonthlyCents: criterionTruth(program, 'dependent_care_paid', criteria, answers)
          ? dollars(state.facts.dependentCareMonthly ?? 0)
          : 0,
        childSupportPaidMonthlyCents: criterionTruth(program, 'child_support_paid', criteria, answers)
          ? dollars(state.facts.childSupportMonthly ?? 0)
          : 0,
        shelterMonthlyCents:
          dollars(state.facts.rentMonthly ?? 0) +
          (criterionTruth(program, 'utilities_paid_separately', criteria, answers)
            ? dollars(state.facts.utilitiesMonthly ?? 0)
            : 0),
        hasElderlyOrDisabledMember:
          d.hasElderlyOrDisabledMember ||
          criterionTruth(program, 'member_elderly_or_disabled', criteria, answers),
        allMembersHomeless: d.allMembersHomeless,
        countableResourcesCents: dollars(state.facts.savings ?? 0),
        categoricallyEligible: d.categoricallyEligible,
      };

      const result = snapEligibility(facts, active.set);
      steps = result.steps;
      tests = result.tests;
      annualValueCents = result.annualValueCents;
      monthlyValueCents = result.monthlyBenefitCents;
      decidedBy = result.decidedBy;
      if (result.benefitUnavailableReason) notes.push(result.benefitUnavailableReason);

      computed['gross_income_test'] =
        tests.find((t) => t.name === 'Gross income test')?.passed ?? true;
      computed['net_income_test'] = tests.find((t) => t.name === 'Net income test')?.passed ?? false;
      computed['resource_test'] = tests.find((t) => t.name === 'Resource test')?.passed ?? true;
      computed['categorical'] = d.categoricallyEligible;
    } else if (program.id === 'eitc') {
      const t = eitcThresholdsFor(state.asOf);
      const claimantAge = state.facts.ages.length > 0 ? Math.max(...state.facts.ages) : null;

      const facts: EitcFacts = {
        earnedAnnualCents: income.earnedMonthlyCents * 12,
        agiAnnualCents: income.monthlyCents * 12,
        qualifyingChildren: qualifyingChildrenFrom(state, d),
        filingStatus: d.filingStatus ?? 'other',
        investmentIncomeAnnualCents: 0,
        claimantAge,
        marriedFilingSeparatelyIneligible: d.forcedFail.has('eitc'),
      };

      const result = eitcCredit(facts, t);
      steps = result.steps;
      tests = result.tests;
      annualValueCents = result.annualValueCents;
      monthlyValueCents = annualValueCents === null ? null : Math.round(annualValueCents / 12);
      decidedBy = result.decidedBy;

      computed['income_limit_test'] = tests.find((t) => t.name === 'Income limit')?.passed ?? false;
      computed['credit_above_zero'] = result.eligible;
    } else if (program.id === 'lifeline') {
      const t = lifelineThresholdsFor(state.asOf);
      const received = t.qualifyingPrograms.filter((p) =>
        criterionTruth(program, `receives_${p === 'fpha' ? 'fpha' : p}`, criteria, answers)
      );

      // SNAP eligibility found in this same pass is itself a Lifeline qualifier.
      if (verdicts['snap']?.eligible && !received.includes('snap')) {
        received.push('snap');
        notes.push('Qualifies through the SNAP eligibility found in this same screening.');
      }

      const facts: LifelineFacts = {
        householdSize: size,
        annualIncomeCents: income.monthlyCents * 12,
        programsReceived: received,
        onTribalLands: d.onTribalLands,
      };

      const result = lifelineEligibility(facts, t);
      tests = result.tests;
      annualValueCents = result.annualValueCents;
      monthlyValueCents = result.monthlyBenefitCents;
      decidedBy = result.decidedBy;
      computed['income_test'] = tests.find((t) => t.name === 'Income test')?.passed ?? false;
    }

    const truth = (name: string): boolean =>
      name in computed ? computed[name] : criterionTruth(program, name, criteria, answers);

    let eligible = evalExpr(parseVerdict(program.verdict), truth);
    if (d.forcedFail.has(program.id)) {
      eligible = false;
      decidedBy = 'a disqualifying answer';
    } else if (d.forcedPass.has(program.id)) {
      eligible = true;
    }

    // A program can be eligible on the rules and still be worth nothing.
    if (eligible && annualValueCents !== null && annualValueCents <= 0) {
      eligible = false;
      decidedBy = 'a benefit that computes to zero';
    }

    verdicts[program.id] = {
      programId: program.id,
      name: program.name,
      shortName: program.shortName,
      eligible,
      annualValueCents: eligible ? annualValueCents : null,
      monthlyValueCents: eligible ? monthlyValueCents : null,
      decidingCriterion: decidedBy,
      tests,
      steps,
      applyUrl: program.applyUrl,
      valueBasis: program.valueBasis,
      notes,
    };
  }

  return verdicts;
}

export function totalAnnualValue(verdicts: Verdicts): Cents {
  return Object.values(verdicts).reduce(
    (sum, v) => sum + (v.eligible ? (v.annualValueCents ?? 0) : 0),
    0
  );
}
