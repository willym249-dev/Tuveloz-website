# Ad 03 — "This could be your Tuesday" (provider recruitment)

- **Status:** in production — hero frame generated, video not yet rendered
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-07

The finished cut of the reel specced in
`../outreach/reel-provider-recruitment-v3.md`. That file holds the concept and
the on-screen text; this file records what has actually been generated and what
is left to do. Captions are already written and ready to paste in
`../outreach/media/captions-v3-copy-paste.txt`.

Warm and inspiring on purpose, and aimed at providers rather than customers —
customer job posting is paused (`lib/launch-status.ts`), so a customer-facing
ad would drive people to a door that does not open. See
`../outreach/post-now-august-2026.md` §1.

## Why this shape

Matches the August 2026 trend read: low-production, single-take, authentic
footage is out-reaching polished ads, and subtitle-driven storytelling indexes
well without needing licensed audio — which matters here, because the music
licensing situation in `HANDOFF.md` is unresolved.

## Hero frame — generated 2026-08-07

- **Model:** Nano Banana 2, 2K, 9:16
- **Generation ID:** `019fdcf4-fb92-782c-8410-f7b57d994844`
- **Cost:** 130 credits
- **In this repo:** no — see the blocker below

Prompt used:

> Photorealistic vertical 9:16 portrait frame, golden-hour late-afternoon
> sunlight. An independent mobile mechanic in his 30s, warm and confident,
> wearing a clean dark navy work shirt with sleeves rolled up, stands beside the
> open hood of a mid-size silver SUV parked in a leafy suburban driveway in
> Maryland. He is wiping his hands on a shop rag and smiling slightly to
> himself, the quiet satisfaction of finishing good work on his own schedule.
> Behind him, green summer trees, a modest brick-and-siding house, warm
> backlight through the leaves creating soft lens flare. Handheld documentary
> photography feel, shallow depth of field, authentic and unstaged, natural skin
> tones, no text or logos anywhere in frame. The lower third of the frame is
> kept visually clean and slightly shaded for later caption overlay. Warm color
> palette with deep navy shadows.

## Two blockers, both outside the code

1. **Credits are effectively exhausted.** The AI Suite plan had 140 credits when
   this session started — down from the 15,960 recorded in `HANDOFF.md` on
   2026-08-04. The hero frame cost 130, leaving **10**, which is not enough to
   render the image-to-video pass. The plan renews **2026-09-04**. Either wait
   for the renewal or top up before the animation step.

   Lesson for next time: a 2K frame on a premium image model costs roughly a
   tenth of a month's allowance. Generate hero frames at 1K on a cheaper model
   and reserve the budget for the video pass, which is the part that cannot be
   substituted.

2. **The generated file cannot be pulled into this repo from a Claude Code
   session.** The environment's network policy denies `artlist.io` hosts
   (`cms-toolkit-artifacts.artlist.io` and `mcp.artlist.io` both answer 403 to
   CONNECT), so the PNG has to be downloaded manually from the Artlist toolkit
   and dropped into `ad-03-assets/`. This is the same manual step recorded in
   `HANDOFF.md` for ad 01.

## Remaining steps

1. Download the hero frame from the Artlist toolkit into
   `ad-03-assets/tuesday-hero.png` (generation ID above).
2. After the 2026-09-04 renewal, run the image-to-video pass from that frame —
   8 seconds, 9:16, 720p, ambient audio, no camera move beyond a slow push.
   Seedance 2.5 I2V (480p/720p) is the cheap option; Kling 2.1 Standard is the
   fallback.
3. Export clean at 1080×1920. **No baked-in text** — add every overlay natively
   in the Instagram and TikTok editors, per the captions file.
4. Post with the AI-generated-content label **on** for both platforms.
5. Tag the link `tuveloz.com/join?src=tuesday-en` (and `?src=tuesday-es` for the
   Spanish cut) so the funnel at `/admin/analytics-funnel` can attribute
   applications to it.

## Do not

Do not add a price, an income claim, or any suggestion that customers can book
today. Do not present the person in the frame as a real Tuveloz provider — this
is AI-generated stock, not a spotlight. When a real provider volunteers, a
spotlight of them beats this clip outright; see `../outreach/provider-spotlight-kit.md`.
