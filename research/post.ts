/**
 * Write docs/post.md, the public write-up, from research/data.json.
 *
 * Like the technical report, the post types no measured number by hand: every figure
 * below is read from the data file, and the only other figures are quoted from the
 * sources cited beside them.
 *
 * Usage:  npx tsx research/post.ts
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
const ed = (e: number, reader = 'code') => d.reading.editions.find((x: { edition: number; reader: string }) => x.edition === e && x.reader === reader);
const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const code6 = ed(6);
const jev6 = ed(6, 'code+jev');
const incomeCode = d.reading.sixByField.code.incomeMonthly;
const incomeJev = d.reading.sixByField.withEngine.incomeMonthly;
const early = [1, 2, 3, 4, 5].map((e) => ed(e).rate);
const stages = d.development.stages;
const liheapErrors = B.errors.filter((e: { program: string }) => e.program === 'liheap').length;
const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (n: number) => words[n] ?? String(n);
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

const post = `# Same verdicts, ${d.endToEnd.ratios.speed.toFixed(1)}× faster and ${Math.round(d.endToEnd.ratios.cost)}× cheaper: screening ${d.setup.programs} benefit programs with a typed-readout model

*Every measured number in this post is generated from the evaluation files in the repository (\`research/data.json\`, commit ${d.commit}). The technical report has the method, the confidence intervals and every limitation: https://bennyfit.vercel.app/research*

---

USDA estimates that 88% of people eligible for SNAP received it in fiscal year 2022. The IRS estimates that about four in five eligible workers claim the Earned Income Tax Credit, and the Tax Policy Center puts the unclaimed credit at around $7 billion a year. The money exists. Finding out that you qualify is the hard part.

A randomized trial with about 30,000 older adults who were likely eligible for SNAP showed how much that matters. Within nine months, 6% of the control group enrolled. Of those sent information, 11% did. Of those sent information and offered help with the application, 18% did. (Finkelstein and Notowidigdo, *Quarterly Journal of Economics*, 2019.)

BennyFit is an attempt at the first step of that help: describe a household in a few sentences and get a screening across ${d.setup.programs} federal and state programs, with a follow-up question only where the answer could change the result.

## The split: code does the numbers, the model does the reading

Eligibility is mostly arithmetic. Gross income against 130% of the poverty line, a 20% earned-income deduction, a shelter deduction capped at a figure that changes every October, a state that raised its limit. None of that should be left to a language model. In BennyFit every threshold, date and dollar amount lives in code, in integer cents, with the source it came from, and ${d.setup.conformance.total} hand-computed cases from primary sources check it (${d.setup.conformance.passed} of ${d.setup.conformance.total} agree).

What is left for a model is judgement about the text. Does "I get about $1,025 a month" mean wages or Social Security? Is the rent including heat? Does this person have a child under 13? Each of these is a closed question with a fixed set of answers.

For those, BennyFit uses Jev, TypeSafe's typed-readout model. You send it the description and a set of typed questions; for each one it returns a probability distribution over the options, not generated text. A household produces a median of ${J.medianCriteria} such questions, and Jev answers all of them in a single request.

## Against a general-purpose model doing the same job

To see what the typed readout buys, I ran Claude Sonnet 5 through the identical pipeline: same descriptions, same rules, same questions, same follow-up loop, same answer key. Its reply was held to a JSON schema allowing only each question's own options, the way a careful team would build this today. Both were scored once on ${J.households} held-out households that nothing had been tuned against.

| | Jev | Claude Sonnet 5 |
|---|---|---|
| Verdicts right, households that state every fact | ${J.specified.right} of ${J.specified.total} (${pct(J.specified.right / J.specified.total, 2)}) | ${B.specified.right} of ${B.specified.total} (${pct(B.specified.right / B.specified.total, 2)}) |
| Verdicts right, households missing a deciding fact | ${J.underspecified.right} of ${J.underspecified.total} (${pct(J.underspecified.right / J.underspecified.total)}) | ${B.underspecified.right} of ${B.underspecified.total} (${pct(B.underspecified.right / B.underspecified.total)}) |
| Median time to a full result | ${J.medianSeconds.toFixed(1)} s | ${B.medianSeconds.toFixed(1)} s |
| Billed cost per household | $${J.costPerHouseholdUSD.toFixed(5)} | $${B.costPerHouseholdUSD.toFixed(3)} |
| Follow-up questions asked, in total | ${J.questionsTotal} | ${B.questionsTotal} |

On households that state every fact, the two are statistically indistinguishable: Jev alone was right on ${P.onlyJev} verdicts, Sonnet alone on ${P.onlySonnet} (exact McNemar p = ${P.mcnemarP.toFixed(2)}). ${cap(word(liheapErrors))} of Sonnet's ${word(B.specified.wrong)} errors were one misreading, rent that included utilities read as not paying for heating, where the rule says heat paid through rent counts.

The difference is time and cost: Jev was ${d.endToEnd.ratios.speed.toFixed(1)} times faster and ${Math.round(d.endToEnd.ratios.cost)} times cheaper per household. Part of that is the interface. Jev answers every question in one request and bills only the input. Sonnet had to write each answer out, and a schema for a whole household exceeded its provider's grammar limit, so each pass went out in batches of ${d.setup.baselineBatchSize} questions, each repeating the household description.

## Where the general-purpose model did better

On households missing a deciding fact, Sonnet was more accurate, and the difference is significant (p = ${PU.mcnemarP.toFixed(3)}). It asked the maximum three questions in ${B.questionsHistogram[3]} of ${B.households} households, so it more often reached the missing fact. Jev's miss was different: for "I get about $1,025 a month" it answered where the money came from with high confidence, even though the description never says, so no question was asked.

The fix follows from how a typed readout works. A closed question with no way to say "the text doesn't say" forces a choice. That question now has a *not stated* option; when Jev picks it, the answer is treated as open and gets asked. On the development households this raised how often the deciding fact was asked first from ${pct(stages[2].questionRelevance, 0)} to ${pct(stages[3].questionRelevance, 0)}. It was prompted by held-out errors, so it has not been scored on the held-out households, and I am not claiming a held-out number for it.

## Choosing which question to ask

Every open question has a set of possible answers, and for each one BennyFit can rerun every program and see what the household would get. The first version ranked questions by the spread between the best and worst case. That ignores how likely each answer is: whether someone served in the military in wartime swings a veterans pension of about $17,000 a year, so it was asked of nearly everyone and never changed a result.

Questions are now ranked by expected change in dollars, each answer weighted by its probability, and a question expected to move less than $25 a year is not asked. On the held-out households this cut follow-up questions from ${J.questionsTotal} to ${F.questionsTotal}, and the median household is now asked ${F.questionsMedian}. ${F.usefulQuestions.moved} of the ${F.usefulQuestions.answered} questions still asked changed the result. Fully specified accuracy was ${pct(F.specified.right / F.specified.total, 2)}, in line with before.

## Reading the description

Pulling facts out of how people write is where pattern-matching code struggles. Across five fresh sets of hand-labelled descriptions it scored between ${pct(Math.min(...early))} and ${pct(Math.max(...early))}; every new set turned up phrasings it had not seen ("base pay is about $900 and tips add around $1,100", "every other week, about $1,150 after taxes").

The approach that worked is TypeSafe's own recommendation: code finds every number that could be an amount, Jev says what each one is and how often it is paid, and code copies the number and does the sums. Jev never writes a figure. On a sixth fresh set, scored once by each approach, code alone read ${pct(code6.rate)} of facts and code with Jev choosing read ${pct(jev6.rate)}. Monthly income was right in ${incomeJev.correct} of ${incomeJev.total} descriptions against ${incomeCode.correct} of ${incomeCode.total}; in one, code alone had taken a $140 electricity bill as the household's entire income.

## What measuring found

Four errors in the rules themselves turned up along the way, each now pinned by a test: the EITC maximum computed as $8,230.50 against a published $8,231; the dependent care credit counting children aged 13 and over; the Veterans Pension missing its requirement of age 65 or a disability; and pay received twice a month treated as monthly, halving income. The second was found because the first live run disagreed with the answer key, and the key was the one that was wrong.

## What I would not claim

- The households are synthetic, and the answer key is computed by the same rules code BennyFit uses. These figures measure reading, judgement and question choice against a known key, not agreement with agency decisions, and real descriptions are messier.
- The samples are small: ${J.specifiedHouseholds} fully specified and ${J.underspecifiedHouseholds} underspecified held-out households.
- Both models give slightly different answers from run to run, and the comparison is with one general-purpose model.
- The 6%, 11% and 18% are from a trial of human assistance. They are why this is worth building, not something BennyFit has achieved.

Demo: https://bennyfit.vercel.app/demo
Technical report: https://bennyfit.vercel.app/research
Code and data: https://github.com/0xjba/BennyFit
`;

writeFileSync(join(root, 'docs/post.md'), post);
console.log(`wrote docs/post.md (${post.split(/\s+/).length} words)`);
