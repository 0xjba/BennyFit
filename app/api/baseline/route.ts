/**
 * The generation baselines, over HTTP.
 *
 * Runs the same household and the same criteria through a model asked to write JSON,
 * and reports what came back: how long it took, whether it parsed, and how many
 * answers were missing, cross-wired or invented.
 *
 * Without a key the lane reports that it did not run. It never invents a result: the
 * comparison is only worth anything if the failures in it are ones a model actually
 * produced.
 */

import { NextRequest, NextResponse } from 'next/server';

import { instantiate, loadPrograms } from '@/lib/criteria';
import { generationLanes } from '@/lib/engine/generation';
import { RateLimiter, limitMessage, visitorOf } from '@/lib/rate-limit';

const baselineLimiter = new RateLimiter({ perVisitor: 10, windowMs: 10 * 60_000, perDay: 200 });
import { EngineUnavailable } from '@/lib/engine/types';
import { buildRequest, renderState, shapeOf } from '@/lib/loop';
import { parseHousehold } from '@/lib/parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface LaneResult {
  lane: 'sameModel' | 'frontier';
  name: string;
  model: string;
  configured: boolean;
  ran: boolean;
  reason?: string;
  elapsedMs?: number;
  parsed?: boolean;
  criteriaAsked?: number;
  faults?: { unparseable: number; missing: number; crossWired: number; invented: number };
  usable?: number;
  examples?: { criterionId: string; fault: string; borrowedFrom?: string; selfReportedConfidence: number | null }[];
  outputTokens?: number;
}

/**
 * The live comparison lanes are paused unless BASELINE_LANES=on. A general-purpose
 * model costs about $0.20 a screening to run through the loop, against a fraction of a
 * cent for the typed engine, so on a public demo it would be the whole bill. The
 * measured comparison, on the held-out households, is on the Results page.
 */
const LANES_ON = process.env.BASELINE_LANES === 'on';

export async function POST(request: NextRequest) {
  const limit = baselineLimiter.check(visitorOf(request.headers));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: limitMessage(limit), rateLimited: true },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  let body: { paragraph?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const paragraph = typeof body.paragraph === 'string' ? body.paragraph.trim() : '';
  if (paragraph.length === 0 || paragraph.length > 4000) {
    return NextResponse.json({ error: 'Describe the household first.' }, { status: 400 });
  }

  const parse = parseHousehold(paragraph);
  const criteria = instantiate(loadPrograms(), shapeOf(parse));
  const state = renderState(paragraph, parse, []);
  const { questions } = buildRequest(state, criteria);

  const lanes = generationLanes();
  const results: LaneResult[] = [];

  for (const [key, baseline] of Object.entries(lanes) as [
    'sameModel' | 'frontier',
    (typeof lanes)['sameModel'],
  ][]) {
    const base: LaneResult = {
      lane: key,
      name: baseline.name,
      model: baseline.model,
      configured: baseline.configured,
      ran: false,
    };

    if (!LANES_ON) {
      results.push({
        ...base,
        reason:
          'Paused on the live demo. This lane is measured on the held-out households ' +
          'instead; the side-by-side results are on the Results page.',
      });
      continue;
    }

    if (!baseline.configured) {
      results.push({
        ...base,
        reason:
          'No API key configured for this lane, so it did not run. Nothing is shown in ' +
          'its place: a simulated failure would be evidence of nothing.',
      });
      continue;
    }

    try {
      const result = await baseline.run(state, questions);
      const faultCount =
        result.faults.missing + result.faults.crossWired + result.faults.invented;
      results.push({
        ...base,
        ran: true,
        elapsedMs: result.elapsedMs,
        parsed: result.parsed,
        criteriaAsked: Object.keys(questions).length,
        faults: result.faults,
        usable: Object.keys(questions).length - faultCount,
        outputTokens: result.usage.outputTokens,
        examples: Object.values(result.answers)
          .filter((a) => a.fault !== null)
          .slice(0, 6)
          .map((a) => ({
            criterionId: a.criterionId,
            fault: a.fault!,
            borrowedFrom: a.borrowedFrom,
            selfReportedConfidence: a.selfReportedConfidence,
          })),
      });
    } catch (error) {
      results.push({
        ...base,
        reason:
          error instanceof EngineUnavailable
            ? error.message
            : error instanceof Error
              ? error.message
              : 'The lane failed to run.',
      });
    }
  }

  return NextResponse.json({ criteriaAsked: Object.keys(questions).length, lanes: results });
}
