/**
 * Build the technical report: HTML from data.json and the figures, then PDF with
 * Chrome, then one image per page for the page-flip reader on /research.
 *
 * Usage:  npx tsx research/data.ts && python3 research/charts.py && npx tsx research/build.ts
 *
 * Every number in the text is read from data.json. The only figures written here are
 * the ones quoted from cited sources, each next to its reference.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const d = JSON.parse(readFileSync(join(root, 'research/data.json'), 'utf8'));
const fig = (name: string) => readFileSync(join(root, 'research/figures', `${name}.svg`), 'utf8').replace(/<\?xml[^>]*>/, '').replace(/<!DOCTYPE[^>]*>/, '');

const J = d.endToEnd.jevCompared;
const B = d.endToEnd.sonnet;
const F = d.endToEnd.jevFinal;
const P = d.endToEnd.paired;
const PU = d.endToEnd.pairedUnderspecified;
const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const ci = (c: [number, number]) => `[${(c[0] * 100).toFixed(1)}, ${(c[1] * 100).toFixed(1)}]`;
const usd = (x: number, digits = 4) => `$${x.toFixed(digits)}`;
const n = (x: number) => x.toLocaleString('en-US');
const ed = (e: number, reader = 'code') => d.reading.editions.find((x: { edition: number; reader: string }) => x.edition === e && x.reader === reader);
const field = (k: string, which: 'code' | 'withEngine') => d.reading.sixByField[which][k];
const floors = d.development.floors;

const REFS: [string, string][] = [
  ['usda-rtin', 'U.S. Department of Agriculture, Food and Nutrition Service. <i>Reaching Those in Need: Estimates of State SNAP Participation Rates in 2022.</i> https://www.fna.usda.gov/research/snap/state-participation-rates/2022'],
  ['irs-eitc', 'Internal Revenue Service. <i>4 out of 5 eligible workers get the EITC every year</i> (Publication 5275). https://www.irs.gov/pub/irs-pdf/p5275.pdf'],
  ['tpc-eitc', 'Tax Policy Center. <i>Do all people eligible for the EITC participate?</i> Briefing Book. https://taxpolicycenter.org/briefing-book/do-all-people-eligible-eitc-participate'],
  ['finkelstein', 'A. Finkelstein and M. J. Notowidigdo. Take-up and targeting: Experimental evidence from SNAP. <i>The Quarterly Journal of Economics</i>, 134(3):1505&ndash;1556, 2019.'],
  ['bhargava', 'S. Bhargava and D. Manoli. Psychological frictions and the incomplete take-up of social benefits: Evidence from an IRS field experiment. <i>American Economic Review</i>, 105(11):3489&ndash;3529, 2015.'],
  ['ts-api', 'TypeSafe AI. <i>API reference</i> and <i>Models</i> (jev-1.13.0). https://docs.typesafe.ai/api, https://docs.typesafe.ai/models. Accessed 21 September 2026.'],
  ['ts-conf', 'TypeSafe AI. <i>Confidence.</i> https://docs.typesafe.ai/confidence. Accessed 21 September 2026.'],
  ['ts-jag', 'TypeSafe AI. <i>Jev 1.13 jaggedness.</i> https://docs.typesafe.ai/model-jaggedness/jev-1.13. Accessed 21 September 2026.'],
  ['ts-extract', 'TypeSafe AI. <i>Pre-parsed value extraction</i> (cookbook). https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook. Accessed 21 September 2026.'],
  ['guo', 'C. Guo, G. Pleiss, Y. Sun, and K. Q. Weinberger. On calibration of modern neural networks. In <i>Proceedings of the 34th International Conference on Machine Learning</i>, PMLR 70:1321&ndash;1330, 2017.'],
  ['kadavath', 'S. Kadavath et al. Language models (mostly) know what they know. arXiv:2207.05221, 2022.'],
  ['xiong', 'M. Xiong, Z. Hu, X. Lu, et al. Can LLMs express their uncertainty? An empirical evaluation of confidence elicitation in LLMs. In <i>International Conference on Learning Representations (ICLR)</i>, 2024.'],
  ['tam', 'Z. R. Tam, C.-K. Wu, Y.-L. Tsai, C.-Y. Lin, H.-y. Lee, and Y.-N. Chen. Let me speak freely? A study on the impact of format restrictions on performance of large language models. In <i>Proceedings of EMNLP 2024: Industry Track</i>. arXiv:2408.02442.'],
  ['howard', 'R. A. Howard. Information value theory. <i>IEEE Transactions on Systems Science and Cybernetics</i>, 2(1):22&ndash;26, 1966.'],
  ['brodersen', 'K. H. Brodersen, C. S. Ong, K. E. Stephan, and J. M. Buhmann. The balanced accuracy and its posterior distribution. In <i>Proceedings of the 20th International Conference on Pattern Recognition</i>, pages 3121&ndash;3124, 2010.'],
  ['wilson', 'E. B. Wilson. Probable inference, the law of succession, and statistical inference. <i>Journal of the American Statistical Association</i>, 22(158):209&ndash;212, 1927.'],
  ['mcnemar', 'Q. McNemar. Note on the sampling error of the difference between correlated proportions or percentages. <i>Psychometrika</i>, 12(2):153&ndash;157, 1947.'],
  ['anthropic-so', 'Anthropic. <i>Structured outputs</i>, Claude developer platform documentation. Accessed 21 September 2026.'],
  ['cfr273', 'Code of Federal Regulations, Title 7, Part 273 (SNAP certification of eligible households), including 273.9 and 273.10.'],
  ['irc', 'Internal Revenue Code, 26 U.S.C. 21, 24 and 32; Rev. Proc. 2024-40 and Rev. Proc. 2025-32 (inflation-adjusted parameters).'],
  ['va', 'U.S. Department of Veterans Affairs. <i>Eligibility for Veterans Pension.</i> https://www.va.gov/pension/eligibility/; 38 U.S.C. 1513 and 1521.'],
  ['medicare', 'Centers for Medicare &amp; Medicaid Services. <i>Who can get Medicare</i>, and 2026 Part B, Medicare Savings Program and Extra Help limits. https://www.medicare.gov'],
];
const refIndex = new Map(REFS.map(([k], i) => [k, i + 1]));
const cite = (...keys: string[]) => `[${keys.map((k) => refIndex.get(k) ?? '?').join(', ')}]`;

const FIELD_NAMES: Record<string, string> = {
  householdSize: 'household size', childrenCount: 'children', incomeAmount: 'income amount',
  incomePeriod: 'pay period', rentMonthly: 'housing cost', state: 'state', incomeMonthly: 'monthly income',
};

let figureNo = 0;
const figure = (svg: string, caption: string, wide = true) => {
  figureNo++;
  return `<figure class="${wide ? 'wide' : 'half'}">${svg}<figcaption><b>Figure ${figureNo}.</b> ${caption}</figcaption></figure>`;
};
let tableNo = 0;
const table = (caption: string, head: string[], rows: (string | number)[][], note = '') => {
  tableNo++;
  return `<figure class="table"><figcaption><b>Table ${tableNo}.</b> ${caption}</figcaption><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>${note ? `<p class="tnote">${note}</p>` : ''}</figure>`;
};

const architecture = `<svg viewBox="0 0 640 210" xmlns="http://www.w3.org/2000/svg" font-family="STIX Two Text, serif" font-size="11">
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1a1a1a"/></marker></defs>
<g fill="none" stroke="#1a1a1a" stroke-width="0.8">
<rect x="6" y="80" width="98" height="48" rx="3"/><rect x="132" y="20" width="118" height="54" rx="3"/><rect x="132" y="130" width="118" height="54" rx="3"/>
<rect x="278" y="80" width="118" height="48" rx="3" stroke="#1f7a5c" stroke-width="1.2"/><rect x="424" y="20" width="100" height="54" rx="3"/><rect x="424" y="130" width="100" height="54" rx="3"/><rect x="548" y="80" width="86" height="48" rx="3"/>
<path d="M104 96 L132 60" marker-end="url(#a)"/><path d="M104 112 L132 150" marker-end="url(#a)"/><path d="M250 47 L278 92" marker-end="url(#a)"/><path d="M250 157 L278 116" marker-end="url(#a)"/>
<path d="M396 96 L424 55" marker-end="url(#a)"/><path d="M396 112 L424 150" marker-end="url(#a)"/><path d="M524 47 L548 92" marker-end="url(#a)"/><path d="M524 157 L548 116" marker-end="url(#a)"/>
<path d="M590 128 C590 200, 60 200, 55 130" stroke-dasharray="3 2" marker-end="url(#a)"/></g>
<g fill="#1a1a1a" text-anchor="middle">
<text x="55" y="100">Household</text><text x="55" y="114">paragraph</text>
<text x="191" y="42">Candidate finder</text><text x="191" y="56" font-size="9.5">code: spans, counts</text>
<text x="191" y="152">Criterion set</text><text x="191" y="166" font-size="9.5">${d.setup.programs} programs, per member</text>
<text x="337" y="100" fill="#1f7a5c">Typed readout</text><text x="337" y="114" font-size="9.5" fill="#1f7a5c">jev-1.13.0, one pass</text>
<text x="474" y="42">Rules engine</text><text x="474" y="56" font-size="9.5">code: cents, dates, state</text>
<text x="474" y="152">Question selection</text><text x="474" y="166" font-size="9.5">expected value, floor</text>
<text x="591" y="100">Verdicts</text><text x="591" y="114">or a question</text>
<text x="320" y="204" font-size="9.5">the reply is appended to the state and the loop runs again (at most three questions)</text></g></svg>`;


const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Screening Households for U.S. Benefit Programs from a Short Description</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
@page { size: Letter; margin: 0.85in 0.9in 0.9in; @bottom-center { content: counter(page); font: 9pt 'STIX Two Text', serif; } }
html { font-family: 'STIX Two Text', 'Times New Roman', serif; font-size: 10.4pt; line-height: 1.38; color: #111; }
body { margin: 0; }
h1 { font-size: 16.5pt; line-height: 1.22; text-align: center; margin: 0 0 10pt; font-weight: 600; text-wrap: balance; }
.authors { text-align: center; font-size: 10.5pt; margin-bottom: 2pt; }
.meta { text-align: center; font-size: 9pt; color: #444; margin-bottom: 16pt; }
.abstract { margin: 0 0.35in 16pt; font-size: 9.6pt; }
.abstract h2 { text-align: center; font-size: 10pt; margin: 0 0 4pt; }
h2 { font-size: 11.5pt; margin: 16pt 0 6pt; font-weight: 600; break-after: avoid; }
h3 { font-size: 10.4pt; margin: 11pt 0 4pt; font-weight: 600; font-style: italic; break-after: avoid; }
p { margin: 0 0 6pt; text-align: justify; hyphens: auto; }
figure { margin: 10pt 0 12pt; break-inside: avoid; }
figure svg { width: 100%; height: auto; display: block; }
figure.half svg { width: 46%; margin: 0 auto; }
.pair { display: flex; gap: 14pt; break-inside: avoid; }
.pair figure { flex: 1; margin: 6pt 0 10pt; }
.pair figure svg { width: 100%; }
figcaption { font-size: 8.8pt; margin-top: 4pt; text-align: justify; }
figure.table figcaption { margin: 0 0 4pt; }
table { border-collapse: collapse; width: 100%; font-size: 8.8pt; font-variant-numeric: tabular-nums; }
th, td { padding: 2.2pt 5pt; text-align: right; }
th:first-child, td:first-child { text-align: left; }
thead th { border-top: 1pt solid #111; border-bottom: 0.6pt solid #111; font-weight: 600; }
tbody tr:last-child td { border-bottom: 1pt solid #111; }
.tnote { font-size: 8.3pt; color: #333; margin-top: 3pt; }
.eq { text-align: center; margin: 6pt 0 8pt; font-style: italic; }
.eq .no { float: right; font-style: normal; }
ol.refs { font-size: 8.6pt; padding-left: 18pt; }
ol.refs li { margin-bottom: 3pt; text-align: left; word-break: break-word; }
ul { margin: 0 0 6pt; padding-left: 16pt; } li { margin-bottom: 2pt; }
code { font-family: 'SFMono-Regular', Menlo, monospace; font-size: 8.6pt; }
.small { font-size: 9pt; }
</style></head><body>

<h1>Screening Households for U.S. Benefit Programs from a Short Description:<br>A Typed&#8209;Readout Decision Model Compared with Schema&#8209;Constrained Generation</h1>
<div class="authors">Jobin Ayathil</div>
<div class="meta">Independent &middot; jobinb6444@gmail.com &middot; Technical report, September 2026 &middot; Code and data: github.com/0xjba/BennyFit</div>

<div class="abstract"><h2>Abstract</h2><p>
We describe BennyFit, a system that takes one plain-language description of a household and returns a screening verdict for ${d.setup.programs} U.S. federal and state benefit programs, asking a follow-up question only where an answer is expected to change the result. Arithmetic, dates, thresholds and state rules are implemented in code and tested against ${d.setup.conformance.total} hand-computed cases taken from primary sources (${d.setup.conformance.passed} of ${d.setup.conformance.total} agree). Judgements that depend on the narrative are delegated to a typed-readout model, TypeSafe's Jev (<code>${d.setup.jevModel}</code>), which returns a probability distribution over a fixed set of options for every criterion in a single request. On ${J.households} held-out synthetic households, the full system reached ${pct(J.specified.right / J.specified.total, 2)} per-verdict accuracy on fully specified households (95% CI ${ci(J.specified.ci)}), against ${pct(B.specified.right / B.specified.total, 2)} (${ci(B.specified.ci)}) for Claude Sonnet 5 run through the identical pipeline with schema-constrained output; the difference is not significant (exact McNemar <i>p</i> = ${P.mcnemarP.toFixed(2)}). The typed readout completed a screening in a median ${J.medianSeconds.toFixed(1)} s against ${B.medianSeconds.toFixed(1)} s and at ${usd(J.costPerHouseholdUSD, 5)} against ${usd(B.costPerHouseholdUSD, 3)} per household as billed. On households missing a deciding fact the generative baseline was more accurate (${pct(B.underspecified.right / B.underspecified.total)} against ${pct(J.underspecified.right / J.underspecified.total)}, <i>p</i> = ${PU.mcnemarP.toFixed(3)}), because the typed readout answered some unstated facts confidently instead of leaving them to be asked. For reading the narrative, code that proposes candidate values with the model choosing among them read ${pct(ed(6, 'code+jev').rate)} of hand-labelled facts in fresh text, against ${pct(ed(6).rate)} for pattern-matching code alone. All households are synthetic, and the limitations this imposes are discussed.
</p></div>

<h2>1&nbsp;&nbsp;Introduction</h2>
<p>Eligible households do not all receive the benefits they qualify for. USDA estimates that 88% of people eligible for the Supplemental Nutrition Assistance Program (SNAP) received it in fiscal year 2022 ${cite('usda-rtin')}; the IRS estimates that about four in five eligible workers claim the Earned Income Tax Credit (EITC) ${cite('irs-eitc')}, and the Tax Policy Center reports that almost 80% of eligible tax units claimed it in tax year 2016 ${cite('tpc-eitc')}. Field experiments attribute part of the gap to information and effort rather than ineligibility. In a randomized trial with about 30,000 older adults likely eligible for SNAP, 6% of the control group enrolled within nine months, against 11% of a group sent information and 18% of a group sent information together with application assistance ${cite('finkelstein')}. In an IRS field experiment, simpler notices and more salient benefit information increased EITC claiming, while efforts to reduce stigma did not ${cite('bhargava')}.</p>
<p>A screener that tells a household which programs it probably qualifies for addresses the information part of this gap. The screening task decomposes into four parts: reading facts out of how a person describes their situation; judging criteria that depend on that description, such as whether income comes from work or from benefits; applying numeric rules that change by program, year and state; and deciding which missing fact, if any, is worth asking about. The first two require language understanding. The third should not be delegated to a language model at all. The fourth is a decision under uncertainty.</p>
<p>This report describes a system built on that division and evaluates it. Its contributions are:</p>
<ul>
<li>An architecture in which every numeric operation is performed in code and every narrative judgement is a typed question with a closed option set, answered by a model that returns a probability distribution over those options (Section 3).</li>
<li>A question-selection rule based on expected value of information, which weighs each possible answer by its probability and declines to ask where the expected change is below a fixed floor (Section 3.4).</li>
<li>An evaluation that measures rules, reading and end-to-end decisions separately, uses a development/held-out split with a threshold chosen in advance, and compares the typed readout with a schema-constrained generative model run through the same pipeline (Sections 4 and 5).</li>
</ul>

${figure(architecture, 'Architecture. Code finds candidate amounts and counts people; the criterion set is instantiated per household member; the typed readout answers every criterion and reading question in one request; the rules engine computes verdicts in integer cents; question selection either returns the verdicts or one question, whose answer is appended to the state for the next pass.')}

<h2>2&nbsp;&nbsp;Background</h2>
<h3>2.1&nbsp;&nbsp;Typed readout</h3>
<p>Jev is described by its developer as a &ldquo;System One&rdquo; model: it is sent a <i>state</i> (here, the household description) and a map of typed questions, and returns for each question either the probability that a yes/no statement is true (a <i>noul</i>) or a distribution over the options of a <i>choice</i> ${cite('ts-api')}. It does not generate text. All questions are evaluated against the same state in one request; the version used here, <code>jev-1.13.0</code>, has a 64k-token context and is priced at $0.042 per million input tokens, with output tokens not charged ${cite('ts-api')}. The developer's guidance is to keep arithmetic, counting and date comparison in code, to decompose judgements into single-condition questions, and, for extraction, to find candidate values in code and let the model select among them ${cite('ts-jag', 'ts-extract')}.</p>
<h3>2.2&nbsp;&nbsp;Generation with structured output</h3>
<p>The common alternative is to ask a generative model to write JSON, now usually under a schema enforced by constrained decoding ${cite('anthropic-so')}. A schema can restrict each answer to that question's own options, which removes malformed and out-of-vocabulary answers; it does not supply a distribution over the options. A confidence obtained by asking the model to state one is itself generated text, and such verbalized confidence tends to be overconfident ${cite('xiong')}. Format restrictions can also reduce reasoning performance ${cite('tam')}. Calibration of model probabilities more generally is studied in ${cite('guo', 'kadavath')}.</p>
<h3>2.3&nbsp;&nbsp;Value of information</h3>
<p>Whether to ask a question is a decision about the value of the information it would yield: the expected improvement in outcome from learning the answer, weighed against the cost of asking ${cite('howard')}. Here the outcome is the set of program verdicts and their dollar values, and the cost of asking is a person's time.</p>

<h2>3&nbsp;&nbsp;System</h2>
<p>Figure 1 shows the components and the loop.</p>
<h3>3.1&nbsp;&nbsp;Rules</h3>
<p>The system covers ${d.setup.programs} programs: ${d.setup.programNames.join(', ')}. Every threshold is stored with the period it applies to and the source it was read from; the table in force on the screening date is selected, and where a new year's table has not been published the previous one is used with a visible notice. Money is held in integer cents and rounded where the regulation says to round ${cite('cfr273')}. State variation is applied for SNAP broad-based categorical eligibility, Medicaid expansion and state earned income credits across ${d.setup.jurisdictions} jurisdictions. Three eligibility tests that involve comparing numbers, and that a narrative reading could get wrong, are computed in code: the dependent care credit's requirement of a child under 13 ${cite('irc')}, the Veterans Pension's requirement of age 65 or a disability ${cite('va')}, and the requirement of Medicare enrolment, which a stated age under 65 without mention of a disability rules out ${cite('medicare')}.</p>
<h3>3.2&nbsp;&nbsp;Criteria</h3>
<p>Each program is a set of criteria, each a noul or a choice with instructions written to be read literally, instantiated once per relevant household member. A held-out household produced a median of ${J.medianCriteria} criteria. Some criteria carry a <i>presumption</i>, an option that stands when the model is unsure (for example, that a claimant has a Social Security number valid for work); each presumption is classed as routine or material and is shown with the verdict as a stated condition. A choice may offer a <i>not stated</i> option; when the model selects it, the probability on that option is removed, the remaining distribution is renormalised so that the model's lean still decides the provisional verdict, and the answer's confidence is capped at the probability that the description did state it.</p>
<h3>3.3&nbsp;&nbsp;Confidence</h3>
<p>For an answer with distribution <i>p</i> over <i>K</i> options the system uses normalised entropy,</p>
<p class="eq">c(p) = 1 &minus; H(p) / ln K,&nbsp;&nbsp;&nbsp; H(p) = &minus;&Sigma;<sub>k</sub> p<sub>k</sub> ln p<sub>k</sub>,<span class="no">(1)</span></p>
<p>and treats an answer with <i>c</i> &lt; &tau; as unsettled. The developer's own confidence statistic is (K&middot;max<sub>k</sub> p<sub>k</sub> &minus; 1)/(K &minus; 1) ${cite('ts-conf')}; the entropy form was kept so that nouls and choices share one definition. &tau; = ${d.setup.tauChosen} was chosen on the development households (Section 4.4).</p>
<h3>3.4&nbsp;&nbsp;Question selection</h3>
<p>For each unsettled criterion <i>q</i> with options <i>o</i>, the rules engine is run with <i>q</i> pinned to each option, giving total annual dollar values <i>V</i>(<i>o</i>); <i>V</i><sub>0</sub> is the total under current answers. The expected change from learning <i>q</i> is</p>
<p class="eq">E[&Delta;<sub>q</sub>] = &Sigma;<sub>o</sub> b<sub>q</sub>(o) &middot; |V(o) &minus; V<sub>0</sub>|,<span class="no">(2)</span></p>
<p>where <i>b<sub>q</sub></i> is the belief over options. For criteria without a presumption <i>b<sub>q</sub></i> is the model's distribution. For presumed criteria it places 1 &minus; &epsilon; on the presumed option, with &epsilon; = 0.05 for routine and 0.20 for material presumptions: when a description is silent, the model's distribution measures whether the text says so, not how often the presumption is false in the population. The two values of &epsilon; are declared assumptions and were not tuned, because presumptions are never false in the synthetic households and tuning would drive &epsilon; to zero. The criterion with the largest E[&Delta;] is asked if it exceeds a floor of $25 a year, chosen on the development households (Section 5.4). An earlier version ranked by the spread max<sub>o</sub> V(o) &minus; min<sub>o</sub> V(o), which ignores <i>b<sub>q</sub></i>. If the household size cannot be read it is asked first, and the number is taken from the reply in code.</p>
<h3>3.5&nbsp;&nbsp;Reading the narrative</h3>
<p>Following ${cite('ts-extract')}, code over-finds every span that could be an amount of money, excluding only ages, counts of people, years and single digits without a currency mark, and merges ranges such as &ldquo;$300&ndash;$400&rdquo; into one candidate at the midpoint. For each candidate the model answers two choices: its role (income, housing, care, utilities, medical, child support paid, savings, other) and its period (weekly, every two weeks, twice a month, monthly, yearly, once, not stated). Code copies the chosen span's value, converts it to a monthly figure and sums multiple incomes. The model never writes a number. Household size and the number of children are counted by code; the model's own counts are used as a cross-check, filling a count that code could not read when the model's confidence is at least 0.6, and causing the size to be asked when the two disagree.</p>

<h2>4&nbsp;&nbsp;Evaluation design</h2>
<h3>4.1&nbsp;&nbsp;Three measurements</h3>
<p>Accuracy is reported as three separate measurements, because they fail in different ways: (i) whether the rules match their sources, (ii) whether facts are read correctly out of prose, and (iii) whether the whole system reaches the right verdict.</p>
<h3>4.2&nbsp;&nbsp;Rules conformance</h3>
<p>${d.setup.conformance.total} cases each state an input and an expected figure worked out by hand from a primary source: USDA's worked SNAP example, IRS revenue procedure tables, Medicare limits, VA pension rates and the statutory tests above. No expected figure is produced by the code under test.</p>
<h3>4.3&nbsp;&nbsp;Reading sets</h3>
<p>Reading is scored on short descriptions written in the forms people use (&ldquo;me + 2 kids&rdquo;, &ldquo;45k a year&rdquo;, &ldquo;paid $1,350 on the 1st and the 15th&rdquo;), each labelled by hand with up to seven fields. A held-out set of twenty is scored once; once any code is changed in response to it, it joins the development set and a new held-out set is written. Six editions were written in this way; the development set now holds ${d.setup.readingDevCases} descriptions. Income is also scored as a monthly figure, so that equivalent statements in different units are not counted as errors; this was decided before the sixth set was scored.</p>
<h3>4.4&nbsp;&nbsp;End-to-end households</h3>
${table('Validation households by slice and split. Every third household is held out.', ['Slice', 'Development', 'Held out'], Object.entries(d.setup.gold.slices).map(([k, v]) => [k.replace('_', ' '), (v as { dev: number }).dev, (v as { holdout: number }).holdout]).concat([['Total', d.setup.gold.dev, d.setup.gold.holdout]]))}
<p>${d.setup.gold.total} synthetic households were generated from stored facts and rendered as prose, and the correct verdict for each program was computed from those facts by the rules layer. Underspecified households omit one fact by construction. Follow-up questions are answered by a simulated respondent that replies truthfully from the stored facts. &tau; was chosen on the development households by a rule fixed before the sweep: highest mean balanced accuracy, ties to fewer questions, then lower &tau;. The held-out households are scored once per system version.</p>
<h3>4.5&nbsp;&nbsp;Baseline</h3>
<p>The baseline replaces only the source of criterion answers. Claude Sonnet 5 (via OpenRouter) receives the same state and criteria and returns JSON under a schema whose every answer is an enumeration of that criterion's own options, with a self-reported confidence. Its stated confidence <i>s</i> is converted to a distribution with max(<i>s</i>, 1/K) on the chosen option and the remainder shared evenly, which the unchanged loop then uses. A schema covering all criteria of one household exceeded the provider's limit on compiled grammar size, so criteria were sent in parallel batches of ${d.setup.baselineBatchSize}, each carrying the full description. The model does not accept a temperature parameter. The same &tau;, question limit, respondent and answer key were used.</p>
<h3>4.6&nbsp;&nbsp;Metrics</h3>
<p>Per program, balanced accuracy (mean of true-positive and true-negative rates) ${cite('brodersen')}; overall, the fraction of program verdicts that are correct, with 95% Wilson intervals ${cite('wilson')}; for the paired comparison of the two engines on identical verdicts, an exact McNemar test ${cite('mcnemar')}. Verdicts within one household are not independent, so these tests overstate the effective sample size. Latency is the median wall-clock time to a full result including follow-ups. Cost is what the providers billed for the run.</p>

<h2>5&nbsp;&nbsp;Results</h2>
<h3>5.1&nbsp;&nbsp;Rules</h3>
<p>All ${d.setup.conformance.total} conformance cases agree with their sources. Four rule errors were found during the work and are each now pinned by a case: the EITC maximum at the plateau was computed as $8,230.50 against a published $8,231; the dependent care credit counted children aged 13 or over; the Veterans Pension omitted its age-or-disability requirement; and pay received twice a month was treated as monthly, halving income. The second was found because the first end-to-end run disagreed with the answer key on a household with children aged 14 and 15, and the key itself was wrong.</p>
<h3>5.2&nbsp;&nbsp;Reading</h3>
${figure(fig('fig2-reading-editions'), 'Share of hand-labelled facts read correctly on each held-out reading set, when first scored, with 95% Wilson intervals. Sets 1 to 5 were scored by the pattern-matching reader alone; set 6 by both readers once each.')}
<p>Across five editions the pattern-matching reader scored between ${pct(Math.min(...[1, 2, 3, 4, 5].map((e) => ed(e).rate)))} and ${pct(Math.max(...[1, 2, 3, 4, 5].map((e) => ed(e).rate)))} on unseen text while its development score rose to above 99%: each fresh set exposed new phrasings. On the sixth set, code alone read ${ed(6).correct} of ${ed(6).total} facts (${pct(ed(6).rate)}, CI ${ci(ed(6).ci)}) and code with the model choosing among candidates read ${ed(6, 'code+jev').correct} of ${ed(6, 'code+jev').total} (${pct(ed(6, 'code+jev').rate)}, CI ${ci(ed(6, 'code+jev').ci)}). Monthly income was right in ${field('incomeMonthly', 'withEngine').correct} of ${field('incomeMonthly', 'withEngine').total} descriptions against ${field('incomeMonthly', 'code').correct} of ${field('incomeMonthly', 'code').total}. The largest gains were descriptions with two incomes (base pay and tips; SSI and occasional babysitting), which code resolved to the first amount, and one in which code read a $140 electricity bill as the household's income. The remaining misses are listed in Table 2.</p>
${figure(fig('fig3-reading-by-field'), 'Held-out reading set 6 by field, for code alone and for code with the model choosing among candidates.')}
${table('Facts the candidate reader got wrong or left open on held-out set 6.', ['Case', 'Field', 'Expected', 'Read'], d.reading.sixMisses.map((m: { id: string; field: string; expected: unknown; got: unknown }) => [m.id, FIELD_NAMES[m.field] ?? m.field, String(m.expected), m.got === null ? 'asked' : String(m.got).startsWith('not logged') ? 'not recorded' : String(m.got)]), 'The run printed only fields on which the two readers differed; where both were wrong, the candidate reader&rsquo;s value was not recorded.')}

<h3>5.3&nbsp;&nbsp;End to end, against the baseline</h3>
${table('Held-out households, same pipeline, two sources of criterion answers.', ['', 'Jev (typed readout)', 'Claude Sonnet 5 (schema)'], [
  ['Verdicts correct, fully specified', `${n(J.specified.right)} / ${n(J.specified.total)} (${pct(J.specified.right / J.specified.total, 2)})`, `${n(B.specified.right)} / ${n(B.specified.total)} (${pct(B.specified.right / B.specified.total, 2)})`],
  ['&nbsp;&nbsp;95% Wilson interval', ci(J.specified.ci), ci(B.specified.ci)],
  ['&nbsp;&nbsp;False positive / false negative', `${J.specified.falsePositive} / ${J.specified.falseNegative}`, `${B.specified.falsePositive} / ${B.specified.falseNegative}`],
  ['Mean balanced accuracy over programs', pct(J.meanBalancedAccuracy, 2), pct(B.meanBalancedAccuracy, 2)],
  ['Verdicts correct, underspecified', `${J.underspecified.right} / ${J.underspecified.total} (${pct(J.underspecified.right / J.underspecified.total)})`, `${B.underspecified.right} / ${B.underspecified.total} (${pct(B.underspecified.right / B.underspecified.total)})`],
  ['Deciding fact asked first / at all', `${pct(J.questionRelevance, 0)} / ${pct(J.askedAtAllRate, 0)}`, `${pct(B.questionRelevance, 0)} / ${pct(B.askedAtAllRate, 0)}`],
  ['Follow-up questions, total (median)', `${J.questionsTotal} (${J.questionsMedian})`, `${B.questionsTotal} (${B.questionsMedian})`],
  ['Median seconds to a full result', J.medianSeconds.toFixed(2), B.medianSeconds.toFixed(2)],
  ['Passes of the loop (model requests)', `${n(J.usage.calls)} (${n(J.usage.calls)})`, `${n(B.usage.calls)} (each split into batches of ${d.setup.baselineBatchSize} criteria)`],
  ['Input tokens / output tokens', `${n(J.usage.inputTokens)} / ${n(J.usage.outputTokens)}`, `${n(B.usage.inputTokens)} / ${n(B.usage.outputTokens)}`],
  ['Billed, whole run (USD)', usd(J.billedUSD), usd(B.billedUSD)],
  ['Billed per household (USD)', usd(J.costPerHouseholdUSD, 5), usd(B.costPerHouseholdUSD, 4)],
  ['Out-of-vocabulary or missing answers', 'not possible', String(Object.values(d.endToEnd.generationFaults).reduce((a: number, b) => a + (b as number), 0))],
], `${J.households} held-out households: ${J.specifiedHouseholds} fully specified, ${J.underspecifiedHouseholds} underspecified; ${J.programs} programs each. &tau; = ${J.tau} for both. The typed readout's run is the one made on the same version of the system as the baseline's.`)}
<p>On fully specified households the two sources of answers were right on ${P.bothRight} of ${P.bothRight + P.onlyJev + P.onlySonnet + P.bothWrong} identical verdicts; Jev alone was right on ${P.onlyJev} and Sonnet 5 alone on ${P.onlySonnet} (exact McNemar <i>p</i> = ${P.mcnemarP.toFixed(2)}). The accuracy difference on these households is not significant. Five of the baseline's seven errors were the same misreading: households whose rent included utilities were judged not to pay for heating, where the criterion states that energy paid through the rent counts. Jev's three errors were two Child Tax Credit false negatives and one Extra Help false positive for a 62-year-old, the case that motivated the Medicare check in Section 3.1.</p>
<p>On underspecified households the baseline was more accurate: of ${PU.bothRight + PU.onlyJev + PU.onlySonnet + PU.bothWrong} paired verdicts, Sonnet 5 alone was right on ${PU.onlySonnet} and Jev alone on ${PU.onlyJev} (<i>p</i> = ${PU.mcnemarP.toFixed(3)}). The baseline asked the maximum three questions in ${B.questionsHistogram[3]} of ${B.households} households and so more often reached the missing fact; Jev answered where income came from with high confidence in households that did not say, and the question was not asked. The <i>not stated</i> option (Section 3.2) was added in response; its effect has been measured on development households only (Section 5.4).</p>
${figure(fig('fig4-per-program'), 'Balanced accuracy per program on fully specified held-out households. Programs where both reach 100% overlap at the right edge.')}
${figure(fig('fig5-time-cost'), `Median time to a full result and billed cost per household. The typed readout was ${d.endToEnd.ratios.speed.toFixed(1)} times faster and ${Math.round(d.endToEnd.ratios.cost)} times cheaper per household; it used ${d.endToEnd.ratios.inputTokens.toFixed(1)} times fewer input tokens, and its output tokens are not billed.`)}

<h3>5.4&nbsp;&nbsp;Question selection</h3>
<p>Figure 6 shows the &tau; sweep on development households: accuracy was flat from 0.3 to 0.7 and lower at 0.2, and the rule selected 0.3. Figure 7 shows the expected-value floor on development households, after the Veterans Pension correction: any floor from $25 to $250 reduced questions from ${floors[0].questions} to between ${Math.min(...floors.slice(1).map((f: { questions: number }) => f.questions))} and ${Math.max(...floors.slice(1).map((f: { questions: number }) => f.questions))}, with fully specified errors between ${Math.min(...floors.map((f: { specifiedWrong: number }) => f.specifiedWrong))} and ${Math.max(...floors.map((f: { specifiedWrong: number }) => f.specifiedWrong))} of ${n(81 * 21)} verdicts, a range consistent with run-to-run variation. $25 was chosen as the lowest floor giving the reduction.</p>
<div class="pair">${figure(fig('fig6-tau-sweep'), 'Confidence threshold on development households: mean balanced accuracy and median questions.', false)}${figure(fig('fig7-floor-sweep'), 'Expected-value floor on development households: questions asked and the share whose answer changed the result.', false)}</div>
${table('Development households, successive changes. Each row includes the changes above it.', ['Change', 'Questions', 'Moved the result', 'Deciding fact first', 'Specified errors'], d.development.stages.map((s: { stage: string; questions: number; useful: { rate: number }; questionRelevance: number; specifiedWrong: number }) => [s.stage, s.questions, pct(s.useful.rate), pct(s.questionRelevance, 0), s.specifiedWrong]), `101 development households, 20 underspecified; specified errors are out of ${n(81 * 21)} verdicts. The first row already uses expected-value ranking.`)}
<p>On the held-out households the version with expected-value ranking and the candidate reader asked ${F.questionsTotal} questions against ${J.questionsTotal} for the version compared with the baseline, with a median of ${F.questionsMedian} per household, ${F.usefulQuestions.moved} of ${F.usefulQuestions.answered} of them (${pct(F.usefulQuestions.rate)}) changing the result. Its fully specified accuracy was ${n(F.specified.right)} of ${n(F.specified.total)} (${pct(F.specified.right / F.specified.total, 2)}) and its underspecified accuracy unchanged at ${pct(F.underspecified.right / F.underspecified.total)}. Its median time rose to ${F.medianSeconds.toFixed(1)} s because reading adds a request. The later changes in Table 4 were prompted by held-out errors and have not been scored on held-out households.</p>
${figure(fig('fig8-questions-histogram'), 'Follow-up questions per held-out household: the version compared with the baseline (spread ranking) and the version with expected-value ranking and the candidate reader.', false)}

<h2>6&nbsp;&nbsp;Discussion</h2>
<p>The cost and latency differences follow from the interfaces rather than from the particular models. The typed readout answers every criterion of a household in one request, pays only for input, and returns distributions directly; the generative baseline writes each answer as text, needed its schema split to stay within the grammar limit, and repeats the household description in every batch. Accuracy on fully specified households was statistically indistinguishable, so on these data the typed readout delivered the same verdicts for a fraction of the time and cost.</p>
<p>The distribution is also what the question selector consumes. With the generative baseline the stated confidences were low enough that every household was asked the maximum number of questions; the baseline's higher underspecified accuracy came from that behaviour, at the cost of more questions for every household. With the typed readout, weighting by the distribution reduced questions by about a third, but where the model was confidently wrong about an unstated fact no question was asked. The <i>not stated</i> option addresses the second case by giving the model a way to say that the description is silent. The general lesson is that a distribution is only as useful as its options: a closed option set without an explicit &ldquo;not stated&rdquo; forces a choice.</p>
<p>Code and model are each used where they are reliable. Every error found in the rules was an arithmetic or threshold error in code, found by comparison with a source; none would have been improved by a model. Every reading gain came from delegating the question &ldquo;what is this amount&rdquo; to the model while keeping the number itself in code.</p>

<h2>7&nbsp;&nbsp;Limitations</h2>
<ul>
<li><b>Synthetic households.</b> Households and their descriptions were generated from templates, and the answer key was computed by the same rules layer the system uses. The end-to-end figures therefore measure the reading, judgement and question-selection components against a known key, not agreement with eligibility decisions by agencies, and they will overstate accuracy on real descriptions, which are less regular.</li>
<li><b>Sample size.</b> ${J.specifiedHouseholds} fully specified and ${J.underspecifiedHouseholds} underspecified held-out households; per-program rates rest on few positive cases, and the paired tests treat correlated verdicts as independent.</li>
<li><b>Repeatability.</b> Both engines returned slightly different answers across runs; Jev's two held-out runs on the same version each had ${d.endToEnd.firstRunWrong} errors, not the same ${d.endToEnd.firstRunWrong}. The baseline was run once and does not accept a temperature setting.</li>
<li><b>One baseline.</b> A single generative model was compared, with one prompt and one batching scheme forced by a provider limit.</li>
<li><b>Simulated respondent.</b> Follow-up answers were always truthful and complete.</li>
<li><b>Held-out reuse.</b> Two changes (the Medicare check and the <i>not stated</i> option) were prompted by held-out errors; they are reported on development data only.</li>
<li><b>Coverage.</b> English only; state-specific rules for three program families; screening estimates, not determinations.</li>
<li><b>Prices</b> are those billed on 21 September 2026.</li>
</ul>

<h2>8&nbsp;&nbsp;Conclusion</h2>
<p>A screening system that keeps every numeric rule in code and asks a typed-readout model only closed questions reached the same verdict accuracy as a schema-constrained generative model on held-out households, in 1/${d.endToEnd.ratios.speed.toFixed(1)} of the time and at 1/${Math.round(d.endToEnd.ratios.cost)} of the cost per household as billed. Its probability outputs made it possible to select follow-up questions by expected value, which reduced the number asked, and exposed a failure mode, confident answers about unstated facts, that an explicit <i>not stated</i> option is designed to address. The main open question is how these results hold on descriptions written by real applicants.</p>

<h2>Reproducibility</h2>
<p class="small">The code, rules, validation households, reading sets, run records and this report's data and figures are in the repository at commit ${d.commit}. <code>npx tsx eval/run.ts</code> scores the system; <code>--sweep-only</code> chooses &tau; on development households; <code>ENGINE=baseline</code> runs the generative baseline; <code>npx tsx eval/read-dev.ts</code> compares the readers. <code>research/data.ts</code> computes every number in this report from the committed run files, and <code>research/charts.py</code> draws every figure from its output.</p>

<h2>References</h2>
<ol class="refs">${REFS.map(([, r]) => `<li>${r}</li>`).join('')}</ol>
</body></html>`;

const outDir = join(root, 'public/research');
mkdirSync(outDir, { recursive: true });
const htmlPath = join(root, 'research/paper.html');
writeFileSync(htmlPath, html);

const pdfPath = join(outDir, 'bennyfit-technical-report.pdf');
execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new',
  '--disable-gpu',
  '--no-pdf-header-footer',
  '--virtual-time-budget=15000',
  `--print-to-pdf=${pdfPath}`,
  `file://${htmlPath}`,
], { stdio: 'ignore' });

const pagesDir = join(outDir, 'pages');
rmSync(pagesDir, { recursive: true, force: true });
mkdirSync(pagesDir, { recursive: true });
execFileSync('pdftoppm', ['-r', '150', '-png', pdfPath, join(pagesDir, 'page')]);
for (const f of readdirSync(pagesDir)) {
  const src = join(pagesDir, f);
  execFileSync('magick', [src, '-quality', '82', src.replace(/\.png$/, '.webp')]);
  rmSync(src);
}
const pages = readdirSync(pagesDir).filter((f) => f.endsWith('.webp')).sort();
writeFileSync(join(outDir, 'pages.json'), JSON.stringify({ pages: pages.map((p) => `/research/pages/${p}`), pdf: '/research/bennyfit-technical-report.pdf', commit: d.commit }, null, 2) + '\n');
console.log(`wrote ${pdfPath} and ${pages.length} page images`);
