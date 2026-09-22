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

import { body } from './body';

const root = process.cwd();
const d = JSON.parse(readFileSync(join(root, 'research/data.json'), 'utf8'));
const fig = (name: string) => readFileSync(join(root, 'research/figures', `${name}.svg`), 'utf8').replace(/<\?xml[^>]*>/, '').replace(/<!DOCTYPE[^>]*>/, '');

const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const ci = (c: [number, number]) => `[${(c[0] * 100).toFixed(1)}, ${(c[1] * 100).toFixed(1)}]`;
const usd = (x: number, digits = 4) => `$${x.toFixed(digits)}`;
const n = (x: number) => x.toLocaleString('en-US');
const ed = (e: number, reader = 'code') => d.reading.editions.find((x: { edition: number; reader: string }) => x.edition === e && x.reader === reader);
const field = (k: string, which: 'code' | 'withEngine') => d.reading.sixByField[which][k];

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


const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Screening Households for U.S. Benefit Programs from a Short Description (version 2)</title>
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

${body({ d, pct, ci, usd, n, cite, figure, table, fig, architecture, ed, field, fieldNames: FIELD_NAMES })}

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
