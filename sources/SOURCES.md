# Sources

Every dollar figure in `data/thresholds/` traces to a row in this file. Figures are
recorded with the URL they were read from and the date they were read. Raw copies of
each document are kept in `sources/raw/` so the figures stay checkable offline.

Read date for all rows: **2026-09-21**.

## SNAP

| Figure | Value (48 states + DC) | Source |
|---|---|---|
| FY2026 maximum allotments, sizes 1–8 | 298, 546, 785, 994, 1183, 1421, 1571, 1789; +218 each additional | [FY2026 Maximum Allotments and Deductions](https://www.fna.usda.gov/sites/default/files/resource-files/snap-fy26maximumAllotments-deductions.pdf) |
| FY2026 standard deduction, sizes 1–6+ | 209, 209, 209, 223, 261, 299 | same |
| FY2026 excess shelter cap | 744 | same |
| FY2026 homeless shelter deduction | 198.99 | same |
| FY2026 minimum allotment (sizes 1–2) | 24 | [FY2026 Minimum Allotments](https://www.fna.usda.gov/sites/default/files/resource-files/snap-fy26MinimumAllotments.pdf) |
| FY2026 net monthly income limit (100% FPL), sizes 1–8 | 1305, 1763, 2221, 2680, 3138, 3596, 4055, 4513; +459 | [FY2026 Income Eligibility Standards](https://www.fna.usda.gov/sites/default/files/resource-files/snap-fy26-incomeEligibilityStandards.pdf) |
| FY2026 gross monthly income limit (130% FPL), sizes 1–8 | 1696, 2292, 2888, 3483, 4079, 4675, 5271, 5867; +596 | same |
| FY2026 gross limit at 165% FPL, sizes 1–8 | 2152, 2909, 3665, 4421, 5177, 5934, 6690, 7446; +757 | same |
| Resource limit / elderly-or-disabled resource limit | 3000 / 4500 | [SNAP eligibility](https://www.fna.usda.gov/snap/recipient/eligibility) |
| Effective period, FY2026 | Oct 1 2025 – Sep 30 2026 | stated on each PDF above |

### SNAP rules read from the regulations

Retrieved through the eCFR API at `https://www.ecfr.gov/api/versioner/v1/full/2026-09-16/title-7.xml?part=273`.

| Rule | Citation |
|---|---|
| Deduction order: 20% earned income, standard, excess medical over $35, dependent care, child support, homeless shelter, then excess shelter last | 7 CFR 273.10(e)(1)(i)(A)–(I) |
| Excess shelter = shelter costs − 50% of income remaining after all other deductions | 7 CFR 273.9(d)(6)(ii) |
| Shelter cap does not apply to a household with an elderly or disabled member | 7 CFR 273.9(d)(6)(ii) |
| Standard deduction = 8.31% of the net income limit, rounded up, floored at a published minimum; sizes above 6 use the 6-person figure | 7 CFR 273.9(d)(1)(i) |
| Excess medical deduction applies to elderly or disabled members, above $35/month | 7 CFR 273.9(d)(3) |
| Benefit = maximum allotment − 30% of net income; the 30% rounds up | 7 CFR 273.10(e)(2)(ii)(A)(1) |
| Minimum benefit = 8% of the one-person maximum allotment, sizes 1–2 only | 7 CFR 273.10(e)(2)(ii)(C) |
| Households with an elderly or disabled member are tested on net income only | 7 CFR 273.10(e)(2)(i)(A)–(B) |
| Categorically eligible households are exempt from the resource limits | 7 CFR 273.8(a) |
| Rounding: down at 1–49 cents, up at 50–99 cents | 7 CFR 273.10(e)(1)(ii)(A) |
| Resource limits are COLA-adjusted and rounded down to the nearest $250 | 7 CFR 273.8(b)(1) |

The $24 minimum allotment is independently confirmed by the regulation: 8% of the
one-person maximum allotment is 8% × $298 = $23.84, which rounds to $24. Third-party
sites quoting $23 disagree with both the memo and the regulation.

### Worked example used as a test vector

From the [SNAP eligibility page](https://www.fna.usda.gov/snap/recipient/eligibility):
a 4-person household with no elderly or disabled member, $1,500 earned income,
$550 social security, $362 dependent care and $700 shelter costs. USDA's own
arithmetic: gross $2,050; after the 20% earned deduction $1,750; after the $223
standard deduction $1,527; after dependent care $1,165; half of that is $582.50;
excess shelter is $700 − $582.50 = $117.50; net monthly income **$1,047.50**.
This is reproduced in `lib/compute.test.ts`.

Note that USDA carries net income to the cent here rather than rounding it. The
implementation follows the same convention: compute in cents, round only where a
regulation names a rounding step.

## Federal poverty guidelines

| Figure | Value | Source |
|---|---|---|
| 2026 guidelines, 48 states + DC, sizes 1–8 | 15960, 21640, 27320, 33000, 38680, 44360, 50040, 55720; +5680 | [HHS ASPE](https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines) |
| 2025 guidelines, 48 states + DC, size 1 / increment | 15650 / 5500 | back-derived from the FY2026 SNAP standards; see below |

The SNAP income standards for a fiscal year are the prior calendar year's poverty
guidelines: monthly limit = `ceil(annual guideline × percentage ÷ 12)`. That rule
reproduces all four published FY2026 figures checked against it — net size 1
(15650 ÷ 12 = 1304.17 → 1305), net size 2 (1762.50 → 1763), gross size 3
(2887.08 → 2888) and the 165% size 1 (2151.88 → 2152). It is what
`scripts/derive-thresholds.py` uses to produce the FY2027 income standards.

## EITC

| Figure | Source |
|---|---|
| TY2025 earned income amounts, maximum credits, threshold and completed phaseout amounts for both filing statuses, investment income limit $11,950 | [Rev. Proc. 2024-40 §3.06](https://www.irs.gov/pub/irs-drop/rp-24-40.pdf) |
| TY2026 equivalents, investment income limit $12,200 | [Rev. Proc. 2025-32 §3.06](https://www.irs.gov/pub/irs-drop/rp-25-32.pdf) |
| Childless claimants must be at least 25 and under 65 at year end; for a joint return only one spouse need meet it | [IRS, Who qualifies for the EITC](https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit/who-qualifies-for-the-earned-income-tax-credit-eitc) |
| A married claimant not filing jointly may still claim the credit if legally separated, or if they lived apart from their spouse for the last six months of the year and had a qualifying child living with them for more than half the year | same, and IRC §32(d) as referenced in both revenue procedures |

The published maximum credit equals the statutory phase-in rate times the earned
income amount, and the completed phaseout equals the threshold plus the maximum
credit divided by the phase-out rate, to the dollar, in both tax years. The
implementation uses the published figures and derives the phase-out rate from them
so the two can never drift apart.

## Lifeline

| Figure | Source |
|---|---|
| Income test is 135% of the federal poverty guidelines | [USAC consumer eligibility](https://www.usac.org/lifeline/consumer-eligibility/) |
| 2026 income table, sizes 1–8: 21546, 29214, 36882, 44550, 52218, 59886, 67554, 75222; +7668 | same |
| Qualifying programs: SNAP, Medicaid, SSI, Federal Public Housing Assistance, Veterans and Survivors Pension Benefit | same |
| Additional Tribal programs: Bureau of Indian Affairs General Assistance, Tribally-administered TANF, Tribal Head Start, FDPIR | same |
| Benefit up to $9.25/month, up to $34.25/month on Tribal lands | [USAC Lifeline](https://www.usac.org/lifeline/) |

The USAC table divided by 1.35 returns the HHS 2026 guidelines exactly
(21546 ÷ 1.35 = 15960; 7668 ÷ 1.35 = 5680), so the two sources agree.

## Decision engine: Jev (TypeSafe)

Read 2026-09-21 from docs.typesafe.ai. Cached copies in `raw/typesafe/`.

| Fact used in the code | Source |
|---|---|
| Endpoint `POST https://api.typesafe.ai/v1/systemone`, bearer key | [API reference](https://docs.typesafe.ai/api) |
| Request `{ model, state, questions: { id: { type, instructions, criteria } } }` | same |
| Noul answer `{ type, noul }`, no confidence; choice and score carry `probabilities` and `confidence` | same |
| Response carries the versioned `model` and `usage.input_tokens` / `output_tokens` | same |
| At most 255 options per Choice; up to 10 Score levels | same |
| 429 and 529 are retryable; honour `retry-after` | same, and [Models](https://docs.typesafe.ai/models) |
| `jev-1.13.0`: $0.042 per million input tokens, output free; 64k-token context; 1,200 requests a minute | [Models](https://docs.typesafe.ai/models) |
| Pin a versioned id when thresholds are tuned against it | same |
| TypeSafe confidence is (K · max p − 1) / (K − 1); callers may use their own measure | [Confidence](https://docs.typesafe.ai/confidence) |
| Keep arithmetic, counting and dates in code; not trained to generate text | [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13) |

## Not obtained

| Item | Status |
|---|---|
| SNAP FY2027 allotments, deductions, minimum allotment, resource limits | The FY2027 COLA page exists at `https://www.fna.usda.gov/snap/allotment/cola/fy27` and was last updated August 28 2026, but carries no attached tables, and no FY2027 document is linked from the COLA index. Every candidate document URL returned 404. Search engines surface specific FY2027 figures attributed to a USDA guidance-portal PDF; that URL returns 403 and the figures could not be confirmed against a page that opened. They are deliberately absent from the code. |
| SNAP FY2027 minimum standard deduction | Depends on a CPI adjustment published in the same unavailable memo. Sizes 4, 5 and 6+ are derivable from the 8.31% rule and are present; sizes 1–3 are floored by this minimum and are therefore absent. |
