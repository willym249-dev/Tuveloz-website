#!/usr/bin/env python3
"""
Does "90% accuracy" mean anything for household activity prediction?

This is the cheap experiment that kills — or fails to kill — the "digital twin
that predicts micro-events" idea, before any inference code is written.

It builds a synthetic household, then runs the dumbest predictors that could
possibly work: lookup tables. No model, no GPU, no training loop. If a lookup
table lands near the numbers quoted in the literature, then the bottleneck was
never compute, and the interesting problem is somewhere else entirely.

Three things it measures:

  1. The same data and the same predictor under two equally reasonable
     definitions of "next activity prediction". If the headline accuracy moves
     a lot between them, then a bare "90% accuracy" names nothing.

  2. Overall accuracy against per-class recall. Overall accuracy is a
     popularity contest won by whatever the household does most.

  3. What it costs to *act* on a prediction. Papers report accuracy. A system
     that starts the kettle has to decide, and a wrong decision is not equally
     wrong in both directions.

The household is synthetic and its numbers describe this generator, not
anyone's house. That is deliberate: the point here is the *shape* of the
result, which holds for any base-rate-dominated routine. The real run uses
CASAS Aruba (public, already labelled). No loader is included, because there is
no copy of that data here to test one against, and shipping an untested parser
is the mistake this whole exercise is about.

Stdlib only. Deterministic under --seed. Python 3.8+.

    python activity_prediction_baseline.py
    python activity_prediction_baseline.py --days 600 --seed 7
"""

from __future__ import annotations

import argparse
import random
from collections import Counter, defaultdict

SLOT_MINUTES = 15
SLOTS_PER_DAY = 24 * 60 // SLOT_MINUTES  # 96

# (activity, nominal start minute, nominal duration, start jitter, duration jitter)
WEEKDAY = [
    ("Sleep",      0,   390, 0,  25),
    ("Bathe",      390,  25, 20, 10),
    ("Breakfast",  415,  30, 20, 12),
    ("LeaveHome",  445,   8, 20,  4),
    ("Away",       453, 507, 20, 45),
    ("ReturnHome", 960,   8, 45,  4),
    ("Relax",      968,  57, 45, 25),
    ("Cook",      1025,  45, 30, 15),
    ("Eat",       1070,  35, 30, 12),
    ("Chores",    1105,  40, 30, 20),
    ("Relax",     1145, 160, 30, 40),
    ("Sleep",     1305, 135, 30,  0),
]

WEEKEND = [
    ("Sleep",      0,   510, 0,  45),
    ("Bathe",      510,  30, 35, 12),
    ("Breakfast",  540,  45, 35, 20),
    ("Relax",      585, 135, 40, 60),
    ("Chores",     720, 120, 60, 50),
    ("Cook",       840,  50, 60, 20),
    ("Eat",        890,  45, 60, 15),
    ("Relax",      935, 180, 60, 70),
    ("Away",      1115, 130, 90, 70),
    ("ReturnHome",1245,   8, 90,  4),
    ("Relax",     1253,  97, 60, 40),
    ("Sleep",     1350,  90, 30,  0),
]

# Rare, and exactly the ones worth acting on. Probability per day.
RARE_EVENTS = [
    ("NightWaking", 0.10, (90, 330),   20),
    ("GuestVisit",  0.07, (1020, 1290), 75),
    ("Sick",        0.03, (420, 1200), 240),
]


def _jitter(rng: random.Random, value: int, spread: int) -> int:
    if spread <= 0:
        return value
    return value + int(rng.gauss(0, spread / 2.0))


def vary_routine(rng: random.Random, routine: list, weekend: bool) -> list:
    """Deviate from the nominal routine the way a person actually does.

    Without this the household is a metronome, every prediction is certain, and
    the cost analysis below degenerates. A benchmark that flatters the
    predictor is worse than no benchmark.
    """
    steps = list(routine)

    if not weekend and rng.random() < 0.22:          # works from home
        steps = [s for s in steps
                 if s[0] not in ("Away", "LeaveHome", "ReturnHome")]
        steps.append(("Chores", 470, 300, 60, 90))
        steps.append(("Relax", 770, 180, 60, 90))
        steps.sort(key=lambda s: s[1])

    if rng.random() < 0.28:                           # skips breakfast
        steps = [s for s in steps if s[0] != "Breakfast"]

    if rng.random() < 0.18:                           # showers at night instead
        steps = [s for s in steps if s[0] != "Bathe"]
        steps.append(("Bathe", 1230, 25, 60, 10))
        steps.sort(key=lambda s: s[1])

    if rng.random() < 0.15:                           # eats out
        steps = [s for s in steps if s[0] != "Cook"]

    return steps


def generate_day(rng: random.Random, weekend: bool) -> list:
    """Return SLOTS_PER_DAY activity labels for one day."""
    routine = vary_routine(rng, WEEKEND if weekend else WEEKDAY, weekend)
    timeline = [None] * (24 * 60)

    cursor = 0
    for activity, start, duration, s_jit, d_jit in routine:
        start = max(cursor, _jitter(rng, start, s_jit))
        duration = max(10, _jitter(rng, duration, d_jit))
        end = min(24 * 60, start + duration)
        for minute in range(cursor, min(start, 24 * 60)):
            timeline[minute] = timeline[minute - 1] if minute else activity
        for minute in range(start, end):
            timeline[minute] = activity
        cursor = end
        if cursor >= 24 * 60:
            break
    for minute in range(24 * 60):
        if timeline[minute] is None:
            timeline[minute] = timeline[minute - 1] if minute else "Sleep"

    for name, prob, (lo, hi), dur in RARE_EVENTS:
        if rng.random() < prob:
            start = rng.randrange(lo, max(lo + 1, hi))
            length = max(15, int(rng.gauss(dur, dur / 3.0)))
            for minute in range(start, min(24 * 60, start + length)):
                timeline[minute] = name

    # Collapse to slots by majority within the slot.
    slots = []
    for s in range(SLOTS_PER_DAY):
        window = timeline[s * SLOT_MINUTES:(s + 1) * SLOT_MINUTES]
        slots.append(Counter(window).most_common(1)[0][0])
    return slots


def generate(days: int, seed: int) -> list:
    rng = random.Random(seed)
    return [generate_day(rng, weekend=(d % 7) in (5, 6)) for d in range(days)]


# --- The two task definitions ---------------------------------------------

def samples_next_slot(days: list) -> list:
    """(context, truth) for 'what is happening 15 minutes from now'."""
    out = []
    for d, slots in enumerate(days):
        weekend = (d % 7) in (5, 6)
        for s in range(SLOTS_PER_DAY - 1):
            out.append(((slots[s], s, weekend), slots[s + 1]))
    return out


def samples_next_distinct(days: list) -> list:
    """(context, truth) for 'what happens after the current activity ends'."""
    out = []
    for d, slots in enumerate(days):
        weekend = (d % 7) in (5, 6)
        for s in range(SLOTS_PER_DAY - 1):
            current = slots[s]
            nxt = None
            for t in range(s + 1, SLOTS_PER_DAY):
                if slots[t] != current:
                    nxt = slots[t]
                    break
            if nxt is not None:
                out.append(((current, s, weekend), nxt))
    return out


# --- Predictors: lookup tables, nothing more ------------------------------

class Majority:
    name = "always predict the most common activity"

    def fit(self, samples):
        self.table = Counter(t for _, t in samples)
        self.total = sum(self.table.values())
        self.best = self.table.most_common(1)[0][0]
        return self

    def predict(self, ctx):
        return self.best, self.table[self.best] / self.total


class TimeOfDay:
    name = "lookup by (time of day, weekday/weekend)"

    def key(self, ctx):
        _, slot, weekend = ctx
        return (slot, weekend)

    def fit(self, samples):
        self.table = defaultdict(Counter)
        for ctx, truth in samples:
            self.table[self.key(ctx)][truth] += 1
        self.fallback = Counter(t for _, t in samples).most_common(1)[0][0]
        return self

    def predict(self, ctx):
        counts = self.table.get(self.key(ctx))
        if not counts:
            return self.fallback, 0.0
        label, n = counts.most_common(1)[0]
        return label, n / sum(counts.values())


class ActivityAndTime(TimeOfDay):
    name = "lookup by (current activity, hour, weekday/weekend)"

    def key(self, ctx):
        current, slot, weekend = ctx
        return (current, slot * SLOT_MINUTES // 60, weekend)


# --- Scoring ---------------------------------------------------------------

def score(model, samples):
    hits = 0
    per_class = defaultdict(lambda: [0, 0])  # truth -> [hit, total]
    for ctx, truth in samples:
        pred, _ = model.predict(ctx)
        per_class[truth][1] += 1
        if pred == truth:
            hits += 1
            per_class[truth][0] += 1
    overall = hits / len(samples)
    recalls = {k: v[0] / v[1] for k, v in per_class.items()}
    macro = sum(recalls.values()) / len(recalls)
    return overall, macro, recalls, per_class


def act_utility(model, samples, target, benefit, cost_fp, cost_fn, threshold):
    """Net utility of acting on a prediction of `target` at a confidence cut."""
    net = 0.0
    acted = 0
    for ctx, truth in samples:
        pred, conf = model.predict(ctx)
        acting = (pred == target and conf >= threshold)
        if acting:
            acted += 1
            net += benefit if truth == target else -cost_fp
        elif truth == target:
            net -= cost_fn
    return net, acted


def bar(fraction, width=28):
    filled = int(round(fraction * width))
    return "#" * filled + "." * (width - filled)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=400)
    ap.add_argument("--seed", type=int, default=1)
    args = ap.parse_args()

    days = generate(args.days, args.seed)
    split = int(len(days) * 0.7)
    train_days, test_days = days[:split], days[split:]

    print("=" * 74)
    print("Household activity prediction: what a lookup table already gets you")
    print("=" * 74)
    print("Synthetic household. %d days (%d train / %d test), seed %d, %d-minute slots."
          % (len(days), len(train_days), len(test_days), args.seed, SLOT_MINUTES))
    print("No model. No GPU. Counting, and then dividing.\n")

    tasks = [
        ("A. next 15-min slot   ('what is happening soon')", samples_next_slot),
        ("B. next distinct act. ('what happens after this')", samples_next_distinct),
    ]

    results = {}
    for label, builder in tasks:
        train, test = builder(train_days), builder(test_days)
        print("-" * 74)
        print("TASK %s" % label)
        print("-" * 74)
        print("  %-52s %8s %8s" % ("predictor", "overall", "macro"))
        for cls in (Majority, TimeOfDay, ActivityAndTime):
            model = cls().fit(train)
            overall, macro, recalls, per_class = score(model, test)
            print("  %-52s %7.1f%% %7.1f%%" % (cls.name, overall * 100, macro * 100))
            results[(label[0], cls.__name__)] = (overall, macro, recalls, per_class, model, test)
        print()

    # 1. What counting alone already achieves.
    best_a = results[("A", "ActivityAndTime")][0]
    best_b = results[("B", "ActivityAndTime")][0]
    dumb_a = results[("A", "Majority")][0]
    print("=" * 74)
    print("1. 90% IS THE FLOOR, NOT THE TARGET")
    print("=" * 74)
    print("  Task A, best lookup table: %.1f%%. That is counting, on a CPU," % (best_a * 100))
    print("  in well under a second. No model was trained and none was loaded.\n")
    print("  On the identical task, the choice of trivial baseline alone moves the")
    print("  headline from %.1f%% to %.1f%% - a %.0f-point swing with no learning" 
          % (dumb_a * 100, best_a * 100, (best_a - dumb_a) * 100))
    print("  anywhere in it. Task B moves it again, to %.1f%%." % (best_b * 100))
    print("  So a bare '90% accuracy' does not describe an achievement. It is")
    print("  roughly what you get for free, and anything claiming it owes a")
    print("  comparison against the lookup table before claiming anything else.\n")

    # 2. Overall accuracy hides the rare events.
    overall, macro, recalls, per_class, _, _ = results[("A", "ActivityAndTime")]
    print("=" * 74)
    print("2. OVERALL ACCURACY IS A POPULARITY CONTEST")
    print("=" * 74)
    print("  Task A, best lookup table: %.1f%% overall, %.1f%% averaged over classes.\n"
          % (overall * 100, macro * 100))
    print("  %-13s %7s  %6s  %s" % ("activity", "share", "recall", "recall"))
    ranked = sorted(per_class.items(), key=lambda kv: -kv[1][1])
    total = sum(v[1] for v in per_class.values())
    for name, (hit, n) in ranked:
        print("  %-13s %6.1f%%  %5.1f%%  %s"
              % (name, 100 * n / total, 100 * hit / n, bar(hit / n)))
    rare = [n for n, (h, c) in per_class.items() if c / total < 0.02]
    if rare:
        worst = min(rare, key=lambda n: per_class[n][0] / per_class[n][1])
        print("\n  '%s' is %.1f%% of the day and is recalled %.1f%% of the time."
              % (worst, 100 * per_class[worst][1] / total,
                 100 * per_class[worst][0] / per_class[worst][1]))
    print("  The headline number survives that because the rare events are rare.")
    print("  They are also the only ones worth waking up a house for.\n")

    # 3. Acting costs something.
    print("=" * 74)
    print("3. NOBODY PRICES BEING WRONG")
    print("=" * 74)
    _, _, _, _, model, test = results[("B", "ActivityAndTime")]
    target = "Breakfast"
    print("  Policy: start the coffee when '%s' is predicted next.\n" % target)
    scenarios = [
        ("kettle  (cheap to be wrong)", 1.0, 0.5, 0.4),
        ("beans   (orders a delivery)", 1.0, 12.0, 0.4),
    ]
    for name, benefit, cost_fp, cost_fn in scenarios:
        print("  %s   benefit %.1f / false-act -%.1f / missed -%.1f"
              % (name, benefit, cost_fp, cost_fn))
        # Doing nothing is the policy every automation has to beat.
        do_nothing, _ = act_utility(model, test, target, benefit, cost_fp,
                                    cost_fn, 1.01)
        print("    %-11s %9s %16s" % ("threshold", "acts", "gain vs nothing"))
        best = None
        for threshold in (0.0, 0.25, 0.5, 0.6, 0.7, 0.8, 0.9, 1.01):
            net, acted = act_utility(model, test, target, benefit, cost_fp,
                                     cost_fn, threshold)
            gain = net - do_nothing
            print("    %-11s %9d %16.1f  %s"
                  % ("%.2f" % threshold, acted, gain,
                     "(never acts)" if acted == 0 else ""))
            if best is None or gain > best[1]:
                best = (threshold, gain, acted)
        if best[2] == 0 or best[1] <= 0.0:
            verdict = ("the system never earns its place: doing nothing wins")
        elif best[0] <= 0.0:
            verdict = "act on the argmax; being wrong is cheap enough"
        else:
            verdict = "worth doing, but only above a confidence cut"
        print("    -> best %+.1f at threshold %.2f: %s\n"
              % (best[1], best[0], verdict))

    print("=" * 74)
    print("WHAT THIS DOES AND DOES NOT SETTLE")
    print("=" * 74)
    print("  Settled: a lookup table is a real baseline here, so any claim that")
    print("  this needs a large local model owes a comparison against counting.")
    print("  Settled: a bare accuracy figure is not a specification.")
    print("  Open:    the same run against CASAS Aruba, which is real and public.")
    print("  Open:    whether the acting-policy layer is genuinely unoccupied.")
    print("  This household is synthetic; treat the shape as the result, not the")
    print("  digits.")


if __name__ == "__main__":
    main()
