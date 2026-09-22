"""
Every figure in the technical report, drawn from research/data.json.

Usage:  python3 research/charts.py
"""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT / "data.json").read_text())
OUT = ROOT / "figures"
OUT.mkdir(exist_ok=True)

INK = "#1a1a1a"
GREY = "#8a8a8a"
LIGHT = "#d9d9d9"
ACCENT = "#1f7a5c"  # the typed engine
OTHER = "#7a6a52"  # the generation baseline

plt.rcParams.update(
    {
        "font.family": "serif",
        "font.serif": ["STIXGeneral", "DejaVu Serif"],
        "mathtext.fontset": "stix",
        "font.size": 9,
        "axes.titlesize": 9,
        "axes.labelsize": 9,
        "xtick.labelsize": 8,
        "ytick.labelsize": 8,
        "legend.fontsize": 8,
        "axes.edgecolor": INK,
        "axes.linewidth": 0.6,
        "xtick.major.width": 0.6,
        "ytick.major.width": 0.6,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "svg.fonttype": "path",
        "figure.dpi": 150,
    }
)


def save(fig, name):
    fig.tight_layout()
    fig.savefig(OUT / f"{name}.svg", bbox_inches="tight")
    plt.close(fig)


def err(rate, ci):
    return [[rate - ci[0]], [ci[1] - rate]]


# ---- Figure 2: reading accuracy across held-out editions ----------------------
eds = DATA["reading"]["editions"]
fig, ax = plt.subplots(figsize=(6.2, 2.4))
xs, labels = [], []
for i, e in enumerate(eds):
    x = i + (0.25 if e["reader"] == "code+jev" else 0)
    color = ACCENT if e["reader"] == "code+jev" else GREY
    ax.bar(x, e["rate"] * 100, width=0.7, color=color, edgecolor="none")
    ax.errorbar(x, e["rate"] * 100, yerr=[[100 * (e["rate"] - e["ci"][0])], [100 * (e["ci"][1] - e["rate"])]], color=INK, capsize=2, lw=0.7)
    ax.text(x, e["ci"][1] * 100 + 0.8, f"{e['rate'] * 100:.1f}", ha="center", va="bottom", fontsize=7.5)
    xs.append(x)
    labels.append(f"Set {e['edition']}\n{'code + Jev' if e['reader'] == 'code+jev' else 'code'}")
ax.set_xticks(xs, labels)
ax.set_ylim(70, 102)
ax.set_ylabel("Facts read correctly (%)")
ax.axhline(100, color=LIGHT, lw=0.6)
save(fig, "fig2-reading-editions")

# ---- Figure 3: set 6 by field ---------------------------------------------------
fields = [
    ("incomeMonthly", "Monthly\nincome"),
    ("incomeAmount", "Income\namount"),
    ("incomePeriod", "Pay\nperiod"),
    ("childrenCount", "Children"),
    ("householdSize", "Household\nsize"),
    ("rentMonthly", "Housing\ncost"),
    ("state", "State"),
]
code = DATA["reading"]["sixByField"]["code"]
eng = DATA["reading"]["sixByField"]["withEngine"]
fig, ax = plt.subplots(figsize=(6.2, 2.3))
for i, (k, label) in enumerate(fields):
    c = code[k]["correct"] / code[k]["total"] * 100
    e = eng[k]["correct"] / eng[k]["total"] * 100
    ax.bar(i - 0.18, c, width=0.34, color=GREY, label="Code alone" if i == 0 else None)
    ax.bar(i + 0.18, e, width=0.34, color=ACCENT, label="Code + Jev" if i == 0 else None)
    ax.text(i - 0.18, c + 1, f"{code[k]['correct']}/{code[k]['total']}", ha="center", fontsize=6.5)
    ax.text(i + 0.18, e + 1, f"{eng[k]['correct']}/{eng[k]['total']}", ha="center", fontsize=6.5)
ax.set_xticks(range(len(fields)), [l for _, l in fields])
ax.set_ylim(0, 112)
ax.set_ylabel("Correct (%)")
ax.legend(frameon=False, loc="upper center", bbox_to_anchor=(0.5, 1.18), ncol=2)
save(fig, "fig3-reading-by-field")

# ---- Figure 4: per-program balanced accuracy, Jev vs Sonnet ------------------
jb = DATA["endToEnd"]["jevCompared"]["balancedAccuracyByProgram"]
sb = DATA["endToEnd"]["sonnet"]["balancedAccuracyByProgram"]
single = DATA["endToEnd"].get("single")
s1b = single["run"]["balancedAccuracyByProgram"] if single else None
eligible = DATA["endToEnd"]["jevCompared"]["eligibleCounts"]
SINGLE = "#b89a5e"  # the baseline without schema or batching
names = {
    "snap": "SNAP", "eitc": "EITC", "ctc": "CTC", "lifeline": "Lifeline", "wic": "WIC",
    "school_meals": "School meals", "csfp": "CSFP", "liheap": "LIHEAP", "head_start": "Head Start",
    "medicare_savings": "Medicare Savings", "extra_help": "Extra Help", "medicaid": "Medicaid",
    "chip": "CHIP", "state_eitc": "State EITC", "cdctc": "CDCTC", "va_pension": "VA Pension",
    "summer_ebt": "Summer EBT", "sfmnp": "SFMNP", "cacfp": "CACFP", "fdpir": "FDPIR", "wap": "Weatherization",
}
progs = list(jb.keys())
fig, ax = plt.subplots(figsize=(6.2, 3.5))
for i, p in enumerate(progs):
    y = len(progs) - 1 - i
    if jb[p] is None:
        ax.text(88.2, y, "not estimable: no eligible household", va="center", fontsize=7, color=GREY)
        continue
    vals = [v for v in [sb[p], jb[p], s1b[p] if s1b else None] if v is not None]
    ax.plot([min(vals) * 100, max(vals) * 100], [y, y], color=LIGHT, lw=1, zorder=1)
    ax.scatter(sb[p] * 100, y, marker="s", s=16, color=OTHER, zorder=2, label="Claude Sonnet 5, batched schema" if i == 0 else None)
    if s1b and s1b[p] is not None:
        ax.scatter(s1b[p] * 100, y, marker="^", s=18, color=SINGLE, zorder=2, label="Claude Sonnet 5, one request" if i == 0 else None)
    ax.scatter(jb[p] * 100, y, marker="o", s=16, color=ACCENT, zorder=3, label="Jev" if i == 0 else None)
ax.set_yticks(range(len(progs)), [f"{names.get(p, p)} ({eligible[p]})" for p in reversed(progs)])
ax.set_xlim(88, 100.8)
ax.set_xlabel("Balanced accuracy on held-out households (%); eligible households in brackets")
ax.legend(frameon=False, loc="lower left", fontsize=7)
save(fig, "fig4-per-program")

# ---- Figure 5: time and cost per household ------------------------------------
j = DATA["endToEnd"]["jevCompared"]
s = DATA["endToEnd"]["sonnet"]
runs = [("Jev", j, ACCENT), ("Sonnet 5, batched", s, OTHER)]
if single:
    runs.append(("Sonnet 5, one request", single["run"], SINGLE))
fig, axes = plt.subplots(1, 2, figsize=(6.2, 0.55 * len(runs) + 1.0))
for ax, key, label, fmt in [
    (axes[0], "medianSeconds", "Median seconds to a full result", "{:.1f} s"),
    (axes[1], "costPerHouseholdUSD", "Cost per household (USD, log scale)", "${:.4f}"),
]:
    ys = list(range(len(runs) - 1, -1, -1))
    vals = [r[1][key] for r in runs]
    ax.barh(ys, vals, color=[r[2] for r in runs], height=0.55)
    ax.set_yticks(ys, [r[0] for r in runs])
    ax.set_title(label, loc="left")
    for y, v in zip(ys, vals):
        ax.text(v * (1.15 if key == "costPerHouseholdUSD" else 1.02), y, fmt.format(v), va="center", fontsize=7.5)
    if key == "costPerHouseholdUSD":
        ax.set_xscale("log")
        ax.set_xlim(1e-4, 2)
    else:
        ax.set_xlim(0, max(vals) * 1.3)
save(fig, "fig5-time-cost")

# ---- Figure 6: tau sweep ----------------------------------------------------------
sw = DATA["sweep"]
fig, ax = plt.subplots(figsize=(3.0, 2.2))
taus = [r["tau"] for r in sw]
ax.plot(taus, [r["meanBalancedAccuracy"] * 100 for r in sw], marker="o", ms=3, color=ACCENT, lw=1)
ax.set_xlabel(r"Confidence threshold $\tau$")
ax.set_ylabel("Mean balanced accuracy (%)", color=ACCENT)
ax2 = ax.twinx()
ax2.step(taus, [r["medianQuestions"] for r in sw], where="mid", color=GREY, lw=1)
ax2.set_ylabel("Median questions", color=GREY)
ax2.set_ylim(0, 4)
ax2.spines["right"].set_visible(True)
ax.axvline(DATA["setup"]["tauChosen"], color=LIGHT, lw=0.8, ls="--")
save(fig, "fig6-tau-sweep")

# ---- Figure 7: expected-value floor on the development set ----------------------
fl = DATA["development"]["floors"]
fig, ax = plt.subplots(figsize=(3.0, 2.2))
fx = [f["floorUSD"] for f in fl]
ax.plot(range(len(fx)), [f["questions"] for f in fl], marker="o", ms=3, color=INK, lw=1)
ax.set_xticks(range(len(fx)), [f"${x}" for x in fx])
ax.set_xlabel("Minimum expected change to ask (per year)")
ax.set_ylabel("Questions asked, 101 households")
ax.set_ylim(0, max(f["questions"] for f in fl) * 1.2)
ax2 = ax.twinx()
ax2.plot(range(len(fx)), [f["useful"]["rate"] * 100 for f in fl], marker="s", ms=3, color=ACCENT, lw=1)
ax2.set_ylabel("Questions that moved the result (%)", color=ACCENT)
ax2.set_ylim(0, 50)
ax2.spines["right"].set_visible(True)
save(fig, "fig7-floor-sweep")

# ---- Figure 8: questions per household, before and after -----------------------
before = DATA["endToEnd"]["jevCompared"]["questionsHistogram"]
after = DATA["endToEnd"]["jevFinal"]["questionsHistogram"]
fig, ax = plt.subplots(figsize=(3.0, 2.2))
for i in range(4):
    ax.bar(i - 0.18, before[i], width=0.34, color=GREY, label="Spread ranking" if i == 0 else None)
    ax.bar(i + 0.18, after[i], width=0.34, color=ACCENT, label="Expected value" if i == 0 else None)
ax.set_xticks(range(4), ["0", "1", "2", "3"])
ax.set_xlabel("Follow-up questions asked")
ax.set_ylabel("Held-out households")
ax.legend(frameon=False)
save(fig, "fig8-questions-histogram")

print("wrote", sorted(p.name for p in OUT.glob("*.svg")))
