/**
 * One pass of the loop, over HTTP.
 *
 * The engine key lives here and never reaches the browser. The route is stateless:
 * the browser holds the replies given so far and sends them back, so there is no
 * session, no store, and nothing typed into the box is written anywhere.
 */

import { NextRequest, NextResponse } from 'next/server';

import { engineFromEnv } from '@/lib/engine';
import { EngineUnavailable } from '@/lib/engine/types';
import { effectiveChoice } from '@/lib/evaluate';
import { Reply, screenStep } from '@/lib/loop';
import { toDollars } from '@/lib/money';
import { activeSnapSet } from '@/lib/thresholds';
import { screeningDate } from '@/lib/today';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PARAGRAPH_LENGTH = 4000;

export interface CriterionView {
  instanceId: string;
  programId: string;
  label: string;
  subjectLabel: string | null;
  type: string;
  options: Record<string, string>;
  choice: string;
  chosenLabel: string;
  confidence: number;
  settled: boolean;
  presumed: boolean;
  note?: string;
}

export interface ScreenResponse {
  engine: string;
  isFixture: boolean;
  tau: number;
  asOf: string;
  thresholdLabel: string;
  thresholdNotice?: string;
  parse: {
    householdSize: number | null;
    incomeAmount: number | null;
    incomePeriod: string | null;
    missing: string[];
    notes: string[];
  };
  criteria: CriterionView[];
  verdicts: {
    programId: string;
    name: string;
    shortName: string;
    eligible: boolean;
    annualValue: number | null;
    monthlyValue: number | null;
    decidingCriterion: string;
    applyUrl: string;
    valueBasis: string;
    tests: { name: string; passed: boolean; detail: string }[];
    steps: { label: string; detail: string; amount: number; running: number; citation?: string }[];
    notes: string[];
  }[];
  next: {
    instanceId: string;
    question: string;
    reason: string;
    confidence: number;
    voiSpread: number;
    programsAffected: number;
  } | null;
  criteriaEvaluated: number;
  lowConfidenceCount: number;
  engineElapsedMs: number;
  totalAnnualValue: number;
}

export async function POST(request: NextRequest) {
  let body: { paragraph?: unknown; replies?: unknown; asOf?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const paragraph = typeof body.paragraph === 'string' ? body.paragraph.trim() : '';
  if (paragraph.length === 0) {
    return NextResponse.json({ error: 'Describe the household first.' }, { status: 400 });
  }
  if (paragraph.length > MAX_PARAGRAPH_LENGTH) {
    return NextResponse.json(
      { error: `Keep the description under ${MAX_PARAGRAPH_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const replies: Reply[] = Array.isArray(body.replies)
    ? body.replies
        .filter(
          (r): r is Reply =>
            typeof r === 'object' &&
            r !== null &&
            typeof (r as Reply).instanceId === 'string' &&
            typeof (r as Reply).question === 'string' &&
            typeof (r as Reply).reply === 'string'
        )
        .slice(0, 10)
    : [];

  const asOf =
    typeof body.asOf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.asOf)
      ? body.asOf
      : screeningDate();

  try {
    const engine = engineFromEnv();
    const step = await screenStep(paragraph, replies, { engine, asOf });
    const active = activeSnapSet(asOf);

    const criteria: CriterionView[] = step.criteria.map((c) => {
      const answer = step.answers[c.instanceId];
      const { choice, presumed } = effectiveChoice(c, answer, step.tau);
      return {
        instanceId: c.instanceId,
        programId: c.id.split('.')[0],
        label: c.askIfUnsure.replace(/\s*\([^)]*\)\s*$/, ''),
        subjectLabel: c.subjectLabel,
        type: c.type,
        options: c.criteria,
        choice,
        chosenLabel: c.criteria[choice] ?? choice,
        confidence: answer.confidence,
        settled: answer.confidence >= step.tau,
        presumed,
        note: c.note,
      };
    });

    const response: ScreenResponse = {
      engine: step.engine,
      isFixture: step.isFixture,
      tau: step.tau,
      asOf,
      thresholdLabel: active.set.label,
      thresholdNotice: active.notice,
      parse: {
        householdSize: step.parse.facts.householdSize,
        incomeAmount: step.parse.facts.incomeAmount,
        incomePeriod: step.parse.facts.incomePeriod,
        missing: step.parse.missing,
        notes: step.parse.notes,
      },
      criteria,
      verdicts: Object.values(step.verdicts).map((v) => ({
        programId: v.programId,
        name: v.name,
        shortName: v.shortName,
        eligible: v.eligible,
        annualValue: v.annualValueCents === null ? null : toDollars(v.annualValueCents),
        monthlyValue: v.monthlyValueCents === null ? null : toDollars(v.monthlyValueCents),
        decidingCriterion: v.decidingCriterion,
        applyUrl: v.applyUrl,
        valueBasis: v.valueBasis,
        tests: v.tests,
        steps: v.steps.map((s) => ({
          label: s.label,
          detail: s.detail,
          amount: toDollars(s.amountCents),
          running: toDollars(s.runningCents),
          citation: s.citation,
        })),
        notes: v.notes,
      })),
      next: step.next
        ? {
            instanceId: step.next.criterion.instanceId,
            question: step.next.criterion.askIfUnsure,
            reason: step.nextReason ?? '',
            confidence: step.next.confidence,
            voiSpread: toDollars(step.next.voi.spreadCents),
            programsAffected: step.next.voi.programsAffected,
          }
        : null,
      criteriaEvaluated: step.criteriaEvaluated,
      lowConfidenceCount: step.lowConfidenceCount,
      engineElapsedMs: step.engineElapsedMs,
      totalAnnualValue: toDollars(step.totalAnnualValueCents),
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof EngineUnavailable) {
      // Never a partial verdict: a half-answered screening looks complete and is not.
      return NextResponse.json({ error: error.message, engineBusy: error.retryable }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : 'Something went wrong.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
