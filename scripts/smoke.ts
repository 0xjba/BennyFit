import { MockEngine } from '@/lib/engine/mock';
import { screen } from '@/lib/loop';
import { formatDollars } from '@/lib/money';

const PARAGRAPH =
  "I'm 62, live alone in Ohio, and get about $1,150 a month. Rent is $700 and I pay my own gas and electric.";

async function main() {
  const result = await screen(PARAGRAPH, {
    engine: new MockEngine(),
    asOf: '2026-09-21',
    askUser: async (q, c) => {
      console.log(`\n  ASKED (${c.instanceId}): ${q}`);
      const replies: Record<string, string> = {
        'snap.income_source': 'It is Social Security, I do not have a job.',
        'snap.resources_over_limit': 'No, I have almost nothing saved.',
        'lifeline.tribal_lands': 'No.',
        'lifeline.one_per_household': 'No, nobody here has that.',
        'snap.categorical': 'No, I do not get SSI or TANF.',
      };
      const reply = replies[c.instanceId] ?? 'No.';
      console.log(`  REPLY: ${reply}`);
      return reply;
    },
  });

  console.log(`\nengine=${result.engine} fixture=${result.isFixture} tau=${result.tau}`);
  console.log(`criteria instantiated: ${result.criteria.length}`);
  console.log(`passes: ${result.passes.length}`);
  for (const p of result.passes) {
    console.log(
      `  pass ${p.index}: ${p.criteriaEvaluated} criteria, ${p.engineElapsedMs.toFixed(1)}ms, ` +
        `${p.lowConfidenceCount} below tau, total ${formatDollars(p.totalAnnualValueCents)}`
    );
  }
  console.log(`\nquestions asked: ${result.asked.length}`);
  for (const a of result.asked) {
    console.log(`  ${a.instanceId}`);
    console.log(`    "${a.question}"`);
    console.log(`    reason: ${a.reason}`);
    console.log(`    value of information: ${formatDollars(a.voiSpreadCents)} across ${a.programsAffected} programs`);
  }
  console.log('\nverdicts:');
  for (const v of Object.values(result.verdicts)) {
    console.log(
      `  ${v.shortName.padEnd(10)} ${v.eligible ? 'likely eligible' : 'likely not eligible'}` +
        (v.annualValueCents ? `  about ${formatDollars(v.annualValueCents)}/year` : '') +
        `  (decided by ${v.decidingCriterion})`
    );
    for (const n of v.notes) console.log(`      note: ${n}`);
  }
  console.log(`\ntotal: ${formatDollars(result.totalAnnualValueCents)}/year in ${result.totalElapsedMs.toFixed(0)}ms`);
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
