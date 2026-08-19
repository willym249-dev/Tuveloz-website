# Zeo asserts from blindness, and the fix goes in the system prompt

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-19
- **Applies to:** the `zeo-home` Windows machine, `zeo_local_brain.py`.
  Nothing in the Tuveloz application depends on this.

Why Zeo told the owner that an idea "effectively doesn't exist yet" when it is
patented and benchmarked, why that is the same defect as three earlier ones
already in the working log, and the rule block that belongs in
`DEFAULT_SYSTEM_PROMPT`.
Companion to [`zeo-remote-access-tailscale.md`](zeo-remote-access-tailscale.md),
which holds the diagnosis rules; this holds the verification rules.

## What happened

Asked what he could build that nobody had built yet, Zeo answered on
2026-08-19 with a "Digital Twin of your immediate physical environment that
predicts micro-events," and made four load-bearing claims:

1. "Here is a concept that effectively doesn't exist yet."
2. It would predict what happens next in your house "with 90% accuracy."
3. It "requires massive local compute... your RTX 5080 is one of the few
   consumer machines that could theoretically run this inference locally."
4. The money is in licensing "the prediction engine to smart home
   manufacturers who currently have no idea how to make their devices
   proactive."

Then: "Do you want to build a prototype of this prediction engine?"

Four searches, about four minutes, settle all four.

| Zeo's claim | What searching returns |
| --- | --- |
| Doesn't exist yet | It is a named research field with a standard testbed. Washington State University's **CASAS** — "a smart home in a box" — has run this since the 2000s and publishes ~30 labelled home datasets. Next-activity prediction on CASAS Aruba is a routine benchmark task. |
| 90% accuracy | A number with no task attached. Published results on this family of tasks span **38.3% to 98.7%** depending entirely on how the task is defined, and one decision-tree paper already reports ~90% for activity and location. The field's own caveat: imbalanced classes give high overall accuracy with poor accuracy on the rare activities. |
| Needs an RTX 5080 | Contradicted by the same literature — decision trees, SVMs and LightGBM are the workhorses, and there is published work on pushing this to *edge* devices. One paper notes it avoided deep architectures for lack of compute and still performed. |
| Manufacturers have no idea | **US 11,551,103 B2, "Data-driven activity prediction"** — inventors Diane J. Cook, Bryan Minor and Janardhan Rao Doppa, assigned to Washington State University. Its abstract is Zeo's paragraph: sensors observe, activities are recognised, future occurrences are predicted, and prompts or facility automation follow. Neighbouring grants include US 11,146,933 B2 ("Activity driven smart home system") and Google's 2016 filing US 2016/0259308 A1 on a smart home that infers and auto-implements household policies from sensed observations. |

The fourth row is the expensive one. The proposed business — license a
prediction engine to smart-home manufacturers — walks straight at a granted
patent whose *abstract* describes the same mechanism. The claims were not read,
so nothing here says what they cover; that is a patent attorney's question and
it is not settled in this document. But it is exactly the question an answer
about licensing should have raised, and Zeo raised the opposite of it.

Zeo also proposed ingesting "local camera feeds" inside a home without once
mentioning that the household includes people who are not the owner. Maryland
requires the consent of all parties to intercept an oral communication
(Md. Code, Cts. & Jud. Proc. § 10-402); continuous audio capture of family and
guests sits squarely in that territory, and video-without-audio is a different
and more permissive analysis. That is counsel's question, not this document's.
The defect is that a home-surveillance proposal to a Maryland owner contained
no version of it.

## This is the fourth instance, not the first

The shape is identical every time: **something is not visible from where Zeo
is standing, and he reports it as not existing** — in a confident register,
with no marker that the check never happened.

| When | What Zeo said | What was true |
| --- | --- | --- |
| 2026-08-10 | "I don't have a specific memory file." | Three memory stores and a full transcript sat beside him on disk. |
| 2026-08-17 | The search "returned nothing usable"; then, from memory, no NBA games were scheduled "today, June 27, 2024." | The search backend had been answering with an empty channel for roughly a year, and no request had ever carried the date. |
| 2026-08-17 | (a Claude session, not Zeo) Bing's RSS feed was retired and answers every query empty — shipped as four code changes. | False. The feed returned ten results per query when finally measured from a machine that could reach it. Retracted the same evening. |
| 2026-08-19 | "A concept that effectively doesn't exist yet." | Patented, benchmarked, and sitting on a public dataset. |

Three of those four are Zeo. The third is in the table because it is the same
error committed by a better-equipped assistant, which is the point: this is not
a small-model problem. It is what any model does when it is not required to
distinguish *I looked and found nothing* from *I did not look*.

The 2026-08-17 entry already names the general rule — "a second-hand report is
evidence about reports, not about the thing." Not searching at all is the
degenerate case of that: a report from nobody.

## The instruction that would make this worse

"Think outside the box" is the natural thing to ask for after reading that
answer, and it is the wrong correction. Zeo's answer was not too conventional
in style — it was the single most predictable output an LLM produces when asked
for an unbuilt idea. Digital twin, plus prediction, plus local GPU, plus
license it to manufacturers, plus a closing question. That is the inside of the
box painted to look like the outside, and the paint is what made it convincing.

Originality is a claim about the world. It cannot be produced by trying harder
to sound original; it is only ever established by knowing where the edge
currently is. Asking a model with no working search to be more creative gets a
more confident wrong answer, faster. **The search is not a chore that precedes
the creative part. It is the creative part**, because the gap only becomes
visible once the occupied ground is on the page.

## What the good answer looked like

The searches that falsified Zeo's claims also hand over the real ones. Twenty
years of published work says prediction accuracy is not where this field is
stuck. Three places it is:

- **The base rate eats the metric.** High overall accuracy comes from the
  frequent, boring activities; the literature's own complaint is poor accuracy
  on underrepresented classes. The rare event is the only one worth acting on,
  and it is the one every headline accuracy number hides.
- **Cold start.** Every home is a different sensor layout and a different
  person. A model trained on Aruba does not transfer to this house, and on day
  one there is no data for this house.
- **Nobody prices being wrong.** Papers report accuracy. Acting has an
  asymmetric cost: ordering beans that were not needed costs money and trust,
  while failing to pre-heat costs forty seconds. A predictor optimised for
  accuracy is not optimised for that, and the two come apart precisely at the
  rare events above.

The third is the actual unbuilt thing. **Not the predictor — the policy layer
that decides whether a prediction is confident enough, and cheap enough to be
wrong about, to act on unasked.** That is a claim with a shape: it can be
tested, it can be wrong, and it is not what the WSU patent describes.

Note what that answer does not contain: an invented percentage, a compliment
about the owner's hardware, or a request for permission to start.

## The experiment, run

Leaving the above as a suggestion would have been the same defect one more
time, so it was run. [`zeo-activity-prediction-baseline.py`](zeo-activity-prediction-baseline.py)
is stdlib-only Python, no dependencies and no GPU: it generates a synthetic
household, predicts with lookup tables, and scores three ways. It takes about a
second.

**A lookup table scores 90.5%.** Not a model — counting, then dividing. That
figure held at 90.5–90.6% across seeds 1, 2, 7, 13 and 42 at 500 simulated
days. The number Zeo invented as the impressive outcome is approximately what
the task hands you for free, which makes it the floor a real system has to
clear rather than the target it aims at. On the identical task, simply
switching from "always guess the commonest activity" (34.8%) to the lookup
table moves the headline 55 points with no learning anywhere in it.

**That 90.5% is a popularity contest.** Averaged over classes rather than
samples it falls to about 61%, and the breakdown says why: `Sleep`, `Away` and
`Relax` are ~77% of the day and are recalled 93–98%, while `LeaveHome` (0.4% of
the day) is recalled **0.0%** and `NightWaking` about 11%. The headline survives
the rare events precisely because they are rare — and the rare events are the
only ones worth waking a house for.

**The part nobody measures.** Zeo's example was: "it pre-heats the water or
orders the beans before you ask." Scored as a decision, with a benefit for
acting correctly, a cost for acting wrongly and a smaller cost for missing, the
two halves of that sentence get opposite answers:

| Action | Cost of being wrong | Best policy | Gain over doing nothing |
| --- | --- | --- | --- |
| Pre-heat the kettle | small (0.5× the benefit) | act on the prediction | **+125 to +212**, every seed |
| Order the beans | large (12× the benefit) | **never act at all** | **0.0**, every seed |

Ordering the beans is net-negative at *every* confidence threshold tested. The
optimum is to never do it. Both halves of that sentence run on the same
predictor at the same accuracy — what separates them is the price of being
wrong, which is the one quantity an accuracy figure cannot carry. That is the
gap named above, now with a number against it.

**What this does not show.** The household is synthetic, from a hand-written
generator, so the digits describe that generator and not anyone's home. Treat
the *shape* as the result: base rates dominate the headline, rare classes
collapse underneath it, and action cost decides feasibility independently of
accuracy. The real run is CASAS Aruba, which is public and labelled, and it has
not been done — no loader is included because there is no copy of that data
here to test one against, and shipping an untested parser is the exact mistake
this document is about. The first draft of the generator was also too regular:
every confidence threshold returned an identical, flawless result, which is a
benchmark flattering its predictor. Day-level variation — working from home,
skipping breakfast, eating out — was added before any of the above was read.

## The rule block

Same shape and same home as the diagnosis rules — `DEFAULT_SYSTEM_PROMPT` in
`zeo_local_brain.py`, not a memory file. Memory files accumulate what happened;
the system prompt shapes how he answers with nothing to recall.

Keep it short deliberately. The 2026-08-10 entry measured the prompt at 4805
tokens against a runner that kept 2050 and dropped the rest without an error.
`num_ctx` is now always sent, but a prompt that grows every time someone is
disappointed is how that defect comes back. Add these seven lines; do not
expand them into an essay.

```
Verification rules:
1. Absence is a claim. "Nothing like this exists", "no one has built it",
   "the search returned nothing", "I have no memory file" are assertions
   about the world and need evidence like any other. Finding nothing is a
   fact about your search, not about the thing.
2. Say which one it is. "I searched X and found nothing" and "I did not
   search" are different sentences. Never let the second sound like the
   first.
3. Before calling anything new, unbuilt, unsolved or unclaimed, search for
   prior art and name what came back. If searching is unavailable, say the
   claim is unchecked instead of making it.
4. A number needs a source or a derivation. Never state an accuracy, a
   percentage, a price, a market size or a benchmark you did not read or
   compute. An invented "about 90%" is worse than "I don't know".
5. Do not flatter the hardware, the idea, or the owner. "You are one of the
   few who could" is not analysis, and it costs him money when it is wrong.
6. Give the falsifiable version: what would prove this wrong, what it costs,
   and what already occupies the ground. Prefer the cheap experiment that
   could kill the idea today over the impressive one that defers it.
7. "Do you want me to build it?" is not an answer. Do the smallest part you
   can actually do, then ask.
```

## Before any of this can work

Rule 3 assumes searching works. On `zeo-home` it may not, and that is still
undiagnosed — see the 2026-08-17 entry in [`../LOG.md`](../LOG.md). The code
fix landed (`804b95e`: `rss` is now an ordered list of feed hosts, first one
answering wins) and needs only a `git pull` and a restart, or the word
`selfupdate` typed to Zeo. But the original fault was specific to that machine
and was never found, and Bing's feed answers normally from everywhere else.

So the order is:

1. On `zeo-home`, `git pull` and restart, or type `selfupdate`.
2. Type `search status`. It names which host actually answered and with what.
   That output is the missing evidence for the 2026-08-17 entry — capture it
   there whichever way it comes back.
3. Only once a search visibly returns results, install the rule block.

Installing the rules while search is dead produces an assistant that correctly
refuses to assert anything, which is honest and useless. Fix the eyes first.

## How solid is the table above

By its own rules, this document owes its evidence grade. Every row came from
web search results read as summaries and titles — Google Patents for the patent
numbers, inventors and assignee; abstracts and result snippets for the CASAS
testbed and the accuracy spread. **The patent claim text was not read in full,
and no paper was read past its abstract.** That is enough to prove the negative
this document needed — "effectively doesn't exist yet" is false, decisively —
and it is not enough to support any statement about what the patent's claims
cover or what would infringe them. Anyone taking the licensing idea further
starts by reading US 11,551,103 B2 in full with counsel, not by citing this
table.

Sources: [CASAS: a smart home in a box](https://www.researchgate.net/publication/259701222_CASAS_A_smart_home_in_a_box) ·
[Forecasting Occurrences of Activities (WSU)](https://eecs.wsu.edu/~cook/pubs/pmc16.pdf) ·
[US 11,551,103 B2 — Data-driven activity prediction](https://patents.google.com/patent/US11551103B2/en) ·
[US 11,146,933 B2 — Activity driven smart home system](https://patents.google.com/patent/US11146933) ·
[US 2016/0259308 A1 — smart-home automation from sensed observations](https://patents.google.com/patent/US20160259308A1/en) ·
[Personalized Smart Home Automation Using Machine Learning](https://www.mdpi.com/1424-8220/25/19/6082) ·
[Timing Matters: Temporal Prediction in Smart Homes](https://arxiv.org/html/2411.18719) ·
[A Discussion on Generalization in Next-Activity Prediction](https://arxiv.org/pdf/2309.09618) ·
[Enabling Edge Cloud Intelligence for Activity Learning in Smart Home](https://arxiv.org/pdf/2005.06885)
