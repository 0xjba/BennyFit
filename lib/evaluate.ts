/**
 * The evaluator. Everything else calls this.
 *
 * Given a household state and a set of answers, it produces a verdict per program and
 * a dollar value for each program a household appears eligible for. It is pure: the
 * same state and answers always produce the same verdicts, which is what lets the
 * value-of-information rule ask what a different answer would be worth.
 */

import { Cents, dollars, formatDollars as formatCents } from './money';
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
  ctcThresholdsFor,
  eitcThresholdsFor,
  fpgProgramConfig,
  lifelineThresholdsFor,
  medicareThresholdsFor,
  povertyGuidelines,
  stateRulesFor,
} from './thresholds';
import {
  childTaxCredit,
  extraHelpEligibility,
  fpgAnnual,
  fpgThresholdEligibility,
  medicareSavingsEligibility,
} from './compute-programs';

export interface ScreeningState {
  paragraph: string;
  facts: ParsedFacts;
  shape: HouseholdShape;
  /** The date the screening is for. Selects every threshold table. */
  asOf: string;
  /** Confidence at or above which an answer counts as settled. */
  tau?: number;
}

export const DEFAULT_PRESUMPTION_TAU = 0.5;

/**
 * The option a criterion should be treated as having, and whether that came from the
 * engine or from a presumption.
 *
 * An engine that is not confident about a criterion carrying a presumption is
 * overridden by it. The engine's own distribution is left untouched, so the interface
 * can still show what it actually read, and the value-of-information rule still sees
 * the criterion as unsettled and can choose to ask about it.
 */
export function effectiveChoice(
  criterion: { presumption?: string },
  answer: EngineAnswer,
  tau: number
): { choice: string; presumed: boolean } {
  if (criterion.presumption !== undefined && answer.confidence < tau) {
    return { choice: criterion.presumption, presumed: true };
  }
  return { choice: answer.choice, presumed: false };
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
  /** Set only by the separated-spouse criterion, never by any other disqualifier. */
  separatedSpouseRulesFailed: boolean;
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
    separatedSpouseRulesFailed: false,
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
  criteria: InstantiatedCriterion[],
  tau: number
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
    const { choice } = effectiveChoice(prerequisite, answer, tau);
    if (criterion.requiresOption !== undefined) return choice === criterion.requiresOption;
    if (prerequisite.type === 'noul' && choice !== 'true') return false;
    if (prerequisite.type === 'choice' && choice === 'none') return false;
  }

  if (criterion.skipIf) {
    const blocker = criteria.find((c) => baseId(c.instanceId) === criterion.skipIf);
    const answer = blocker ? answers[blocker.instanceId] : undefined;
    if (answer && blocker) {
      const { choice } = effectiveChoice(blocker, answer, tau);
      if (choice !== 'false' && choice !== 'none') return false;
    }
  }

  return true;
}

function collectDirectives(
  criteria: InstantiatedCriterion[],
  answers: Answers,
  tau: number
): Directives {
  const d = emptyDirectives();

  // File order, so that a file reads top to bottom as the order things happen in.
  for (const criterion of criteria) {
    const answer = answers[criterion.instanceId];
    if (!answer) continue;
    if (!applies(criterion, answers, criteria, tau)) continue;

    const effect = criterion.effect;
    if (!effect) continue;

    const { choice } = effectiveChoice(criterion, answer, tau);

    // Recorded separately from the generic disqualifier, so that the reason shown to
    // a household names what actually barred them. Reusing the shared fail set here
    // made a household with no earned income get told they were barred as a married
    // separate filer.
    if (criterion.id === 'eitc.separated_spouse_rules' && choice === 'false') {
      d.separatedSpouseRulesFailed = true;
    }

    if (criterion.type === 'noul') {
      const tokens = choice === 'true' ? effect.onTrue : effect.onFalse;
      for (const token of tokens ?? []) applyDirective(d, token, criterion.subjectIndex);
    }

    for (const [option, tokens] of Object.entries(effect.onOption ?? {})) {
      if (choice === option) {
        for (const token of tokens) applyDirective(d, token, criterion.subjectIndex);
      }
    }
    for (const [option, tokens] of Object.entries(effect.onNot ?? {})) {
      if (choice !== option) {
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
  // The parser wins whenever it read an explicit period out of the description.
  // Converting a weekly figure to a monthly one is arithmetic, and arithmetic is not
  // delegated to the engine; the criterion exists to fill the gap when the description
  // never said, not to overrule a period that was stated in plain words.
  const period: Period = state.facts.incomePeriod ?? d.incomePeriod ?? 'monthly';

  if (state.facts.incomePeriod === null) {
    notes.push(
      d.incomePeriod === null
        ? 'No period was stated for the income figure; it was read as monthly.'
        : `No period was stated for the income figure; it was taken as ${d.incomePeriod}.`
    );
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
  answers: Answers,
  tau: number
): boolean {
  const wanted = `${program.id}.${name}`;
  const instances = criteria.filter((c) => baseId(c.instanceId) === wanted);
  if (instances.length === 0) return false;

  // A per-member criterion is true for the household when it holds of any member.
  return instances.some((instance) => {
    const answer = answers[instance.instanceId];
    if (!answer) return false;
    const { choice } = effectiveChoice(instance, answer, tau);
    if (instance.type === 'noul') return choice === 'true';
    return choice !== 'none';
  });
}

// ---------------------------------------------------------------------------
// The evaluator
// ---------------------------------------------------------------------------

/**
 * The order programs are evaluated in.
 *
 * Lifeline can qualify through SNAP enrollment, so SNAP has to have a verdict before
 * Lifeline is evaluated. Relying on the order the files happen to load in would make
 * that silently break the day someone reorders them.
 */
const EVALUATION_ORDER = [
  // SNAP first: several programs treat SNAP enrolment as automatic income eligibility,
  // and Lifeline qualifies through it outright.
  'snap',
  'eitc',
  'ctc',
  'lifeline',
  'wic',
  'school_meals',
  'csfp',
  'liheap',
  'head_start',
  'medicare_savings',
  'extra_help',
  'medicaid',
  // Follows the federal credit it is a percentage of, so it is evaluated last.
  'state_eitc',
];

/** How many children satisfy every one of the named per-child criteria. */
function childrenPassing(
  program: Program,
  names: string[],
  criteria: InstantiatedCriterion[],
  answers: Answers,
  tau: number,
  state: ScreeningState,
  d: Directives
): number {
  const childIndexes = state.shape.members
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.isChild)
    .map(({ i }) => i)
    .filter((i) => !d.disqualifiedChildren.has(i));

  return childIndexes.filter((index) =>
    names.every((name) => {
      const instance = criteria.find(
        (c) => c.id === `${program.id}.${name}` && c.subjectIndex === index
      );
      if (!instance) return true;
      const answer = answers[instance.instanceId];
      if (!answer) return true;
      return effectiveChoice(instance, answer, tau).choice === 'true';
    })
  ).length;
}

/**
 * Programs the household already receives, which several others treat as automatic
 * income eligibility. Anything found eligible earlier in this same pass counts.
 */
function receivedPrograms(
  verdicts: Verdicts,
  d: Directives,
  criteria: InstantiatedCriterion[],
  answers: Answers,
  tau: number
): string[] {
  const received = new Set<string>();

  for (const [programId, verdict] of Object.entries(verdicts)) {
    if (verdict.eligible) received.add(programId);
  }
  if (d.categoricallyEligible) received.add('tanf');

  for (const criterion of criteria) {
    const answer = answers[criterion.instanceId];
    if (!answer) continue;
    const { choice } = effectiveChoice(criterion, answer, tau);

    if (criterion.id === 'snap.categorical' && choice !== 'none') received.add(choice);
    if (criterion.id === 'wic.receives_qualifying' && choice !== 'none') received.add(choice);
    if (criterion.id === 'head_start.categorical' && choice === 'public_assistance') {
      received.add('tanf');
    }
    if (criterion.id.startsWith('lifeline.receives_') && choice === 'true') {
      received.add(criterion.id.replace('lifeline.receives_', ''));
    }
  }

  return [...received];
}

export function evaluate(state: ScreeningState, answers: Answers): Verdicts {
  const stateRules = stateRulesFor(state.facts.state, state.asOf);
  const programs = [...loadPrograms()].sort((a, b) => {
    const ai = EVALUATION_ORDER.indexOf(a.id);
    const bi = EVALUATION_ORDER.indexOf(b.id);
    return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi);
  });
  const criteria = instantiate(programs, state.shape);
  const tau = state.tau ?? DEFAULT_PRESUMPTION_TAU;
  const d = collectDirectives(criteria, answers, tau);

  const size = householdSizeFrom(state, d);
  const income = incomeFrom(state, d);
  const verdicts: Verdicts = {};

  for (const program of programs) {
    const computed: Record<string, boolean> = {};
    let tests: ProgramVerdict['tests'] = [];
    let steps: Step[] = [];
    let annualValueCents: Cents | null = null;
    let monthlyValueCents: Cents | null = null;
    let decidedBy = 'the verdict expression';
    const notes = [...income.notes];

    if (program.id === 'snap') {
      const active = activeSnapSet(state.asOf);
      if (active.notice) notes.push(active.notice);

      const facts: SnapFacts = {
        householdSize: size,
        earnedMonthlyCents: income.earnedMonthlyCents,
        unearnedMonthlyCents: income.unearnedMonthlyCents,
        medicalMonthlyCents: criterionTruth(program, 'medical_expenses', criteria, answers, tau)
          ? dollars(state.facts.medicalMonthly ?? 0)
          : 0,
        dependentCareMonthlyCents: criterionTruth(program, 'dependent_care_paid', criteria, answers, tau)
          ? dollars(state.facts.dependentCareMonthly ?? 0)
          : 0,
        childSupportPaidMonthlyCents: criterionTruth(program, 'child_support_paid', criteria, answers, tau)
          ? dollars(state.facts.childSupportMonthly ?? 0)
          : 0,
        shelterMonthlyCents:
          dollars(state.facts.rentMonthly ?? 0) +
          (criterionTruth(program, 'utilities_paid_separately', criteria, answers, tau)
            ? dollars(state.facts.utilitiesMonthly ?? 0)
            : 0),
        hasElderlyOrDisabledMember:
          d.hasElderlyOrDisabledMember ||
          criterionTruth(program, 'member_elderly_or_disabled', criteria, answers, tau),
        allMembersHomeless: d.allMembersHomeless,
        countableResourcesCents: dollars(state.facts.savings ?? 0),
        categoricallyEligible: d.categoricallyEligible,
      };

      const result = snapEligibility(
        facts,
        active.set,
        stateRules
          ? {
              name: state.facts.state!,
              grossLimitPct: stateRules.snap.grossLimitPct,
              assetLimit: stateRules.snap.assetLimit,
              assetTestApplies: stateRules.snap.assetTestApplies,
              usesFederalRules: stateRules.snap.usesFederalRules,
              annualGuideline: fpgAnnual(povertyGuidelines(), size),
            }
          : undefined
      );
      if (!stateRules) {
        notes.push(
          'No state was named, so federal minimum rules were used. Most states set a ' +
            'higher income limit than this, so naming your state may change the answer.'
        );
      } else if (!stateRules.snap.usesFederalRules) {
        const raised = stateRules.snap.grossLimitPct > 130;
        const noAssets = !stateRules.snap.assetTestApplies;
        notes.push(
          raised
            ? `${state.facts.state} raises the SNAP income limit to ${stateRules.snap.grossLimitPct}% of the ` +
              `poverty guideline` + (noAssets ? ' and applies no asset limit.' : '.')
            : noAssets
              ? `${state.facts.state} keeps the federal income limit but applies no asset limit.`
              : `${state.facts.state} applies the federal income limit.`
        );
      }
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
        marriedFilingSeparatelyIneligible: d.separatedSpouseRulesFailed,
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
        criterionTruth(program, `receives_${p === 'fpha' ? 'fpha' : p}`, criteria, answers, tau)
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
    } else if (program.ruleType === 'ctc') {
      const t = ctcThresholdsFor(state.asOf);
      const qualifying = childrenPassing(program, ['child_under_17', 'child_ssn'], criteria, answers, tau, state, d);
      const result = childTaxCredit(
        {
          qualifyingChildren: qualifying,
          agiAnnualCents: income.monthlyCents * 12,
          filingStatus: d.filingStatus ?? 'other',
        },
        t
      );
      steps = result.steps;
      tests = result.tests;
      annualValueCents = result.annualValueCents;
      monthlyValueCents = result.monthlyValueCents;
      decidedBy = result.decidedBy;
      if (result.valueNote) notes.push(result.valueNote);
      computed['qualifying_children'] = qualifying > 0;
      computed['income_test'] = result.eligible;
    } else if (program.ruleType === 'medicaid') {
      const guideline = fpgAnnual(povertyGuidelines(), size);
      const covered = stateRules?.medicaid.covered ?? false;
      const limitPct = stateRules?.medicaid.limitPct ?? null;
      const limit = limitPct === null ? null : dollars(Math.round((guideline * limitPct) / 100));
      const annualIncome = income.monthlyCents * 12;
      const incomeOk = limit !== null && annualIncome <= limit;

      tests = [
        {
          name: 'Coverage in this state',
          passed: covered,
          detail: stateRules
            ? (stateRules.medicaid.note ??
              `${state.facts.state} covers adults to ${limitPct}% of the poverty guideline`)
            : 'no state was named, so this could not be decided',
        },
        {
          name: 'Income test',
          passed: incomeOk,
          detail:
            limit === null
              ? 'no income limit applies because this state has not expanded coverage'
              : `${formatCents(annualIncome)} a year against a ${formatCents(limit)} limit (${limitPct}% of poverty)`,
        },
      ];
      decidedBy = !covered ? 'this state not having expanded coverage' : 'the income test';
      computed['covered_in_state'] = covered;
      computed['income_test'] = incomeOk;
      if (covered && incomeOk) {
        notes.push(
          'Comprehensive health coverage rather than a payment, so no dollar figure is ' +
            'estimated here.'
        );
      }
      if (stateRules?.medicaid.note) notes.push(stateRules.medicaid.note);
    } else if (program.ruleType === 'stateEitc') {
      const rate = stateRules?.eitc?.rate ?? null;
      const federal = verdicts['eitc'];
      const federalValue = federal?.eligible ? (federal.annualValueCents ?? 0) : 0;
      const credit = rate === null ? 0 : Math.round(federalValue * rate);

      tests = [
        {
          name: 'State has its own credit',
          passed: Boolean(stateRules?.eitc),
          detail: stateRules?.eitc
            ? `${state.facts.state} matches ${
                stateRules.eitc.rateNote ?? `${Math.round((rate ?? 0) * 100)}%`
              } of the federal credit`
            : state.facts.state
              ? `${state.facts.state} does not offer a state earned income credit`
              : 'no state was named, so this could not be decided',
        },
        {
          name: 'Qualifies for the federal credit',
          passed: Boolean(federal?.eligible),
          detail: federal?.eligible
            ? 'the state credit is a percentage of the federal one'
            : 'a state credit follows the federal credit, which this household does not qualify for',
        },
      ];
      annualValueCents = credit > 0 ? credit : null;
      monthlyValueCents = credit > 0 ? Math.round(credit / 12) : null;
      decidedBy = !stateRules?.eitc ? 'this state not having its own credit' : 'the federal credit it follows';
      computed['has_state_credit'] = Boolean(stateRules?.eitc) && credit > 0;
      if (credit > 0 && stateRules?.eitc) {
        if (stateRules.eitc.rateNote) {
          notes.push(
            `${state.facts.state} publishes more than one rate (${stateRules.eitc.rateNote}); the ` +
              'lowest is used here, so the real credit may be larger.'
          );
        }
        if (!stateRules.eitc.refundable) {
          notes.push(
            `This credit is ${stateRules.eitc.refundabilityNote.toLowerCase()}, so it reduces tax owed ` +
              'rather than arriving as a refund.'
          );
        }
      }
    } else if (program.ruleType === 'fpgThreshold') {
      const config = fpgProgramConfig(program.id, state.asOf);
      const result = fpgThresholdEligibility(
        {
          householdSize: size,
          annualIncomeCents: income.monthlyCents * 12,
          programsReceived: receivedPrograms(verdicts, d, criteria, answers, tau),
          // The demographic condition lives in the verdict expression, so the
          // arithmetic here answers only the income question.
          categoryMet: true,
          categoryDetail: 'handled by this program\u2019s own criteria',
        },
        config,
        povertyGuidelines()
      );
      tests = result.tests.filter((t) => t.name !== 'Who it is for');
      annualValueCents = result.annualValueCents;
      monthlyValueCents = result.monthlyValueCents;
      decidedBy = result.decidedBy;
      if (result.valueNote) notes.push(result.valueNote);
      computed['income_test'] = result.eligible;
    } else if (program.ruleType === 'medicareSavings' || program.ruleType === 'extraHelp') {
      const t = medicareThresholdsFor(state.asOf);
      const facts = {
        onMedicare: criterionTruth(program, 'on_medicare', criteria, answers, tau),
        married: d.filingStatus === 'joint' || size >= 2,
        monthlyIncomeCents: income.monthlyCents,
        resourcesCents: dollars(state.facts.savings ?? 0),
      };
      const result =
        program.ruleType === 'medicareSavings'
          ? medicareSavingsEligibility(facts, t)
          : extraHelpEligibility(facts, t);
      steps = result.steps;
      tests = result.tests;
      annualValueCents = result.annualValueCents;
      monthlyValueCents = result.monthlyValueCents;
      decidedBy = result.decidedBy;
      if (result.valueNote) notes.push(result.valueNote);
      computed['limits_test'] = result.eligible;
    }

    const truth = (name: string): boolean =>
      name in computed ? computed[name] : criterionTruth(program, name, criteria, answers, tau);

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
