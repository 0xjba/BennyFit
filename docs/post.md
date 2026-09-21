# Using a decision model's uncertainty to choose the next question

*Draft. Figures marked `[TK]` depend on a run against a real engine and are not yet
measured. Everything else is measured or cited.*

---

About one in five people eligible for SNAP does not receive it. Roughly five million
people eligible for the Earned Income Tax Credit do not claim it, leaving around seven
billion dollars unclaimed each year. The reasons are well documented and dull: the rules
are complicated, the forms are long, and about half of eligible non-participants do not
know they qualify.

A randomised trial of about 30,000 likely-eligible elderly Pennsylvanians put numbers on
what helps. Sending information raised enrollment from 6% to 11%. Sending information
*and* offering help with the application raised it to 18%. The expensive part was not the
information. It was someone sitting with the applicant and working out which facts
actually mattered for them.

That is the part this project is about.

## The thing that is usually thrown away

A decision model — the class of model that reads a state and answers typed questions
about it without generating text — returns, for each question, a probability distribution
over the options that question offers. Ask "is this household's income from work or from
benefits?" with four options and you get four numbers that sum to one.

Every system I have seen built on this treats those numbers as output: pick the argmax,
maybe show a confidence, maybe threshold on it.

But a flat distribution is not a bad answer. It is a different kind of message. It is the
model saying *the text you gave me does not decide this*. That is information about the
input, not about the model's competence, and it is exactly the information you need to
decide what to ask a person next.

## Uncertainty is not the same as importance

The obvious move — ask about whatever the model is least sure of — is wrong, and wrong in
a way that wastes the one or two questions you can reasonably ask someone.

Take a household: a 62-year-old living alone, about $1,150 a month, $700 rent, pays their
own utilities. Run 32 criteria across three programs against that paragraph and 27 of
them come back unsettled. Most of that uncertainty is worthless. Whether anyone in the
household is a full-time college student is genuinely unclear from the text, and it
changes nothing: the household passes or fails on income either way.

So the rule is not "ask about the most uncertain thing". It is:

```
value(c) = max over options o of  total_dollars(evaluate(state, c pinned to o))
         − min over options o of  total_dollars(evaluate(state, c pinned to o))
```

Force each option in turn, re-evaluate every program, and see how far the total moves. A
criterion where every option gives the same total cannot matter, and is never asked, no
matter how uncertain the model is about it. That single definition replaces any prose
rule about which questions are important.

For that household the answer is the income source. If the $1,150 is wages, a 20% earned
income deduction applies and the SNAP benefit is one figure; if it is Social Security, it
does not and the benefit is another. The spread is $1,248 a year. That is the question it
asks, and the reason shown under it is the spread itself.

## What this does *not* mean

Three things I had to build around rather than assume.

**The confidence is not a probability that you qualify.** It is normalised entropy over
the options supplied, conditional on those options. A value of 0.9 does not mean 90%
right. So it is drawn as a bar and never as a number, and a bar below the threshold is
drawn as an outline rather than a shorter fill — an unsettled criterion is a different
kind of thing, not less of the same thing.

**Silence is not a no.** The first version disqualified nearly every household from the
EITC, and the cause was a criterion asking whether the claimant has a Social Security
number valid for employment. Nobody writes that when describing their household, so it
came back unsettled, and unsettled resolved to the argmax, which was "no". Criteria like
that now declare a *presumption*: what a screening should assume absent evidence. The
interface marks a presumed answer as presumed.

That fix created the next problem. A presumed criterion still scores enormous value of
information, because pinning it to its disqualifying option wipes out the whole program.
The loop spent all three of its questions asking whether people had Social Security
numbers and what they had in savings. But that spread is hypothetical: the presumption is
a declaration that silence has a known meaning. Presumed criteria now rank below every
criterion that carries none. Question relevance went from 16.7% to 63.3%.

**The model must not do arithmetic.** Every comparison between a number and a limit
happens in code, from tables read off federal sources, before the model is shown
anything. The model is given the computed monthly figure and asked only whether the
narrative supports a factual predicate. This is not a stylistic preference: a screener
that gets the SNAP shelter deduction wrong produces a confident wrong dollar amount, and
someone acts on it.

## Measuring it

Two numbers, side by side, or the first one is just a claim.

The first is what a household gained. The second is how often the system is right. A
gold set of 150 synthetic households, ground truth computed from the rules applied to
known facts rather than from the system being measured, split into five slices: clearly
eligible for all three, clearly ineligible for all three, eligible for some, deliberately
missing one load-bearing fact, and adversarially phrased.

Accuracy is *balanced* accuracy — the mean of the true-positive and true-negative rates.
The set is four-fifths eligible for SNAP, so a system that answered "eligible" to
everything would score 80% on plain accuracy and 50% on this.

The underspecified slice is excluded from accuracy and scores a different thing: how
often the first question asked was the fact that was withheld.

Current figures: `[TK — balanced accuracy per program]`, `[TK — question relevance]`,
`[TK — median wall clock]`, against `[TK — engine]`.

τ, the threshold below which an answer counts as unsettled, was swept from 0.2 to 0.8
rather than chosen. Balanced accuracy is flat from 0.2 through 0.6. Relevance collapses
above 0.6, where the loop starts doubting the income period it had already read correctly
and spends its first question re-asking it.

## The comparison that matters

Generation is the obvious alternative: ask a model to read the household and emit JSON
verdicts. It produces documents that parse, validate against a schema, and are wrong in a
way the schema cannot see — an answer that is a perfectly valid option id belonging to a
*different* criterion.

The demo runs the same household through more than one lane. A typed readout. Where
the engine can also generate, the same model asked to write JSON, which isolates the
mechanism because only the readout method changes. And a general-purpose model writing
JSON, the way most teams would build this today. Faults are counted mechanically: cross-wired, invented, missing.

There is a fourth thing the comparison shows, and I think it is the real one. A generating
model will happily write `"confidence": 0.9` into its JSON. That number is a token. It is
not a distribution over anything, it is not conditioned on the options, and there is no
reason to expect it to correlate with being right. A readout's confidence is a property
of the forward pass. You can only build an elicitation loop on the second kind.

`[TK — the measured comparison across the three lanes]`

## What I would not claim

The 11%-to-18% figure is from a trial of human phone assistance. It is the mechanism this
design rests on, not a result this software has achieved.

The gold set is synthetic. Its households were written from structured facts, which makes
verdicts checkable and also makes the prose cleaner than how people actually write.

The screening uses federal floor rules. 42 states and DC raise the SNAP income limit
through broad-based categorical eligibility and many drop the asset test, so this
under-screens in most of the country, and says so on screen.

And the SNAP FY2027 tables are not in the code. The COLA memo page exists, updated in
August 2026, and carries no tables; every candidate URL 404s. Search results confidently
quote FY2027 figures from a PDF that will not open. What is in the code is the FY2027
*income standards*, derived from the 2026 poverty guidelines by a rule that reproduces all
33 published FY2026 figures and refuses to emit anything if it does not. The allotment
tables are null, the set is marked partial, and the code will not compute a benefit from a
partial set.

Source: <https://github.com/0xjba/bennyfit> `[TK — confirm the repository URL]`
