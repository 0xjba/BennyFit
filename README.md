# bennyfit

A benefits screener. You describe your household once, in your own words, and every
eligibility criterion for three federal programs is read off that one description in a
single pass. Where the description does not settle something that changes the outcome,
you get one question rather than three application forms.

The programs are SNAP, the Earned Income Tax Credit and Lifeline. They were chosen
because each has a federal rule set with a primary-source table behind it, and because
they chain: SNAP enrollment is itself a Lifeline qualifier, so one answer about SSI can
settle criteria in two programs at once.

---

## What is actually new here

A decision model returns, for each criterion, a probability distribution over the
options that criterion offers. Systems built on this treat those probabilities as the
output — the answer, plus a confidence to display or threshold on.

Here they are a control signal. A flat distribution is the model reporting that the
description does not decide that criterion, and the system's job is then to work out
which of those unsettled criteria is worth a person's time to answer.

Uncertainty on its own is not a reason to ask. A criterion is worth asking about only
when forcing each of its options in turn changes the total dollars across all three
programs. That is the whole definition:

```
voi(c) = max over options o of  total(evaluate(state, answers with c pinned to o))
       − min over options o of  total(evaluate(state, answers with c pinned to o))
```

A criterion with `voi = 0` is never asked, however uncertain the model is about it.
Among those that do move money, the largest is asked first, and ties break toward the
criterion that settles the most programs at once. After each answer the entire state is
re-read rather than patched, because one fact can settle criteria across several
programs, and re-reading everything is one batched pass rather than one generation per
criterion.

---

## Running it

```bash
npm install
npm run dev
```

With no API key the local fixture answers, and every surface says so. The fixture is a
keyword matcher, not a model; it exists so the loop, the interfaces and the evaluation
harness can run without a key.

To use a real engine, copy `.env.example` to `.env.local` and set one of:

```bash
ENGINE=openjev
OPENJEV_API_KEY=...

# or
ENGINE=jev
JEV_API_KEY=...
```

Both speak the same wire API, so the swap is one variable. The key is read in the route
handler and never reaches the browser.

```bash
npm test                        # 37 tests
npx tsx eval/run.ts             # run the gold set, write eval/results.json
npx tsx eval/run.ts --sweep     # also sweep tau
npx tsx scripts/generate-gold.ts        # regenerate the gold set
python3 scripts/derive-thresholds.py    # re-derive the FY2027 income standards
```

Three surfaces: `/` is the screener, `/demo` puts the conventional path beside it, and
`/method` explains what the numbers mean.

---

## The numbers

Run `npx tsx eval/run.ts` and read `eval/results.json`. The accuracy strip at the bottom
of every page reads from that file, and says "not yet evaluated" when it is missing
rather than showing a zero.

**These figures currently come from the local fixture.** They demonstrate that the
harness runs. They measure nothing about any model, and the fixture's keyword cues were
adjusted while looking at gold-set failures, which is a form of fitting. Every number
below has to be produced again against a real engine before it means anything.

| Metric | What it is |
|---|---|
| Balanced accuracy, per program | Mean of the true-positive and true-negative rates, over the 120 fully specified households. Plain accuracy is not reported as the headline because the set is four-fifths eligible for SNAP and answering "eligible" to everything would score 80% on it. |
| Question relevance | Share of the 30 underspecified households where the first question asked was the fact the description deliberately withheld. |
| Criteria per household | Resolved in one batched pass. Scales with household size, because the EITC child tests are genuinely per child. |
| Wall clock | Measured, not claimed. |

τ, the confidence at or above which an answer counts as settled, was swept from 0.2 to
0.8 rather than picked. Balanced accuracy is flat from 0.2 through 0.6; relevance is
highest below 0.5 and collapses above 0.6, where the loop starts re-asking about the
income period it had already read correctly. The value in use sits in the middle of the
plateau. It is provisional until swept against a real engine.

---

## Where the figures come from

Every dollar amount in `data/thresholds/` carries the URL it was read from and the date
it was read. `sources/SOURCES.md` lists them, and `sources/raw/` holds copies of the
documents so the figures stay checkable offline.

- SNAP FY2026 allotments, deductions, income standards and minimum allotment: the USDA
  COLA memos for FY2026.
- SNAP mechanics — deduction order, the 8.31% standard deduction rule, the shelter cap
  exemption, the 30% contribution and its rounding, the 8%-of-the-one-person-allotment
  minimum: 7 CFR 273.8 through 273.10, retrieved through the eCFR API.
- EITC tax years 2025 and 2026: Revenue Procedures 2024-40 and 2025-32.
- Poverty guidelines: HHS ASPE, 2026.
- Lifeline income table, qualifying programs and benefit amounts: USAC.

Two things worth recording, because third-party summaries get them wrong:

**The minimum SNAP allotment is $24, not $23.** The FY2026 memo says $24, and the
regulation independently derives it: 8% of the $298 one-person maximum allotment is
$23.84.

**A married claimant filing separately is not barred from the EITC.** IRC 32(d) admits
one who is legally separated, or who lived apart from their spouse for the last six
months of the year with a qualifying child living with them, and both revenue procedures
apply the non-joint thresholds to exactly that person.

### What could not be obtained

The SNAP FY2027 COLA memo. Its page exists and was last updated in August 2026, but it
carries no tables, nothing is linked from the COLA index, and every candidate document
URL returns 404. Search results quote specific FY2027 figures attributed to a USDA
guidance-portal PDF that will not open. **Those figures are deliberately absent from this
code.**

What is present for FY2027 is the income standards, derived from the 2026 poverty
guidelines by `scripts/derive-thresholds.py`. The rule — monthly limit is the annual
guideline times the percentage, divided by twelve, rounded up — reproduces all 33
published FY2026 figures, and the script refuses to emit anything unless it does. The
allotment and deduction tables are `null`, the set is marked `partial`, and the code
refuses to compute a benefit from a partial set. On 1 October 2026 the fiscal year turns
over and the app falls back to the FY2026 tables with a visible notice saying benefit
amounts are likely understated, rather than inventing a table or refusing to run.

---

## How it is put together

```
data/programs/*.json     every eligibility criterion, as data
data/thresholds/*.json   every dollar figure, keyed by the period it is in effect
data/gold/               150 synthetic households with verdicts
lib/compute.ts           the arithmetic; nothing here is ever sent to the engine
lib/criteria.ts          loading, validating and instantiating the criteria
lib/evaluate.ts          state plus answers to verdicts
lib/voi.ts               which question is worth asking
lib/loop.ts              the driver
lib/engine/              one interface, adapters for Jev and OpenJev, a local fixture
eval/                    the harness and its output
sources/                 where every figure came from
```

The program files are the substance. A criterion carries separate text for the model and
for a person, an effect describing declaratively how an answer changes the verdict, and
a citation. They are validated at load rather than at request time, so a verdict
expression naming a criterion that does not exist stops the process starting instead of
producing a wrong verdict for one unlucky household.

Money is integer cents throughout. The federal rounding steps disagree with each other —
SNAP carries net income to the cent while rounding the household's 30% contribution up to
the next dollar — and those distinctions do not survive floating point.

Criteria have a scope. Household-scoped ones appear once; member- and child-scoped ones
appear once per person, because the underlying rules are per person. Whether a child
meets the EITC residency test is a fact about that child, and answering it once for a
household would get it wrong.

### Presumptions

Some criteria ask about facts a narrative never states. Nobody writes "I have a Social
Security number valid for employment" when describing their household, and reading
silence as a no disqualified nearly every household from the EITC. Such criteria declare
a presumption: what a screening should assume in the absence of evidence. The interface
shows a presumed answer as presumed, and presumed criteria rank below every other
candidate when choosing a question, since the presumption is a declaration that silence
has a known meaning.

---

## Known limitations

- **Federal floor only.** 42 states and DC raise the SNAP gross limit through broad-based
  categorical eligibility and many drop the asset test. This under-screens in those
  states, and says so on screen. A state selector is not built.
- **Mixed income is split evenly.** When a household has both earned and unearned income
  and does not say how much of each, the split is assumed to be half and the result notes
  it. Only the earned half attracts the 20% deduction, so the real figure may differ.
- **The gold set is synthetic**, written from structured facts. That makes its verdicts
  checkable and also makes its prose cleaner than how people actually write.
- **The wire format is unconfirmed.** The request shape came from OpenJev's README, which
  states Jev compatibility. `lib/engine/remote.ts` lists what to re-check against Jev's
  own documentation once a key exists.
- **Confidence is treated as a ranking, not a probability.** It is conditional on the
  options supplied and is not calibrated. It is never displayed as a percentage and never
  described as a chance of qualifying.
- **No investment income is parsed.** The EITC investment income cliff is asked about but
  the figure is not extracted from the description, so that criterion relies on the
  answer rather than on a parsed amount.

## What is deliberately not built

State-specific rules, Medicaid, the Child Tax Credit, WIC, filing, document upload,
saving anything a user types, and any language other than English.

---

## On screen at all times

> This is a screening estimate from federal rules, not an eligibility determination.
> Your state's rules may differ. Apply through the official link to find out.

> Nothing you type is stored.

Both are true of the implementation: there is no database, no analytics on the household
text, and the route that runs the loop keeps no session.
