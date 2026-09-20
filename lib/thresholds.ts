/**
 * Threshold sets, keyed by the period they are in effect.
 *
 * No dollar figure appears anywhere else in the codebase. A set is selected by the
 * date the screening is run for, never hardcoded, so the SNAP fiscal year turning
 * over on October 1 changes the active table without a code change.
 *
 * A set whose status is 'partial' has income standards but no allotment table. It can
 * decide eligibility but cannot compute a benefit, and callers must handle that rather
 * than fill the gap with a guess.
 */

import snapFy2026 from '@/data/thresholds/snap-fy2026.json';
import snapFy2027 from '@/data/thresholds/snap-fy2027.json';
import eitcTy2025 from '@/data/thresholds/eitc-ty2025.json';
import eitcTy2026 from '@/data/thresholds/eitc-ty2026.json';
import lifeline2026 from '@/data/thresholds/lifeline-2026.json';
import fpg2026 from '@/data/thresholds/fpg-2026.json';
import fpgPrograms2026 from '@/data/thresholds/fpg-programs-2026.json';
import medicare2026 from '@/data/thresholds/medicare-2026.json';
import ctcTy2025 from '@/data/thresholds/ctc-ty2025.json';
import ctcTy2026 from '@/data/thresholds/ctc-ty2026.json';

export type SetStatus = 'complete' | 'partial';

export interface SizeTable {
  [size: string]: number | null | undefined;
  increment?: number;
}

export interface SnapThresholds {
  id: string;
  label: string;
  effectiveFrom: string;
  effectiveTo: string;
  status: SetStatus;
  statusNote?: string;
  netLimitBySize: SizeTable;
  grossLimitBySize: SizeTable;
  grossLimit165BySize: SizeTable;
  maxAllotmentBySize: SizeTable | null;
  standardDeductionBySize: Record<string, number | null | string | undefined>;
  earnedIncomeDeductionRate: number;
  excessShelterCap: number | null;
  homelessShelterDeduction: number | null;
  excessMedicalThreshold: number;
  resourceLimit: number | null;
  resourceLimitElderlyDisabled: number | null;
  minimumAllotment: number | null;
  benefitContributionRate: number;
  sources: Record<string, string>;
  readOn: string;
}

export interface EitcBracket {
  phaseInRate: number;
  phaseOutRate: number;
  earnedIncomeAmount: number;
  maxCredit: number;
  thresholdPhaseout: { joint: number; other: number };
  completedPhaseout: { joint: number; other: number };
}

export interface EitcThresholds {
  id: string;
  label: string;
  taxYear: number;
  effectiveFrom: string;
  effectiveTo: string;
  status: SetStatus;
  investmentIncomeLimit: number;
  childlessMinAge: number;
  childlessMaxAgeExclusive: number;
  byChildren: Record<string, EitcBracket>;
  source: string;
  sourceCitation: string;
  readOn: string;
}

export interface LifelineThresholds {
  id: string;
  label: string;
  year: number;
  effectiveFrom: string;
  effectiveTo: string;
  status: SetStatus;
  fpgMultiple: number;
  annualIncomeLimitBySize: SizeTable;
  monthlyBenefit: number;
  monthlyBenefitTribal: number;
  qualifyingPrograms: string[];
  qualifyingProgramsTribal: string[];
  sources: Record<string, string>;
  readOn: string;
}

const SNAP_SETS = [snapFy2026, snapFy2027] as unknown as SnapThresholds[];
const EITC_SETS = [eitcTy2025, eitcTy2026] as unknown as EitcThresholds[];
const LIFELINE_SETS = [lifeline2026] as unknown as LifelineThresholds[];

interface Dated {
  effectiveFrom: string;
  effectiveTo: string;
}

function covers(set: Dated, isoDate: string): boolean {
  return set.effectiveFrom <= isoDate && isoDate <= set.effectiveTo;
}

function pick<T extends Dated & { id: string }>(sets: T[], isoDate: string, what: string): T {
  const hit = sets.find((s) => covers(s, isoDate));
  if (hit) return hit;
  throw new Error(
    `No ${what} threshold set covers ${isoDate}. Available: ` +
      sets.map((s) => `${s.id} (${s.effectiveFrom}..${s.effectiveTo})`).join(', ')
  );
}

export function snapThresholdsFor(isoDate: string): SnapThresholds {
  return pick(SNAP_SETS, isoDate, 'SNAP');
}

export function eitcThresholdsFor(isoDate: string): EitcThresholds {
  return pick(EITC_SETS, isoDate, 'EITC');
}

export function lifelineThresholdsFor(isoDate: string): LifelineThresholds {
  return pick(LIFELINE_SETS, isoDate, 'Lifeline');
}

/**
 * The set that will actually be used for a screening, with a fallback.
 *
 * When the set covering the date is only partial, the screening falls back to the most
 * recent complete set and says so. That is the October 1 case: the fiscal year turns
 * over before the new COLA memo has been read, and under-screening on last year's
 * figures with a visible notice is better than refusing to run or inventing a table.
 */
export interface ActiveSnapSet {
  set: SnapThresholds;
  requested: SnapThresholds;
  fellBack: boolean;
  notice?: string;
}

export function activeSnapSet(isoDate: string): ActiveSnapSet {
  const requested = snapThresholdsFor(isoDate);
  if (requested.status === 'complete') {
    return { set: requested, requested, fellBack: false };
  }
  const complete = SNAP_SETS.filter((s) => s.status === 'complete').sort((a, b) =>
    a.effectiveFrom < b.effectiveFrom ? 1 : -1
  );
  if (complete.length === 0) {
    throw new Error('No complete SNAP threshold set is available.');
  }
  const set = complete[0];
  return {
    set,
    requested,
    fellBack: true,
    notice:
      `${requested.label} is in effect, but its allotment and deduction tables have not ` +
      `been published. Figures shown use ${set.label}, so benefit amounts are likely to ` +
      `be understated.`,
  };
}

/**
 * Look up a household size in a table that lists sizes 1-8 and an increment.
 *
 * Above the listed sizes the table continues by adding the increment per person, which
 * is how every one of these tables is published.
 */
export function bySize(table: SizeTable, size: number): number {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`Household size must be a positive integer, got ${size}`);
  }
  const direct = table[String(size)];
  if (typeof direct === 'number') return direct;

  const listed = Object.keys(table)
    .filter((k) => /^\d+$/.test(k))
    .map(Number)
    .sort((a, b) => a - b);
  const largest = listed[listed.length - 1];
  const base = table[String(largest)];
  const increment = table.increment;
  if (typeof base !== 'number' || typeof increment !== 'number') {
    throw new Error(`Table cannot be extended to household size ${size}`);
  }
  return base + increment * (size - largest);
}

/** The standard deduction table caps out: sizes above 6 use the 6-person figure. */
export function standardDeductionFor(
  table: Record<string, number | null | string | undefined>,
  size: number
): number {
  const key = size >= 6 ? '6+' : String(size);
  const value = table[key];
  if (typeof value !== 'number') {
    throw new Error(
      `No standard deduction published for household size ${size} in this threshold set`
    );
  }
  return value;
}


// ---------------------------------------------------------------------------
// The programs added beyond the original three
// ---------------------------------------------------------------------------

import type { CtcThresholds, FpgProgramConfig, FpgTable, MedicareThresholds } from './compute-programs';

const FPG_PROGRAM_SETS = [fpgPrograms2026] as unknown as (Dated & {
  id: string;
  programs: Record<string, FpgProgramConfig>;
})[];
const MEDICARE_SETS = [medicare2026] as unknown as (Dated & { id: string } & MedicareThresholds)[];
const CTC_SETS = [ctcTy2025, ctcTy2026] as unknown as (Dated & { id: string } & CtcThresholds)[];

export function povertyGuidelines(): FpgTable {
  return fpg2026 as unknown as FpgTable;
}

export function fpgProgramConfig(programId: string, isoDate: string): FpgProgramConfig {
  const set = pick(FPG_PROGRAM_SETS, isoDate, 'poverty-guideline program');
  const config = set.programs[programId];
  if (!config) {
    throw new Error(`No poverty-guideline configuration for ${programId} in ${set.id}`);
  }
  return config;
}

export function medicareThresholdsFor(isoDate: string): MedicareThresholds {
  return pick(MEDICARE_SETS, isoDate, 'Medicare');
}

export function ctcThresholdsFor(isoDate: string): CtcThresholds {
  return pick(CTC_SETS, isoDate, 'Child Tax Credit');
}
