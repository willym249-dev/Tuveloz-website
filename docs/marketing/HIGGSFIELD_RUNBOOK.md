# Higgsfield runbook — "I've Got This" series

Exact production steps. Creative spec lives in [TUVELOZ MARKETING IDEAS.md](TUVELOZ%20MARKETING%20IDEAS.md);
this file is just *how to make it*.

Higgsfield ships changes often, so a button may sit somewhere slightly different than
described. The **order of operations and the prompts are the part that matters** — those
hold regardless of where the buttons move.

---

## Two settings to verify before every single generation

Both of these bit us on the first run. Check them each time — they don't always persist.

1. **Aspect ratio must be 9:16.** The ratio is a UI control, *separate* from the prompt
   text — writing "9:16 vertical" in the prompt does not override it. If output thumbnails
   look landscape, stop and fix the setting. A 16:9 plate crops away the sky and the water
   reflection, which is most of why the shot works.
2. **The CHARACTER slot must be EMPTY for location plates.** It defaults to something
   ("GENERAL"). A character reference attached to a pure landscape biases the result. That
   slot is only used in Phase 3, and only for `tuveloz-guy`.

---

## Before you start

**Plan.** The free tier watermarks every export. A watermarked clip is unusable as an ad.
Be on at least the entry paid plan before you generate anything you intend to post.

**Make the folders now** so downloads have somewhere to land:

```bash
mkdir -p brand/ads/got-this-assets/{ep1-battery,ep2-diagnostics,ep3-oil,ep4-carwash,shared}
```

**Naming convention.** Name every download the moment it lands, before generating the next
one. You will produce 15+ clips and they all arrive called something like
`higgsfield_output_final(3).mp4`. Use:

```
ep1-clipB-confidence-v1.mp4
ep1-clipC-consequence-v2.mp4
shared-plate-goldenhour-v1.mp4
```

Version numbers matter — you will regenerate. Keep the rejects until the series is cut;
you'll sometimes want v1 back after seeing v3.

---

## Phase 1 — Build the hero character (do this before anything else)

Everything depends on this. If you change the character later, every clip you've made
becomes unusable. Spend real time here.

### Step 1.1 — Generate the character portrait

1. Go to **higgsfield.ai/create** and choose **image** generation.
2. Paste this prompt exactly:

> Photorealistic full-body portrait of a heavyset friendly man in his late 30s, short dark
> hair, light stubble, wearing a plain navy work jacket over a grey t-shirt and dark jeans.
> Standing in a parking area at golden hour, neutral confident expression, arms relaxed at
> his sides, facing camera. Natural warm side lighting, shallow depth of field, sharp focus
> on face, 9:16 vertical framing. No text, no logos, no watermarks.

3. Generate **4 variations**. Don't take the first one.

### Step 1.2 — Pick the right one (this is a real decision, not a formality)

Judge on three things, in this order:

- **Does his face read as warm?** He's the butt of every joke. If he looks mean or smug in
  the neutral shot, the series turns cruel instead of affectionate. You want someone the
  audience is rooting for.
- **Is the jacket plainly readable?** It's the continuity anchor across four episodes.
  Busy textures or logos will drift between generations.
- **Is the face sharp and well-lit?** Character Consistency works off this image. A soft or
  shadowed face gives you a mushy character in every downstream clip.

### Step 1.3 — Lock it into Character Consistency

1. Save the chosen image to `brand/ads/got-this-assets/shared/hero-character.png`.
2. In Higgsfield, open the **Character Consistency** feature and upload that image as your
   reference character.
3. Give it a name you'll recognize in a dropdown three weeks from now — `tuveloz-guy`.

From here on, **every clip with the man in it is image-to-video driven off this
reference.** Never text-to-video a character shot.

---

## Phase 2 — Build the location plate (generate once, reuse four times)

This is clip A of every episode. One good plate does the whole series.

### Step 2.1 — Generate the still

Same image generation flow. Prompt:

> Photorealistic wide shot of a suburban American lakefront town center at golden hour. A
> brick promenade curving along a small calm lake, low brick-and-glass restaurant buildings
> with outdoor patios, string lights strung overhead, a fountain, mature trees, families
> dining outdoors in the soft-focus distance. Warm low sun flaring across the water.
> Cinematic, shallow depth of field, 9:16 vertical. No text, no logos, no signage.

Generate 4. Pick the one that looks **most expensive** — this shot's entire job is to make
the viewer think they're watching a tourism spot for the first two seconds.

Save as `shared/plate-goldenhour.png`.

### Step 2.2 — CUT. One plate for the whole series.

**Decision 2026-08-07: there is no blue-hour plate. All four episodes use the single
golden-hour plate.**

The original plan had Episode 1 at dusk so the sparks would pop against dark water. Three
generation rounds failed to produce a dusk version of *the same place* — text-only runs
kept inventing new architecture (open water, a modernist glass box, then repeatedly an
ornate European plaza). Relighting requires the source image attached as an **input image**
via the `+` control at the left of the prompt bar; the CHARACTER slot is not that control.

Rather than keep fighting it: **consistency across four episodes is worth more than one
prettier spark shot.** Four videos in the same recognizable place read as a series. Four
videos in four different cities read as four unrelated ads. A European-looking plaza also
undercuts a "coming to Montgomery County" claim with the exact local audience being
targeted.

Episode 1's sparks land warm-on-warm instead of hot-on-blue. Acceptable.

If Episode 1 feels flat once cut, revisit *then* — with the locked golden-hour plate
attached as an input image, and only the lighting named in the prompt.

**General rule this cost us three rounds to learn:** to edit an existing image, attach it
as an input image and name **only what changes**. Re-describing the whole scene makes the
model regenerate from scratch, and the location is lost.

### Step 2.3 — Animate the plate

1. Go to **higgsfield.ai/create/video**.
2. Choose a model — **Kling** is the safe pick here; it handles slow landscape motion
   cleanly and supports start/end frames, which you'll want in Phase 3.
3. Upload `plate-goldenhour.png` as the start frame.
4. Preset: **Dolly In** (or Crane). Slow.
5. Prompt: `Slow steady push forward across the water. Gentle, cinematic, no camera shake.`
6. Duration: **4 seconds** (you'll only use ~2.5, but the handles give the editor room).
7. Generate. Renders in roughly two minutes.

Download to `shared/`. This one clip opens all four episodes.

Generate it **twice** and keep the better take. It's two seconds of screen time but it's
the first two seconds of every video in the series — it's the shot doing all the
misdirection, and it's the cheapest place to buy quality.

---

## Phase 3 — Generate the episode clips

Two clips per episode: **B (confidence)** and **C (consequence)**. Clip A is the plate you
already made.

### The one rule that makes this work

**Never generate the mechanism.** Don't try to make the model show a drain plug producing a
stream of oil that lands on a face. It will fail, and you'll burn a dozen generations
learning that. Generate the man *before*, and the man *already ruined*. Cut between them.
The audience fills the gap and their version is funnier than any render.

### Optional but strong — use start/end frames on clip C

Kling supports a start frame and an end frame. On clip C this gives you exact control of
the only motion that matters:

- **Start frame:** the ruined man, frozen, mouth closed
- **End frame:** same man, same position, mouth open mid-scream

You get a controlled, snappy reaction landing precisely on your cut point instead of
whatever the model felt like doing. Generate the two stills first (image generation, off
the character reference), then feed both in.

**Do not** use start/end frames to interpolate from confident → ruined. That renders the
mechanism, which is exactly what you're avoiding.

---

### Episode 1 — Batteries

**Clip B — confidence**

- Model: Kling · Character reference: `tuveloz-guy` · Preset: **static** or gentlest Dolly In
- Duration: **5s**
- Prompt:

> The man stands between two cars with their hoods up, holding a red jumper cable clamp in
> one hand and a black clamp in the other. He looks directly at camera with complete
> confidence and gives a small satisfied nod. Golden hour, warm side light. Subtle handheld
> motion, photorealistic, 9:16 vertical.

**Clip C — consequence**

- Model: Kling · Character reference: `tuveloz-guy` · Preset: **Crash Zoom In**
- Duration: **4s**
- Prompt:

> The same man, his face lit hard from below by a sudden burst of orange sparks, hair blown
> back, eyes wide, mouth beginning to open in shock. He is frozen mid-reaction. Golden hour
> parking area, photorealistic, 9:16 vertical.

The crash zoom is the punchline. Don't substitute a gentler move.

**Clip D — the button** *(Episode 1 only — folded in from the retired Reel 2)*

- Model: Kling · Character reference: `tuveloz-guy` · Preset: **static** — no camera move at all
- Duration: **4s**
- Prompt:

> The same man now seated in the driver's seat, face lightly soot-smudged, turning his head
> slowly toward camera with a completely blank deadpan expression. He holds the stare, then
> lowers his forehead onto the steering wheel. Golden hour light through the windshield,
> photorealistic, 9:16 vertical.

Save as `ep1-battery/clipD.mp4`. **Keep the camera dead still** — the stare only works if
nothing else moves. This is the trending deadpan-documentary beat, and it's the button the
other three episodes don't have.

**The horn is the audio cut.** Forehead hits the wheel → horn blares → cut to card mid-blast.
If the generated clip has no horn, add it in the edit on the contact frame. Same clipped
trick as the scream, better sound, and it lands right before the CTA.

⚠ Episode 1 is **golden hour like the rest** — the blue-hour plate was cut in Step 2.2.
Ignore any older note about dusk.

---

### Episode 2 — Diagnostics

**Clip B — confidence**

- Preset: **static** · Duration: **5s**

> The man sits in the driver's seat of a parked car, leaning forward and squinting at an
> illuminated orange check-engine warning light on the dashboard. He looks confident and
> unbothered, like he knows exactly what it means. Warm evening light through the
> windshield, photorealistic, 9:16 vertical.

**Clip C — consequence**

- Preset: **slow Dolly In** (not crash zoom — see note) · Duration: **5s**

> The same man slumped back against the driver's seat headrest, phone held limply in one
> hand, staring blankly upward with a completely defeated expression. Evening light through
> the windshield, photorealistic, 9:16 vertical.

**Why this one breaks the pattern:** it's the quiet episode. No scream, no crash zoom — just
surrender. Run it second so the format doesn't get predictable by episode three. A series
that does the identical beat four times stops being funny on the third.

---

### Episode 3 — Oil

**Clip B — confidence**

- Preset: **static** · Duration: **5s**

> The man lies on his back on the pavement beneath a parked sedan, holding a wrench up
> toward the underside of the car, sleeves rolled up. He turns his head slightly toward
> camera with a confident half-smile. Warm golden hour light raking under the car,
> photorealistic, 9:16 vertical.

**Clip C — consequence**

- Preset: **Crash Zoom In** · Duration: **4s**

> The same man lying on his back under a car, his entire face and hair completely drenched
> in glossy black oil, eyes squeezed shut, absolutely motionless. Golden hour light catching
> the wet sheen on his face. Photorealistic, 9:16 vertical.

Hold the stillness a full beat in the edit before you cut. The non-reaction is funnier than
a reaction — this is the best frame in the series, let it sit.

---

### Episode 4 — Car wash

**Clip B — confidence**

- Preset: **static** · Duration: **5s**

> The man stands beside a dusty car holding a pressure washer wand with both hands, looking
> at camera with a determined confident grin. Golden hour, brick promenade and lake behind
> him, photorealistic, 9:16 vertical.

**Clip C — consequence**

- Preset: **Crash Zoom In** · Duration: **4s**

> The same man completely drenched head to toe, water streaming off his hair and jacket,
> standing in a puddle, eyes wide, frozen in place. Behind him, out of focus, people seated
> at outdoor restaurant tables have turned to look at him. Golden hour, photorealistic,
> 9:16 vertical.

The onlookers are the payoff of setting this at a lakefront town center at all. Keep them
soft and background — never cut to them.

---

## Phase 4 — Review before you download

Check each clip for these, in order. Regenerate on any failure — it's cheaper than
discovering it in the edit:

1. **Is it the same man?** Compare side by side against `hero-character.png`. Face and
   jacket. Character drift is the #1 killer here and it's easy to miss one clip at a time.
2. **Any text, logos, or signage?** Models hallucinate storefront lettering constantly. A
   garbled fake restaurant sign in the background makes the whole thing look cheap.
3. **Hands.** Check every frame where he holds something — clamps, wrench, wand. Hands are
   still where these models fail most visibly.
4. **Does the motion stop cleanly?** You need a stable frame at the cut point. Drifting
   camera at the end of clip C makes the hard cut feel sloppy.

---

## Phase 5 — Assemble locally (zero cost)

Higgsfield makes clips. Nothing else. The end card, the voiceover, and the cut all happen
on your machine with ffmpeg — free, repeatable, and exactly on brand.

Do **not** have Higgsfield generate the end card or any text. AI text rendering is
unreliable, and you have the real lockup sitting in `brand/`.

### The build script

`brand/ads/build-got-this.ps1` does the whole assembly. Verified working 2026-08-07 —
it renders placeholder slates for missing clips, so you can watch the timing before a
single asset exists.

```bash
powershell -File brand/ads/build-got-this.ps1
```

| Flag | Effect |
|---|---|
| *(none)* | All four episodes, **provider** end card — `tuveloz.com/join`, "Keep 100% of your price. Join free." |
| `-Episode 1` | Just that episode |
| `-Launch` | **Customer** end card — `tuveloz.com`, "Post your job. Compare quotes. Get moving." |

⚠ **Do not export with the hook text burned in.** Add all on-screen text natively in the
Instagram/TikTok editor — native overlays index better and stay repositionable per platform.
The branded end card is the one exception. Hook overlays and the 0:00 hold-rate rule are in
[TUVELOZ MARKETING IDEAS.md](TUVELOZ%20MARKETING%20IDEAS.md); **also turn on the
AI-generated content disclosure toggle** when posting.

Outputs `got-this-ep<N>-<tag>-9x16.mp4` and `-1x1.mp4` into `brand/ads/`.

**Drop assets here** and re-run — no editing required:

```
brand/ads/got-this-assets/
  shared/plate.mp4          <- the establishing shot, used by all four
  shared/lockup.png         <- transparent brand lockup (already generated)
  shared/vo-tagline.mp3     <- brand sign-off, plays on every episode
  ep1-battery/clipB.mp4  clipC.mp4  clipD.mp4  vo-punch.mp3
  (clipD is Episode 1 only — the stare/horn button)
  ep2-diagnostics/  ep3-oil/  ep4-carwash/
```

### Voiceover — two lines on the card

The end card carries the service punchline first, then the brand sign-off:

```
[hard cut] → 0.12s → "Tuveloz. Check your oil."  → 0.35s → "Customer choice. Provider freedom."
```

The card auto-sizes to fit whatever VO exists, so you never have to retime it.

**Punchlines are provider-facing** (2026-08-07 pivot) — that is what makes the series
runnable pre-launch. Each line names the service *and* flatters the pro's expertise.

| File | Line | Status |
|---|---|---|
| `shared/vo-tagline.mp3` | "Customer choice. Provider freedom." | ✅ Generated 2026-08-07 |
| `ep1-battery/vo-punch.mp3` | **"Tuveloz. Get paid for knowing better."** | ⬜ Needs recording |
| `ep2-diagnostics/vo-punch.mp3` | "Tuveloz. That's ten minutes of your time." | ⬜ Needs recording |
| `ep3-oil/vo-punch.mp3` | "Tuveloz. He'd have paid you for that." | ⬜ Needs recording |
| `ep4-carwash/vo-punch.mp3` | "Tuveloz. You own the right equipment." | ⬜ Needs recording |

⚠ `ep1-battery/vo-punch.mp3` currently holds the **superseded** "Tuveloz. Batteries." take —
kept only so the timing is testable. Overwrite it; do not ship it. A bare service noun has
no second meaning, so the flat read lands as a label instead of a joke.

Episodes without a punchline just play the tagline — nothing breaks.

The customer-phase punchline **"Tuveloz. Check your oil."** is parked for the launch re-cut
of Episode 3. It's the line the series came from and it still works — just customer-side.

**Voice settings used** (match these so the four episodes sound identical): ElevenLabs
Multilingual v2, voice "Gravity" (middle-aged male), American, **stability 0.95**, **speed
0.9**, no effect. High stability is what makes it flat — that deadpan is the joke.

**Artlist credits ran out 2026-08-07** (10 → 1). They reset **September 4**. The oil
punchline costs ~3–6 credits and is the one line worth generating first — it's the
original idea the whole series came from.

Per episode the edit is:

```
[plate 2.5s] → [clip B ~3s] → HARD CUT → [clip C ~2s] → [end card 3s]
```

The cut from B to C is butt-cut — no dissolve, no fade, single frame. Audio: the scream
starts on the first frame of clip C and is **clipped mid-vowel** by the end card. Don't
fade it. The abrupt silence under the flat VO is where the joke actually lands.

End card spec and both phase variants (pre-launch vs launch) are in
[TUVELOZ MARKETING IDEAS.md](TUVELOZ%20MARKETING%20IDEAS.md). `brand/ads/build-ad-01.ps1` already does this
pattern — navy plate, centered lockup, orange URL, fade in.

---

## If a generation comes out wrong

| Symptom | Fix |
|---|---|
| Different-looking man | Character reference isn't applied, or the prompt over-describes his appearance. Let the reference carry the face — describe only pose and action. |
| Face soft or mushy | Your source `hero-character.png` isn't sharp enough. Go back to Phase 1 and pick a better base. |
| Model renders the mechanism badly | You described a physical process. Rewrite to describe a *state* — "already drenched," not "gets drenched." |
| Camera drifts past the beat | Shorten duration. A 4s clip where you use 2s gives the model less room to wander. |
| Fake signage in background | Add "no text, no logos, no signage" — it's already in every prompt above; if it persists, reframe tighter on the subject. |
