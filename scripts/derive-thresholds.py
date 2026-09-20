"""Derive the SNAP FY2027 income standards from the 2026 poverty guidelines.

The SNAP income eligibility standards for a fiscal year are the prior calendar
year's HHS poverty guidelines, converted to a monthly figure:

    monthly limit = ceil(annual guideline * percentage / 12)

and the standard deduction is 8.31% of the net monthly limit, rounded up, floored
at a minimum published in the COLA memo (7 CFR 273.9(d)(1)(i)).

Before emitting anything this script checks both rules against every published
FY2026 figure. If any check fails it writes nothing.

Usage:  python3 scripts/derive-thresholds.py
"""

import json
import pathlib
from fractions import Fraction

ROOT = pathlib.Path(__file__).resolve().parent.parent
THRESHOLDS = ROOT / "data" / "thresholds"

SIZES = [str(n) for n in range(1, 9)]


def ceil_div(annual: int, pct: Fraction) -> int:
    """ceil(annual * pct / 12), computed exactly."""
    v = Fraction(annual) * pct / 12
    return -((-v.numerator) // v.denominator)


def standard_deduction(net_limit: int) -> int:
    """ceil(8.31% of the net monthly income limit), before the minimum floor."""
    v = Fraction(net_limit) * Fraction(831, 10000)
    return -((-v.numerator) // v.denominator)


# The 2025 guidelines, used only to verify the rule against published FY2026
# figures. Back-derived from those figures; not read from a primary source.
FPG_2025 = {"1": 15650, "2": 21150, "3": 26650, "4": 32150,
            "5": 37650, "6": 43150, "7": 48650, "8": 54150}
FPG_2025_INCREMENT = 5500

PCT = {"net": Fraction(1), "gross": Fraction(13, 10), "gross165": Fraction(165, 100)}


def verify_against_fy2026() -> None:
    fy26 = json.loads((THRESHOLDS / "snap-fy2026.json").read_text())
    checks = 0
    for key, table in (("net", "netLimitBySize"),
                       ("gross", "grossLimitBySize"),
                       ("gross165", "grossLimit165BySize")):
        published = fy26[table]
        for size in SIZES:
            got = ceil_div(FPG_2025[size], PCT[key])
            assert got == published[size], f"{table} size {size}: derived {got}, published {published[size]}"
            checks += 1
        got = ceil_div(FPG_2025_INCREMENT, PCT[key])
        assert got == published["increment"], f"{table} increment: derived {got}, published {published['increment']}"
        checks += 1

    # Standard deduction: sizes 4, 5 and 6 come out of the 8.31% rule directly.
    # Sizes 1-3 land below the published minimum and are floored by it.
    sd = fy26["standardDeductionBySize"]
    minimum = sd["1"]
    for size, published in (("4", sd["4"]), ("5", sd["5"]), ("6+", sd["6+"])):
        net = fy26["netLimitBySize"]["6" if size == "6+" else size]
        got = standard_deduction(net)
        assert got == published, f"standard deduction {size}: derived {got}, published {published}"
        checks += 1
    for size in ("1", "2", "3"):
        got = standard_deduction(fy26["netLimitBySize"][size])
        assert got <= minimum, f"standard deduction {size}: derived {got} exceeds the minimum {minimum}"
        assert sd[size] == minimum
        checks += 1

    print(f"derivation rules reproduce {checks} published FY2026 figures")


def derive_fy2027() -> dict:
    fpg = json.loads((THRESHOLDS / "fpg-2026.json").read_text())
    annual = fpg["annualBySize"]
    increment = fpg["annualIncrement"]

    def table(pct_key: str) -> dict:
        out = {s: ceil_div(annual[s], PCT[pct_key]) for s in SIZES}
        out["increment"] = ceil_div(increment, PCT[pct_key])
        return out

    net = table("net")

    return {
        "id": "snap-fy2027",
        "program": "snap",
        "label": "SNAP FY2027 (Oct 1, 2026 - Sep 30, 2027)",
        "effectiveFrom": "2026-10-01",
        "effectiveTo": "2027-09-30",
        "region": "48+DC",
        "status": "partial",
        "statusNote": (
            "Income standards are derived from the 2026 poverty guidelines using the rule "
            "verified against every published FY2026 figure. The allotment and deduction "
            "tables come from the FY2027 COLA memo, which was not published at the USDA "
            "COLA index as of the read date, so they are null here. A threshold set with "
            "status 'partial' cannot be used to compute a benefit."
        ),
        "sources": {
            "povertyGuidelines": fpg["source"],
            "derivationRule": "7 CFR 273.9(a) and 273.9(d)(1)(i)",
            "colaMemo": "https://www.fna.usda.gov/snap/allotment/cola/fy27"
        },
        "readOn": "2026-09-21",
        "derivedBy": "scripts/derive-thresholds.py",
        "netLimitBySize": net,
        "grossLimitBySize": table("gross"),
        "grossLimit165BySize": table("gross165"),
        "maxAllotmentBySize": None,
        "standardDeductionBySize": {
            "1": None, "2": None, "3": None,
            "4": standard_deduction(net["4"]),
            "5": standard_deduction(net["5"]),
            "6+": standard_deduction(net["6"]),
            "note": ("Sizes 1-3 fall below the minimum standard deduction, which is "
                     "CPI-adjusted and published only in the FY2027 COLA memo.")
        },
        "earnedIncomeDeductionRate": 0.20,
        "excessShelterCap": None,
        "homelessShelterDeduction": None,
        "excessMedicalThreshold": 35,
        "resourceLimit": None,
        "resourceLimitElderlyDisabled": None,
        "minimumAllotment": None,
        "benefitContributionRate": 0.30
    }


if __name__ == "__main__":
    verify_against_fy2026()
    out = derive_fy2027()
    path = THRESHOLDS / "snap-fy2027.json"
    path.write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote {path.relative_to(ROOT)}")
