# "I've Got This" — AI short video series

Recurring-character series. One character, one look, one service per episode.
Generated, not filmed.

**Slot:** Customer-side. Same phase gate as
[Ad 02 "The Rescue"](../../brand/ads/breakdown-rescue-ad-02.md) — see Phase gate below.

**Format:** 9:16 vertical, 9–11s, no dialogue.

**Engine:** Beautiful establishing shot → cocky setup → hard cut → consequence →
navy card, orange funnel, flat VO.

---

## Phase gate — read before generating anything

**Verified against `config/provider-eligibility-matrix.json` on 2026-08-07: all 25 services
are currently `customer_visible: false`, and every one carries a `disabled_pending_*`
launch state. There is no bookable service today.** The service list in
`brand/ads/HANDOFF.md` is *intended* launch scope, not current state — don't read it as
"these are live."

Two consequences:

1. **No episode may imply a customer can book anything.** Not "call us," not "book now,"
   not a link to a service page — those pages don't render a bookable service. Coming-soon
   framing is the only honest option, and it is mandatory on every episode, not optional.
2. **Never advertise `general_auto_repair` in any form.** Its launch state is
   `prohibited_broad_category` — it is permanently off, not pending. Keep every tagline
   pinned to one narrow named service.

### RESOLVED 2026-08-07: the series is provider-side, and runnable now

The original cut was customer-side — *you failed, we'll come fix it* — which is exactly what
the phase gate blocks. **Aiming the punchline at providers instead removes the block
entirely**, because provider recruitment is the one thing permitted pre-launch.

The gag does not change at all. Only who the last line talks to.

It works because of who's watching: **a mechanic spots the reversed jumper cables before the
sparks.** They wince. That wince is the hook — the punchline flatters exactly the expertise
being recruited, and lands off the joke instead of ignoring it.

So the series ships now with the provider end card, and the customer-side cut becomes a
launch-phase re-edit of the same footage: new punchline VO, new card, identical clips.

**Two end cards, one edit:**

| Phase | URL | Line | Runnable |
|---|---|---|---|
| **Provider** *(default)* | tuveloz.com/join | "Keep 100% of your price. Join free." | **Now** |
| Customer | tuveloz.com | "Post your job. Compare quotes. Get moving." | After launch |

Both are built into `brand/ads/build-got-this.ps1`. Default is provider; pass `-Launch` for
the customer cut. Nothing else in the edit changes.

⚠ Fee copy is fixed: **providers keep 100%, customers pay 5%.** Never write "keep 95%."

**Episode order follows how many gates each service still has to clear.** Since everything
is disabled, "which is legal" is the wrong sort — the useful sort is which unlocks first.
Three services are pending mandatory requirements *only*, with no insurer clause:

| Service | Pending on |
|---|---|
| `battery_replacement` | mandatory requirements |
| `basic_vehicle_diagnostics` | mandatory requirements |
| `official_vehicle_inspection` | mandatory requirements |

Everything else additionally needs insurer sign-off, environmental review, or agency
registration. So the series leads with **batteries** and **diagnostics** — the two most
likely to be real by the time the videos are cut. Oil and detailing follow; they're
insurer- and environmental-gated respectively and may land later.

The lockout, tire, fuel-delivery and towing gags stay benched at the bottom — those need
named licenses (locksmith registration, scrap-tire authorization, motor-fuel and hazmat
packages), so they're the furthest out, not just the least convenient.

---

## Why the AI version changes the gags (and improves them)

AI video is **excellent** at two things we need: a gorgeous establishing shot, and a human
face reacting. It is **bad** at the third thing: mechanical cause-and-effect. A drain plug
unscrewing and producing a stream of oil that lands on a specific face is exactly the kind
of physical causality these models fumble.

So don't generate the mechanism. **Cut around it.**

Every episode is three short clips:

| Clip | What it is | Why AI handles it |
|---|---|---|
| **A — Beauty** | Slow push across the lakefront, golden hour, no character | Models nail this; it's a landscape |
| **B — Confidence** | Our guy, tool in hand, sure of himself. No action completes. | A held expression, not a physical event |
| **C — Consequence** | He is *already* soaked / sparked / defeated. Frozen. Then the scream starts. | A reaction shot, not a causal chain |

Cutting straight from **B to C** — from total confidence to total ruin, skipping the middle
— is a stronger joke than showing the mechanism. The audience fills the gap and their
version is funnier than anything we could render. This is the format working *with* the
tool's limits instead of against them.

**Character consistency is the hard problem.** Solve it once: generate a single hero
reference image of the guy, lock it, and drive every character clip with image-to-video off
that reference. Never text-to-video a character shot — you'll get a different man each time.

**Don't name RIO in prompts.** Models don't know "RIO Washingtonian Center," and naming a
real trademarked property in a paid ad invites a problem you don't need. Describe the look
instead — the prompts below do. You get the RIO feel without the RIO liability.

---

## Production: Higgsfield

Higgsfield fits this series better than a general text-to-video tool, for two specific
reasons. Use both deliberately.

### 1. Character Consistency — do this first, before any clip

Upload one hero reference image (prompt below) to Higgsfield's Character Consistency
feature. It holds facial features and clothing across generations. **This is the single
biggest risk in a recurring-character series** — without it you get a different man every
episode and the whole premise collapses. Lock the character before generating anything else.

Then drive every character clip as **image-to-video** off that reference. Never
text-to-video a shot with the guy in it.

### 2. Camera presets are the joke — assign one per clip

Higgsfield surfaces cinematography moves as first-class presets (Dolly, Crane, Tracking,
Whip Pan, Crash Zoom, Bullet Time, Boom, Snorricam). Don't leave these on default — the
move *is* the comedic punctuation:

| Clip | Preset | Why |
|---|---|---|
| **A — Beauty** | Slow **Dolly In** or **Crane** | Sells the tourism-ad misdirection. Calm, expensive-looking, no hint of a joke. |
| **B — Confidence** | Static, or the gentlest **Dolly In** | Stillness reads as competence. Any energy here undercuts the drop. |
| **C — Consequence** | **Crash Zoom In** on the ruined face | This is the upgrade. A hard snap-zoom onto a soaked, frozen man is the exact punctuation this format wants — it's the visual equivalent of the record scratch. |

The A→C contrast is the entire series: two seconds of serene crane over water, then a
violent crash zoom onto a man covered in oil. Same grammar every episode.

**Bullet Time** is worth one experiment on Episode 1 — freezing the orbit around the spark
burst at blue hour. Try it once; if it reads as flashy rather than funny, go back to crash
zoom. The deadpan is the brand, not the VFX.

### 3. What Higgsfield does NOT make

Generate clips only. Everything else stays local and costs nothing:

- **End card** — exact navy, exact lockup, exact orange. AI text rendering is unreliable
  and you already have the assets. Build it in ffmpeg (`build-ad-01.ps1` pattern).
- **Voiceover** — the flat delivery is the joke; keep control of it.
- **The cut** — the hard cut mid-scream has to land on a specific frame. That's an edit
  decision, not a generation one.

### 4. Plan note

The free tier watermarks output — unusable for ads. You need at least the entry paid plan
(~$9/mo) before generating anything you intend to post.

---

## Hero character reference (generate once, reuse forever)

> Photorealistic portrait, full body, a heavyset friendly man in his late 30s, short dark
> hair, light stubble, wearing a plain navy work jacket over a grey t-shirt and dark jeans.
> Standing in a parking area at golden hour. Neutral confident expression, arms relaxed.
> Natural warm side light, shallow depth of field, 9:16 vertical, no text, no logos.

Lock this image. Every clip below starts from it.

**Location plate (generate once, reuse as clip A across all episodes):**

> Photorealistic wide shot of a suburban American lakefront town center at golden hour.
> Brick promenade curving along a small calm lake, low brick-and-glass restaurant
> buildings with outdoor patios, string lights, a fountain, mature trees, families dining
> outdoors in the distance. Warm low sun flaring across the water. Cinematic, shallow
> depth of field, slow push in, 9:16 vertical, no text, no logos.

---

## Episode 1 — "Jumper Cables" (lead with this one)

**Service:** `battery_replacement` — pending mandatory requirements, **no insurer clause**
(one of the three least-gated services; tag the episode to batteries, not jump start —
`provisional_12v_jump_start` is insurer-gated and further out. Same gag either way.)
**Runtime:** 10s

**Absorbs the retired Reel 2** ("dead battery documentary stare") — see below.

| Clip | Time | Preset | Prompt |
|---|---|---|---|
| A | 0.0–2.0 | Slow Dolly In | Location plate, golden hour. Hook overlay sits on this. |
| B | 2.0–4.8 | Static | From hero ref: *"The man stands between two cars with their hoods up, holding a red jumper cable clamp in one hand and a black clamp in the other. He looks directly at camera with complete confidence and gives a small satisfied nod. Golden hour, warm side light. Slight handheld motion."* |
| C | 4.8–6.4 | **Crash Zoom In** | From hero ref: *"The same man, face lit hard from below by a sudden burst of orange sparks, hair blown back, eyes wide, mouth beginning to open in shock. Frozen mid-reaction. Golden hour parking area."* |
| **D** | 6.4–8.6 | Static | From hero ref: *"The same man now seated in the driver's seat, soot-smudged, turning his head slowly toward camera with a completely blank deadpan expression, holding the stare, then lowering his forehead onto the steering wheel. Golden hour light through the windshield."* |
| — | 8.6–12.0 | — | **HORN HONK** on forehead contact, **HARD CUT.** End card. VO: **"Tuveloz. Get paid for knowing better."** then tagline |

**Clip D is the fold.** Reel 2's real asset was never the dead battery — it was the
documentary stare and the forehead on the horn. Bolted onto the end of the sparks, it gives
Episode 1 a *button* the other three don't have, and rides the deadpan-stare format the
outreach kit flagged as trending.

**The horn is the audio cut.** Forehead hits the wheel, horn blares, cut to card mid-blast —
same clipped-scream trick, better sound. It's the loudest, most native-feeling moment in the
series and it lands right before the CTA.

Runtime ~12s, inside the 7–15s completion sweet spot. If it needs tightening, trim clip A to
1.5s — never clip D.

**Golden hour, not blue hour** — the blue-hour plate was cut (Step 2.2 of the runbook). Warm
sparks on warm light instead of hot-on-blue; consistency across four episodes is worth more.

---

## Episode 2 — "Drain Plug"

**Service:** `sponsored_oil_filter_service` — pending mandatory requirements **+ insurer**.
Further out than Eps 1 and 3; hold this one back if the insurer gate is still open when you cut.
**Runtime:** 10s

| Clip | Time | Prompt |
|---|---|---|
| A | 0.0–2.5 | Location plate, golden hour. Slow push in. |
| B | 2.5–5.5 | From hero ref: *"The man lying on his back on the pavement beneath a parked sedan, holding a wrench up toward the underside of the car, sleeves rolled up. He turns his head slightly toward camera with a confident half-smile. Warm golden hour light raking under the car."* |
| C | 5.5–7.5 | From hero ref: *"The same man lying on his back under a car, his entire face and hair completely drenched in glossy black oil, eyes squeezed shut, absolutely motionless. Golden hour light catching the wet sheen."* |
| — | 7.5–10.0 | **HARD CUT.** End card. VO: **"Tuveloz. He'd have paid you for that."** then tagline |

Clip C is the whole episode. Hold on the stillness for a full beat before the cut — the
non-reaction is funnier than a reaction. Your original tagline lands here intact.

---

## Episode 3 — "Check Engine"

**Service:** `basic_vehicle_diagnostics` — pending mandatory requirements, **no insurer
clause**. One of the three least-gated. Consider running this one second, not third.
**Runtime:** 9s

| Clip | Time | Prompt |
|---|---|---|
| A | 0.0–2.0 | Location plate, golden hour, tighter framing on the patios. |
| B | 2.0–4.5 | From hero ref: *"The man sitting in the driver's seat of a parked car, leaning forward and squinting at an illuminated orange check-engine warning light on the dashboard. Confident, unbothered. Warm evening light through the windshield."* |
| C | 4.5–6.8 | From hero ref: *"The same man in the driver's seat, slumped back against the headrest, phone held limply in one hand, staring blankly at the ceiling with a completely defeated expression. Evening light."* |
| — | 6.8–9.0 | **HARD CUT.** End card. VO: **"Tuveloz. That's ten minutes of your time."** then tagline |

The quiet one. No scream — just surrender. Worth having one in the set that breaks the
pattern, or the format gets predictable by episode four.

---

## Episode 4 — "Pressure Washer"

**Service:** `mobile_car_wash` — pending **environmental review**
(`provisional_basic_detailing` additionally needs OCP). A different gate from the others,
on its own timeline. Cut it last.
**Runtime:** 9s

| Clip | Time | Prompt |
|---|---|---|
| A | 0.0–2.0 | Location plate, golden hour. |
| B | 2.0–4.5 | From hero ref: *"The man standing beside a dusty car holding a pressure washer wand with both hands, looking at camera with a determined confident grin. Golden hour, brick promenade behind him."* |
| C | 4.5–6.8 | From hero ref: *"The same man completely drenched head to toe, water streaming off his hair and jacket, standing in a puddle, eyes wide, frozen. Behind him out of focus, people at outdoor restaurant tables are turned toward him. Golden hour."* |
| — | 6.8–9.0 | **HARD CUT.** End card. VO: **"Tuveloz. You own the right equipment."** then tagline |

The onlookers in clip C are the payoff of shooting "at RIO" at all. Keep them soft and in
the background — never cut to them.

---

## End card (zero credits — build locally)

Reuse the pattern already working in `brand/ads/build-ad-01.ps1`: solid navy plate, logo
overlay, orange text, short fade in.

```
Background   #07182D  (brand navy, full bleed)
Logo         brand/tuveloz-lockup-horizontal.svg, centered, ~62% frame width
Line 1       tuveloz.com                      — #FF6A00, ~5.5% frame width
Line 2       (phase line, see table below)    — white, ~3.8% frame width
Duration     3.0s, fade in 0.4s
```

| Phase | Line 2 |
|---|---|
| Pre-launch | Launching soon in Montgomery County, MD |
| Launch | Post your job. Compare quotes. Get moving. |

The VO lands over the first 1.2s of the card, dead flat. Silence for the rest — do not put
music under the tag. The abrupt quiet after the clipped scream is the joke's landing.

**Consistency is the brand asset here.** Same card, same VO delivery, same timing, every
episode. By episode three people say "Check your oil" before the VO does.

---

## Relationship to the existing reels

`brand/outreach/reel-provider-recruitment.md` already specs two provider reels, and **Reel 2
("dead battery documentary stare") overlaps this series directly** — same territory: car
fails, deadpan beat, provider CTA. Don't ship both as if they're unrelated.

**Resolved 2026-08-07: Reel 2 is retired and folded in.** Its dead-battery cold open was
dropped — a provider-facing series needs a *mistake the mechanic spots*, and a battery that
simply dies has none. What carried over is the part that actually worked: the **documentary
stare and the forehead on the horn**, now clip D of Episode 1, serving as the button and the
audio cut into the end card. `brand/outreach/reel-provider-recruitment.md` is marked
accordingly.

Reel 1 (the straight mechanic-recruitment reel) still ships as-is — it's the conversion play,
not a duplicate.

**Slotting**, per the kit's own logic: Episode 1 is the comedy reach-play and goes first,
the recruitment reel follows the next day. Later episodes take following weeks' Wednesday
slots so the character accumulates recognition instead of burning all four at once.

---

## ⚠ The 3-second problem — read before posting anything

`brand/outreach/reel-provider-recruitment.md` records the benchmark that breaks this
series as originally designed:

> **~50% of viewers drop off in the first 3 seconds.** The hook text must be on screen at
> 0:00. Reels with strong 3-second hold rates reach 5–10× further.

**Every episode opens on 2.5 seconds of a silent, textless, pretty landscape.** That is the
misdirection the whole joke depends on — and it is also, on Reels, a scroll-killer. Half the
audience leaves before the gag starts. Measured target is a **≥60% 3-second hold rate**;
this design would not hit it.

**The fix, which makes the series better rather than worse:** put the hook text over the
plate as a *native* overlay at 0:00 — and aim it at the provider's expertise.

> **"Mechanics of MoCo: you'll spot his mistake before he does 👇"**

That does three jobs at once. It satisfies the 0:00 hook rule. It turns the pretty
establishing shot into a *challenge* — the viewer now has a reason to keep watching. And it
primes the exact wince the punchline pays off. The misdirection survives; it just gets a
job to do.

Per-episode hook variants (all native overlays, 0.0–2.5s, top third):

| Ep | Hook overlay |
|---|---|
| 1 — Jumper cables | "Mechanics of MoCo: you'll spot his mistake before he does 👇" |
| 2 — Check engine | "You already know what that light means. He doesn't 👇" |
| 3 — Drain plug | "Every mechanic watching just winced 👇" |
| 4 — Pressure washer | "You own the right tool for this. He doesn't 👇" |

**Text must be added natively in the Instagram/TikTok editor, not burned in** — native
overlays index better with the algorithm and stay repositionable per platform. The branded
end card is the one exception; it stays baked in.

**Turn on the AI-generated content disclosure toggle.** TikTok and Instagram both require it
for realistic AI content. Non-negotiable.

---

## Captions

Provider-phase captions. Honesty rules from `provider-outreach-kit.md` apply — free to join,
you keep 100% of what you quote (customers pay the site's 5% fee), no exclusivity, and
**say plainly that customer jobs aren't live yet.** Never promise income.

**Ep 1 — Jumper cables**
> You saw it before the sparks, didn't you. ⚡
> Tuveloz is a new Montgomery County marketplace for mobile vehicle services — and we're
> signing up providers before launch.
> ✅ Free to join ✅ You set your prices and keep 100% of what you quote ✅ No exclusivity
> Straight up: customer requests aren't live yet. Applying now means your review is done and
> you're first in line on day one.
> Link in bio → tuveloz.com/join

**Ep 2 — Check engine**
> He's going to google it. You'd have known in five seconds. 🔧
> *(same three ✅ lines + pre-launch honesty line + CTA)*

**Ep 3 — Drain plug**
> Somewhere a mechanic is watching this in physical pain. 🛢️
> *(same body)*

**Ep 4 — Pressure washer**
> This is what happens without the right equipment. You have the right equipment. 🚿
> *(same body)*

**Hashtags:** reuse the rotating pools in `reel-provider-recruitment.md` — gig/work-intent +
mechanic-trade + MoCo local. IG/FB take the ~25-tag set as a first comment; **TikTok stays
at ~6** or it gets deprioritized. Add meme tags on Ep 1 and Ep 3: `#CarMemes #DeadBattery
#CarTok`.

**Posting schedule and measurement:** use the slots already worked out in
`reel-provider-recruitment.md` (Wed/Thu mornings + Wed evening, ES variants Thu). Check the
3-second hold rate 48h after each post — under 40% means rewrite the hook overlay, not the
video.

**Spanish variants post as separate reels, not re-captions** — same rule as the existing kit.

**At launch,** the customer cut swaps the hook overlays, the punchline VO, and the end card
(`-Launch`). The clips do not change.

---

## Backlog — benched until the service is live

| Gag | Cut on | Tag | Blocked by |
|---|---|---|---|
| Coat hanger snaps back into his forehead | The recoil | "Tuveloz. Lockouts." | Not a launch service |
| Jacks the car on a slope, it rolls | The chase | "Tuveloz. Tires." | Tires excluded at launch |
| Walks the lot in the rain with a gas can. Slips. | The fall | "Tuveloz. Fuel delivery." | Not a launch service |
| Wrestles a wiper blade, it whips him in the face | The flinch | "Tuveloz. Wipers." | Insurer gate (`provisional_wiper_blade_replacement`) |
| Squints at a dashboard light, gives up | The exhale | "Tuveloz. Inspections." | `official_vehicle_inspection` — no insurer clause, promote if it clears early |

## The bike gag

Still benched. Shoot it once the character is established, organic-only, and cut on his
face the instant the seat drops — never show impact. Suggestion clears platform review
where depiction does not. Not a first impression.
