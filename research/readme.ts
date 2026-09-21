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
const PU = d.endToEnd.pairedUnderspecified;
const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const ed = (e: number, reader = 'code') => d.reading.editions.find((x: { edition: number; reader: string }) => x.edition === e && x.reader === reader);

const results = `Jev against Claude Sonnet 5 run through the identical pipeline (same descriptions, rules, questions, follow-up loop and answer key; Sonnet's reply held to a schema of each question's own options), on ${J.households} held-out households:

| | Jev | Claude Sonnet 5 |
|---|---|---|
| Verdicts right, households stating every fact | ${J.specified.right} of ${J.specified.total} (${pct(J.specified.right / J.specified.total, 2)}) | ${B.specified.right} of ${B.specified.total} (${pct(B.specified.right / B.specified.total, 2)}) |
| Verdicts right, households missing a deciding fact | ${J.underspecified.right} of ${J.underspecified.total} (${pct(J.underspecified.right / J.underspecified.total)}) | ${B.underspecified.right} of ${B.underspecified.total} (${pct(B.underspecified.right / B.underspecified.total)}) |
| Median time to a full result | ${J.medianSeconds.toFixed(1)} s | ${B.medianSeconds.toFixed(1)} s |
| Billed cost per household | $${J.costPerHouseholdUSD.toFixed(5)} | $${B.costPerHouseholdUSD.toFixed(3)} |

- On households stating every fact the two are statistically indistinguishable (exact McNemar p = ${P.mcnemarP.toFixed(2)}); Jev was ${d.endToEnd.ratios.speed.toFixed(1)}× faster and ${Math.round(d.endToEnd.ratios.cost)}× cheaper per household.
- On households missing a deciding fact, Sonnet was more accurate (p = ${PU.mcnemarP.toFixed(3)}), because it asked the maximum three questions in ${B.questionsHistogram[3]} of ${B.households} households. A *not stated* option was added in response; it has been measured on development households only.
- Ranking follow-ups by expected value cut questions from ${J.questionsTotal} to ${F.questionsTotal} on the held-out households, with fully specified accuracy at ${pct(F.specified.right / F.specified.total, 2)}.
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
