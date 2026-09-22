# BennyFit

**Eligible Americans forgo more than $140 billion in federal benefits every year**, and the effort of finding out what you qualify for is a key reason ([GAO-25-107239](https://www.gao.gov/products/gao-25-107239), citing an OMB estimate).

BennyFit takes that effort away. Describe a household in a few sentences and it screens the household for U.S. federal and state benefit programs at once, asking a follow-up question only where the answer could change what the household gets.

**Live:** [bennyfit.vercel.app](https://bennyfit.vercel.app) · **Demo:** [/demo](https://bennyfit.vercel.app/demo) · **Research:** [/research](https://bennyfit.vercel.app/research) · **Technical report:** [PDF](public/research/bennyfit-technical-report.pdf)

---

## Research

**Screening Households for U.S. Benefit Programs from a Short Description: A Typed-Readout Decision Model Compared with Generative Baselines.** Jobin Ayathil, version 2, September 2026.

Read it [as a PDF](public/research/bennyfit-technical-report.pdf) or [page by page on the site](https://bennyfit.vercel.app/research). A shorter write-up is in [docs/post.md](docs/post.md).

<!-- generated:results:start -->
Jev against Claude Sonnet 5 in the identical pipeline (same descriptions, rules, questions, follow-up loop and answer key), in two configurations, on 49 held-out households:

| | Jev | Sonnet 5, schema, batched | Sonnet 5, one request |
|---|---|---|---|
| Wrong verdicts, households stating every fact (of 819) | 3 | 7 | 14 |
| Households missing a fact with a wrong verdict (of 10) | 4 | 1 | 3 |
| Median time to a full result | 2.2 s | 35.3 s | 29.3 s |
| Cost per household | $0.00057 (list price) | $0.195 (billed) | $0.105 (billed) |

- Against the schema configuration the error difference is not significant (exact McNemar p = 0.34); against the one-request configuration it is (p = 0.013), but those errors are all one misreading of a single criterion. Jev was 13 to 16× faster and 185 to 345× cheaper per household.
- The households missing a fact all withhold the same one (whether income is earned). Jev answered it confidently instead of asking more often than the baselines; a *not stated* option was added in response and has been measured on development households only.
- Ranking follow-ups by expected value cut questions from 81 to 51 on the held-out households.
- Reading fresh descriptions: code with Jev choosing among candidates read 96.0% of hand-labelled facts, against 83.2% for pattern-matching code alone.
- Rules: 34 of 34 hand-computed cases agree with their primary sources.
<!-- generated:results:end -->

Every number above, in the report and in the post, is generated from the committed run files by `research/data.ts`; none is typed by hand. The report covers the method, the confidence intervals and the limitations, starting with the main one: the validation households are synthetic.

---

## How it works

Eligibility is mostly arithmetic, and the arithmetic stays in code. What needs a model is judgement about the text: whether "I get about $1,025 a month" is wages or Social Security, whether rent includes heat, whether a child is under 13.

- **Rules in code.** Every threshold is stored with the period it applies to and the page it was read from, in integer cents. The table in force on the screening date is selected; when a new year's table is not yet published, the previous one is used with a visible notice. State rules are applied for SNAP broad-based categorical eligibility, Medicaid expansion and state earned income credits.
- **Judgements as typed questions.** Each program is a set of criteria, each a yes/no or a choice with a fixed set of options, instantiated per household member. Jev, TypeSafe's typed-readout model, answers every criterion for a household in one request and returns a probability distribution over each question's options rather than generated text.
- **Presumptions and "not stated".** Facts nobody mentions (a Social Security number, for example) carry a declared presumption that is shown with the verdict as a condition. Where a description is silent, a *not stated* option lets the model say so, and the question is then asked instead of guessed.
- **Choosing a follow-up.** For each open question the rules are rerun with each possible answer. Questions are ranked by the expected change in the household's annual benefits, each answer weighted by how likely it is, and one expected to move less than $25 a year is not asked. At most three are asked.
- **Reading the description.** Code finds every span that could be an amount of money; the model says what each one is (pay, rent, a utility bill, child care) and how often it is paid; code copies the number and does every sum. The model never writes a figure. Household size and children are counted in code and cross-checked against the model; if they disagree, the household is asked.

<!-- generated:programs:start -->
**Programs (21):** SNAP, EITC, Child Tax Credit, Lifeline, WIC, School meals, CSFP, LIHEAP, Head Start, Medicare Savings, Extra Help, Medicaid, CHIP, State EITC, Dependent Care Credit, Veterans Pension, Summer EBT, Senior Farmers' Market, CACFP, FDPIR, Weatherization. State rules across 51 jurisdictions.
<!-- generated:programs:end -->

---

## Running it

```bash
npm install
npm run dev
```

With no API key the local fixture answers, and every page says so. The fixture is a keyword matcher, not a model; it lets the loop, the pages and the evaluation harness run offline.

To use Jev, copy `.env.example` to `.env.local`, remove `ENGINE=fixture`, and set:

```bash
TYPESAFE_API_KEY=...        # console.typesafe.ai/keys; the model is pinned to jev-1.13.0
```

The key is read on the server and never reaches the browser. Optional settings:

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | The general-purpose baseline (default `anthropic/claude-sonnet-5`), used by the evaluation and by the live comparison lane |
| `BASELINE_LANES=on` | Turns the live comparison lane on in `/demo`. Off by default: it costs about $0.20 a screening |
| `RATE_LIMIT_PER_VISITOR`, `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_PER_DAY` | Limits on the public screening route (defaults 30 per 10 minutes, 5,000 a day), counted per server instance |

### Pages

| Route | What it is |
|---|---|
| `/` | Landing page |
| `/demo` | The screener |
| `/compare` | One description beside the per-program forms it replaces |
| `/results` | How accuracy is measured, and the current figures |
| `/research` | The author, the measured comparison, and the report in a page-turning reader |

---

## Evaluation

Three things are measured separately, because they fail in different ways.

1. **Rules.** Hand-computed cases, each with its expected figure worked out from a primary source (`eval/conformance.ts`).
2. **Reading.** Descriptions written the way people write, labelled by hand. A held-out set is scored once; once any code is changed in response to it, it joins the development set and a new one is written (`eval/extraction.ts`, `eval/extraction-holdout.ts`).
3. **End to end.** Synthetic households, every third one held out. The confidence threshold is chosen on the development households by a rule fixed in advance; the held-out households are scored once per version of the system (`eval/run.ts`).

```bash
npm test                                       # unit tests
npx tsx eval/run.ts                            # rules, reading, and end to end (held-out households)
npx tsx eval/run.ts --sweep-only               # choose the confidence threshold on the development households
npx tsx eval/run.ts --dev                      # score the development households, for changing the system
npx tsx eval/run.ts --pilot 5                  # five development households, to measure cost first
ENGINE=baseline npx tsx eval/run.ts --out eval/baseline-results.json   # the general-purpose baseline
npx tsx eval/read-dev.ts                       # code parser against code plus Jev, development set
```

### Rebuilding the research

```bash
npx tsx research/data.ts        # every number, from the committed run files
python3 research/charts.py      # every figure, from research/data.json
npx tsx research/build.ts       # the report: HTML, then PDF with Chrome, then page images
npx tsx research/post.ts        # docs/post.md
npx tsx research/readme.ts      # the generated sections of this README
```

`research/build.ts` needs Google Chrome, `pdftoppm` (poppler) and ImageMagick; `research/charts.py` needs matplotlib.

---

## Where the rules come from

Every dollar figure in `data/thresholds/` records the URL it was read from and the date it was read. [`sources/SOURCES.md`](sources/SOURCES.md) lists them, and `sources/raw/` keeps copies of the documents so every figure stays checkable offline: USDA cost-of-living memos and 7 CFR 273 for SNAP, IRS revenue procedures for the tax credits, HHS poverty guidelines, USAC for Lifeline, medicare.gov and va.gov for Medicare programs and the Veterans Pension, and the published state tables for state rules.

The SNAP tables for fiscal year 2027 had not been published when this was built. The income standards are derived from the 2026 poverty guidelines by `scripts/derive-thresholds.py`, which refuses to emit anything unless its rule reproduces every published FY2026 figure; the allotment tables are left empty, and from 1 October 2026 the screener uses the FY2026 tables with a notice that benefit amounts are likely understated.

---

## Layout

```
data/programs/      every eligibility criterion, as data
data/thresholds/    every dollar figure, keyed by the period it is in effect
data/gold/          the synthetic validation households and their verdicts
lib/compute*.ts     the arithmetic
lib/criteria.ts     loading, validating and instantiating criteria
lib/evaluate.ts     state and answers to verdicts
lib/voi.ts          which question is worth asking
lib/read.ts         reading a description with candidates and the model
lib/loop.ts         the screening loop
lib/engine/         Jev, the general-purpose baseline, and the local fixture
eval/               the harness, its results, and every recorded run
research/           the scripts that build the report, its data and figures
sources/            where every figure came from
```

---

## Limitations

- **Synthetic households.** Descriptions were generated from stored facts, and the answer key is computed by the same rules code the system uses. The figures measure reading, judgement and question choice against a known key, not agreement with agency decisions, and real descriptions are messier.
- **Screening, not determination.** Results are estimates with a link to each program's own application. State rules cover SNAP, Medicaid and state earned income credits; other programs use federal limits, which some states and agencies raise.
- **English only.**
- **Privacy.** BennyFit stores nothing a person types. The text is sent to the model provider to be read, so the demo asks people to describe a made-up household.

---

Built by [Jobin Ayathil](https://www.linkedin.com/in/0xjba/) · [GitHub](https://github.com/0xjba) · jobinb6444@gmail.com
