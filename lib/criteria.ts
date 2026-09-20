/**
 * Loading, validating and instantiating the criteria files.
 *
 * The program files are the substance of the system: a non-programmer should be able
 * to read one and see exactly what the system will test. Everything here exists to
 * make that possible without letting a malformed file reach a household.
 *
 * Validation happens at load, not at request time. A criterion id that appears in a
 * verdict expression but has no criterion behind it is a fault in the file, and it
 * should stop the process starting rather than produce a wrong verdict for one
 * unlucky household.
 */

import snap from '@/data/programs/snap.json';
import eitc from '@/data/programs/eitc.json';
import lifeline from '@/data/programs/lifeline.json';
import ctc from '@/data/programs/ctc.json';
import wic from '@/data/programs/wic.json';
import schoolMeals from '@/data/programs/school_meals.json';
import csfp from '@/data/programs/csfp.json';
import liheap from '@/data/programs/liheap.json';
import headStart from '@/data/programs/head_start.json';
import medicareSavings from '@/data/programs/medicare_savings.json';
import extraHelp from '@/data/programs/extra_help.json';

export type CriterionType = 'noul' | 'choice' | 'score';
export type Scope = 'household' | 'member' | 'child';

export interface CriterionEffect {
  onTrue?: string[];
  onFalse?: string[];
  onOption?: Record<string, string[]>;
  onNot?: Record<string, string[]>;
}

export interface Criterion {
  id: string;
  scope: Scope;
  type: CriterionType;
  instructions: string;
  askIfUnsure: string;
  criteria: Record<string, string>;
  effect?: CriterionEffect;
  /** This criterion only applies once another has been answered a particular way. */
  requires?: string;
  /**
   * The specific option the prerequisite must carry. Without this, a choice
   * prerequisite counts as satisfied by anything other than 'none', which made the
   * separated-spouse rule apply to every filer rather than to separate filers.
   */
  requiresOption?: string;
  /** This criterion does not apply when another is answered affirmatively. */
  skipIf?: string;
  /**
   * The option to use when the engine is not confident enough to have settled this.
   *
   * Some criteria ask about facts a narrative almost never states. Nobody writes "I
   * have a Social Security number valid for employment" when describing their
   * household, so reading silence as a no would disqualify nearly everyone. A
   * presumption says what a screening should assume in the absence of evidence, and
   * the interface shows a presumed answer as presumed rather than as read.
   */
  presumption?: string;
  /**
   * The presumption stated in plain language, as a condition a person could check:
   * "you have a Social Security number valid for work".
   */
  assumption?: string;
  /**
   * Whether the assumption is worth putting in front of a household. A routine one
   * holds for almost everybody and only adds noise to a result; a material one is
   * commonly false and belongs on the card.
   */
  assumptionStrength?: 'routine' | 'material';
  note?: string;
}

export interface Program {
  id: string;
  name: string;
  shortName: string;
  administeredBy: string;
  applyUrl: string;
  thresholdFamily: string;
  /**
   * Which evaluator drives this program.
   *
   * Most federal programs set their income test as a multiple of the poverty
   * guidelines, so `fpgThreshold` covers several of them from one implementation and
   * adding another of that shape is a data change rather than a code change.
   */
  ruleType?: 'snap' | 'eitc' | 'lifeline' | 'ctc' | 'fpgThreshold' | 'medicareSavings' | 'extraHelp';
  valueBasis: string;
  criteria: Criterion[];
  computed: string[];
  verdict: string;
}

/** A criterion instantiated for a particular household: household-wide or per person. */
export interface InstantiatedCriterion extends Criterion {
  /** `snap.member_elderly_or_disabled#2` for the second member. */
  instanceId: string;
  subjectIndex: number | null;
  subjectLabel: string | null;
}

const PROGRAMS = [
  snap,
  eitc,
  ctc,
  lifeline,
  wic,
  schoolMeals,
  csfp,
  liheap,
  headStart,
  medicareSavings,
  extraHelp,
] as unknown as Program[];

// ---------------------------------------------------------------------------
// Verdict expressions
// ---------------------------------------------------------------------------

export type Expr =
  | { kind: 'ref'; name: string }
  | { kind: 'not'; of: Expr }
  | { kind: 'and'; left: Expr; right: Expr }
  | { kind: 'or'; left: Expr; right: Expr };

/**
 * Parse a verdict expression: identifiers combined with AND, OR, NOT and parentheses.
 * Identifiers are the part of a criterion id after the program prefix.
 */
export function parseVerdict(source: string): Expr {
  const tokens = source.match(/\(|\)|[A-Za-z_][A-Za-z0-9_.]*/g);
  if (!tokens) throw new Error(`Verdict expression is empty: ${source}`);
  let pos = 0;

  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  function primary(): Expr {
    const token = take();
    if (token === undefined) throw new Error(`Unexpected end of verdict: ${source}`);
    if (token === '(') {
      const inner = orExpr();
      if (take() !== ')') throw new Error(`Unbalanced parenthesis in verdict: ${source}`);
      return inner;
    }
    if (token.toUpperCase() === 'NOT') return { kind: 'not', of: primary() };
    if (token === ')') throw new Error(`Unexpected ')' in verdict: ${source}`);
    if (['AND', 'OR'].includes(token.toUpperCase())) {
      throw new Error(`Unexpected '${token}' in verdict: ${source}`);
    }
    return { kind: 'ref', name: token };
  }

  function andExpr(): Expr {
    let left = primary();
    while (peek() !== undefined && peek()!.toUpperCase() === 'AND') {
      take();
      left = { kind: 'and', left, right: primary() };
    }
    return left;
  }

  function orExpr(): Expr {
    let left = andExpr();
    while (peek() !== undefined && peek()!.toUpperCase() === 'OR') {
      take();
      left = { kind: 'or', left, right: andExpr() };
    }
    return left;
  }

  const expr = orExpr();
  if (pos !== tokens.length) {
    throw new Error(`Trailing tokens in verdict: ${source}`);
  }
  return expr;
}

export function verdictRefs(expr: Expr): string[] {
  switch (expr.kind) {
    case 'ref':
      return [expr.name];
    case 'not':
      return verdictRefs(expr.of);
    default:
      return [...verdictRefs(expr.left), ...verdictRefs(expr.right)];
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateProgram(program: Program): void {
  const seen = new Set<string>();
  for (const c of program.criteria) {
    if (!c.id.startsWith(`${program.id}.`)) {
      throw new Error(`${c.id} does not carry the '${program.id}.' prefix`);
    }
    if (seen.has(c.id)) throw new Error(`Duplicate criterion id ${c.id}`);
    seen.add(c.id);

    if (!c.instructions || !c.askIfUnsure) {
      throw new Error(`${c.id} needs both instructions for the model and a question for a person`);
    }
    if (c.instructions === c.askIfUnsure) {
      throw new Error(`${c.id} uses the same text for the model and for a person`);
    }

    const options = Object.keys(c.criteria);
    if (c.type === 'noul') {
      if (options.length !== 2 || !options.includes('true') || !options.includes('false')) {
        throw new Error(`${c.id} is a noul and must offer exactly 'true' and 'false'`);
      }
    } else if (c.type === 'choice') {
      if (options.length < 2) throw new Error(`${c.id} is a choice and needs at least two options`);
    }

    for (const ref of [c.requires, c.skipIf]) {
      if (ref && !program.criteria.some((o) => o.id === ref)) {
        throw new Error(`${c.id} refers to ${ref}, which is not a criterion of ${program.id}`);
      }
    }

    if (c.requiresOption !== undefined) {
      const prerequisite = program.criteria.find((o) => o.id === c.requires);
      if (!prerequisite) {
        throw new Error(`${c.id} names requiresOption without a requires`);
      }
      if (!Object.keys(prerequisite.criteria).includes(c.requiresOption)) {
        throw new Error(
          `${c.id} requires ${c.requires} to be '${c.requiresOption}', which that criterion does not offer`
        );
      }
    }

    for (const option of Object.keys(c.effect?.onOption ?? {})) {
      if (!options.includes(option)) {
        throw new Error(`${c.id} has an effect for option '${option}', which it does not offer`);
      }
    }
    for (const option of Object.keys(c.effect?.onNot ?? {})) {
      if (!options.includes(option)) {
        throw new Error(`${c.id} has an onNot effect for option '${option}', which it does not offer`);
      }
    }

    if (c.presumption !== undefined && !options.includes(c.presumption)) {
      throw new Error(
        `${c.id} presumes '${c.presumption}', which is not one of its options: ${options.join(', ')}`
      );
    }
    if (c.presumption !== undefined && !c.assumption) {
      throw new Error(
        `${c.id} carries a presumption but no 'assumption' text. An assumption that ` +
          'cannot be stated to a household must not be made on their behalf.'
      );
    }
  }

  // Every name in the verdict must resolve to a criterion or a computed value.
  const available = new Set([
    ...program.criteria.map((c) => c.id.slice(program.id.length + 1)),
    ...program.computed.map((c) => (c.startsWith(`${program.id}.`) ? c.slice(program.id.length + 1) : c)),
  ]);
  for (const ref of verdictRefs(parseVerdict(program.verdict))) {
    if (!available.has(ref)) {
      throw new Error(
        `${program.id} verdict refers to '${ref}', which is neither a criterion nor a computed value. ` +
          `Available: ${[...available].sort().join(', ')}`
      );
    }
  }
}

let validated = false;

export function loadPrograms(): Program[] {
  if (!validated) {
    for (const p of PROGRAMS) validateProgram(p);
    validated = true;
  }
  return PROGRAMS;
}

export function programById(id: string): Program {
  const found = loadPrograms().find((p) => p.id === id);
  if (!found) throw new Error(`No program with id ${id}`);
  return found;
}

// ---------------------------------------------------------------------------
// Instantiation
// ---------------------------------------------------------------------------

export interface HouseholdShape {
  /** Every person described, in the order they were mentioned. */
  members: { label: string; isChild: boolean }[];
}

/**
 * Expand the criteria of every program against a particular household.
 *
 * Household-scoped criteria appear once. Member- and child-scoped criteria appear once
 * per person they apply to, because the underlying rules are per person: whether a
 * child meets the EITC residency test is a fact about that child, and answering it for
 * one says nothing about the others.
 */
export function instantiate(programs: Program[], shape: HouseholdShape): InstantiatedCriterion[] {
  const out: InstantiatedCriterion[] = [];

  for (const program of programs) {
    for (const c of program.criteria) {
      if (c.scope === 'household') {
        out.push({ ...c, instanceId: c.id, subjectIndex: null, subjectLabel: null });
        continue;
      }
      const subjects = shape.members
        .map((m, i) => ({ ...m, i }))
        .filter((m) => (c.scope === 'child' ? m.isChild : true));

      for (const subject of subjects) {
        out.push({
          ...c,
          instanceId: `${c.id}#${subject.i}`,
          subjectIndex: subject.i,
          subjectLabel: subject.label,
          instructions: `${c.instructions}\n\nThe member in question is: ${subject.label}.`,
          askIfUnsure: `${c.askIfUnsure} (${subject.label})`,
        });
      }
    }
  }

  return out;
}

/** The criterion id behind an instance id, dropping any `#index` suffix. */
export function baseId(instanceId: string): string {
  const hash = instanceId.indexOf('#');
  return hash === -1 ? instanceId : instanceId.slice(0, hash);
}
