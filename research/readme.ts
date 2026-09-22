/**
 * Fill the generated sections of README.md from research/data.json, so the README
 * quotes the same measured numbers as the report and the post.
 *
 * Usage:  npx tsx research/readme.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const d = JSON.parse(readFileSync(join(root, 'research/data.json'), 'utf8'));
const J = d.endToEnd.jevCompared;
const B = d.endToEnd.sonnet;
const F = d.endToEnd.jevFinal;
const P = d.endToEnd.paired;
const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const ed = (e: number, reader = 'code') => d.reading.editions.find((x: { edition: number; reader: string }) => x.edition === e && x.reader === reader);

const S = d.endToEnd.single.run;
const PS = d.endToEnd.single.paired;
const RS = d.endToEnd.single.ratios;

const results = `Jev against Claude Sonnet 5 in the identical pipeline (same descriptions, rules, questions, follow-up loop and answer key), in two configurations, on ${J.households} held-out households:

| | Jev | Sonnet 5, schema, batched | Sonnet 5, one request |
|---|---|---|---|
| Wrong verdicts, households stating every fact (of ${J.specified.total}) | ${J.specified.wrong} | ${B.specified.wrong} | ${S.specified.wrong} |
| Households missing a fact with a wrong verdict (of ${J.underspecifiedHouseholds}) | ${J.underspecifiedHouseholdsWrong} | ${B.underspecifiedHouseholdsWrong} | ${S.underspecifiedHouseholdsWrong} |
| Median time to a full result | ${J.medianSeconds.toFixed(1)} s | ${B.medianSeconds.toFixed(1)} s | ${S.medianSeconds.toFixed(1)} s |
| Cost per household | $${J.costPerHouseholdUSD.toFixed(5)} (list price) | $${B.costPerHouseholdUSD.toFixed(3)} (billed) | $${S.costPerHouseholdUSD.toFixed(3)} (billed) |

- Against the schema configuration the error difference is not significant (exact McNemar p = ${P.mcnemarP.toFixed(2)}); against the one-request configuration it is (p = ${PS.mcnemarP.toFixed(3)}), but those errors are all one misreading of a single criterion. Jev was ${RS.speed.toFixed(0)} to ${d.endToEnd.ratios.speed.toFixed(0)}× faster and ${Math.round(RS.cost)} to ${Math.round(d.endToEnd.ratios.cost)}× cheaper per household.
- The households missing a fact all withhold the same one (whether income is earned). Jev answered it confidently instead of asking more often than the baselines; a *not stated* option was added in response and has been measured on development households only.
- Ranking follow-ups by expected value cut questions from ${J.questionsTotal} to ${F.questionsTotal} on the held-out households.
- Reading fresh descriptions: code with Jev choosing among candidates read ${pct(ed(6, 'code+jev').rate)} of hand-labelled facts, against ${pct(ed(6).rate)} for pattern-matching code alone.
- Rules: ${d.setup.conformance.passed} of ${d.setup.conformance.total} hand-computed cases agree with their primary sources.`;

const programs = `**Programs (${d.setup.programs}):** ${d.setup.programNames.join(', ')}. State rules across ${d.setup.jurisdictions} jurisdictions.`;

let readme = readFileSync(join(root, 'README.md'), 'utf8');
const fill = (name: string, body: string) => {
  const re = new RegExp(`(<!-- generated:${name}:start -->)[\\s\\S]*?(<!-- generated:${name}:end -->)`);
  if (!re.test(readme)) throw new Error(`README has no generated:${name} markers`);
  readme = readme.replace(re, `$1\n${body}\n$2`);
};
fill('results', results);
fill('programs', programs);
writeFileSync(join(root, 'README.md'), readme);
console.log('README generated sections updated');
