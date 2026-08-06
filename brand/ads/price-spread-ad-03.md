# Ad 03 — "Same Battery. Four Prices." (price-transparency, broad reach)

Phase: provider onboarding open, customer requests **not live**.
Pillar: **Price transparency** (`../outreach/audience-growth-playbook.md` §4) —
the one pillar that speaks to customers and providers at the same time.
Primary goal: provider applications at https://tuveloz.com/join
Secondary goal: local followers who convert on launch day.

This is the first Tuveloz ad built for **reach** rather than recruitment. Ads 01
and 02 and the three recruitment reels all talk to providers. This one talks to
anyone in Montgomery County who owns a car, and lets providers overhear it.

---

## Why this format (August 2026 trend read)

- **Reels is the discovery surface.** ~55% of Reels views come from
  non-followers and the format averages a ~30.8% reach rate — the only surface
  where an account with no audience can reach strangers. TikTok holds ~40%
  platform share; Reels and Shorts ~20% each.
- **60–90 second "micro-learning" is out-performing 15-second clips** on most
  platforms in 2026. That reverses the advice baked into reels v1–v3. The main
  cut below is ~40s — long enough to deliver the whole price list (which is
  what earns the save), short enough for a cold account with no watch history.
  A 12s cut ships alongside it for TikTok cold reach.
- **Hook in the first 3 seconds decides completion**, and completion — not
  views — is the number to optimize.
- **UGC-style beats polished branded ads** (79% of consumers say UGC influences
  purchase decisions), so the footage stays documentary and unstaged, and all
  text is added natively in the app editor rather than baked into the export.
- **Price-transparency content is a proven viral engine, and it was invented in
  our metro.** Salary Transparent Street started on the streets of Washington,
  D.C. in 2022 on exactly two questions — "what do you do" and "how much do you
  make" — and became a seven-figure media company. The mechanic is the same:
  publish the number everybody is too polite to ask for. Nobody has run that
  play on local auto repair. That's the opening.
- **#CarTok / #Automotive carry very large reach** and a video crosses the
  For You threshold on early-hours engagement, so the tag stack keeps a few
  high-reach automotive tags on top of the local/intent mix.

Sources for the trend read and every price below are listed in §Sources.

---

## The numbers (published 2026 ranges — read this before posting)

Everything on screen is a **published national range for 2026**, not a survey of
Montgomery County shops. We have not called local shops. The caption says so.
Do not edit the copy in a way that implies these are local quotes we collected.

Standard flooded battery, typical sedan or SUV:

| Where you go | What it runs |
|---|---|
| Walmart | $80–$155 |
| Parts chains (AutoZone, O'Reilly, Advance) | $135–$200, install free with purchase |
| Tire/service centers (Firestone, Pep Boys) | $185–$260 |
| Dealership | Highest labor; $50–$100 install on top, and some models need the new battery registered with a scan tool |
| Mobile service | Flat visit fee $25–$60 rolled into the bill |

Overall spread: **$100 to $350+.**

Labor is where the gap really lives:

- Independent shops: **$40–$100/hr**
- Dealerships: **$75–$150/hr**
- Nationally, shop labor rates run **$95–$220/hr** — on a three-hour job that
  spread alone is a **~$300 difference before a single part is priced**
- Shops in high-cost metros bill **$130–$175/hr**, versus $80–$110 in the South
  and Midwest. The DC metro is a high-cost metro.

The honest thesis, and the line the whole ad turns on: **none of these shops are
lying.** Two shops can quote hundreds apart without either being dishonest —
parts quality, book labor time, diagnostic fees, and warranty terms all move the
number. The problem isn't dishonesty. It's that a car owner has no way to see
the quotes side by side.

That is precisely what Tuveloz is. The ad earns the pitch instead of making it.

---

## The footage — BUILT, no new generation needed

`build-ad-03.py` renders the whole ad from footage **already in this repo**. No
Artlist credits, no licensed music, no external dependency beyond ffmpeg and
Pillow:

```bash
python3 brand/ads/build-ad-03.py
```

Outputs:

| File | What |
|---|---|
| `ad-03-9x16.mp4` | Main cut, 43s, 1080×1920, silent |
| `ad-03-short-9x16.mp4` | TikTok cut, 14s, 1080×1920, silent |
| `ad-03-assets/cards/*.png` | 13 overlay cards, 1080×1920 with alpha |

Sources: `tuveloz-reel-deadbattery-v2.mp4` carries the hook (dashboard warning
lights at golden hour — the exact moment the ad is about), the mechanic reel
carries the turn, and the price cards are drawn on brand navy.

The card PNGs are a deliberate second deliverable. They're full-frame with
alpha and numbered in running order, so the whole ad can be rebuilt on a
**DaVinci Resolve** timeline — drop them on V2 over the two source reels — or
re-cut on davinci.ai without re-typesetting a word.

### Both cuts are silent on purpose

Feed video is watched muted and this ad is text-driven, so silence costs it
nothing — and it keeps an evergreen post clear of the Epidemic Sound licensing
window, which only covers content published while that subscription is active
(see `HANDOFF.md`). Add a track natively in the Instagram/TikTok editor, which
also attaches the post to a trending audio. To mux a licensed track instead:

```bash
ffmpeg -i ad-03-9x16.mp4 -i music.mp3 -map 0:v -map 1:a \
  -af 'afade=t=out:st=37:d=2' -c:v copy -c:a aac -b:a 192k -shortest out.mp4
```

### Optional upgrade: a purpose-shot hook clip

The dead-battery reel works, but a driver standing at an open hood on the phone
is the more literal read of the hook. A hero still for exactly that was
generated 2026-08-06 (Seedream 5.0, 9:16, 2K) and is retrievable from the
Artlist account. The matching motion pass was **not** completed — the model
silently defaulted to 16:9 480p and the credit balance ran out (140 left, 280
minimum). Prompt, if it gets picked up later on davinci.ai or a topped-up
Artlist balance:

> Slow, subtle handheld push-in. A woman lowers a phone from her ear, exhales,
> and glances back at the open hood of her SUV in a leafy suburban driveway with
> a small resigned shake of the head. Golden-hour light, leaves stirring, camera
> drifting almost imperceptibly closer. Natural, unhurried, documentary realism.
> No text, no logos. Keep the lower third clean and shaded.

**Set aspect ratio, resolution and duration by hand every time** — these models
default to 16:9 and a landscape render of a vertical ad is a full-price
mistake. Want: `9:16`, `1080p`, `5s` or `10s`. Negative prompt: `text,
watermark, logo, subtitles, distorted hands, extra fingers, warped face,
morphing`.

Drop-in replacement: swap the new clip in as `BED` at the top of
`build-ad-03.py` and re-run. Nothing else changes.

### AI disclosure

The footage is AI-generated. Turn the **AI-generated content label ON** on every
platform that asks (TikTok: upload settings → AI-generated content; Instagram:
Advanced settings → Add AI label). Non-negotiable — it's in the honesty rules.

---

## Main cut — ~40s, vertical (native text overlays, do NOT bake in)

Hold on the hero frame/clip throughout; the price rows are text cards over a
slow push-in. Brand navy `#07182D` cards, orange `#FF6A00` numbers.

| Time | On-screen text |
|---|---|
| 0.0–3.0s | **$80. Or $260. Same dead battery, same car.** (largest type, top third) |
| 3.0–7.0s | Nobody's lying to you. Here's the actual spread 👇 |
| 7.0–12.0s | Walmart — **$80–$155** |
| 12.0–17.0s | Parts chain — **$135–$200** (install free if you buy the battery there) |
| 17.0–22.0s | Tire/service center — **$185–$260** |
| 22.0–28.0s | Dealer — highest labor, **+$50–$100** to install. Some cars need the battery registered with a scan tool. |
| 28.0–34.0s | Independents bill **$40–$100/hr**. Dealers bill **$75–$150/hr**. In metros like ours, **$130–$175/hr**. |
| 34.0–39.0s | **The problem isn't the prices. It's that you can't see them side by side.** |
| 39.0–44.0s | We're building that for Montgomery County. Mechanics + mobile pros — join free: **tuveloz.com/join** |

## Short cut — 12s, vertical (TikTok cold reach)

| Time | On-screen text |
|---|---|
| 0.0–2.5s | **$80. Or $260. Same dead battery, same car.** |
| 2.5–6.5s | Walmart $80–155 · Parts chain $135–200 · Service center $185–260 · Dealer + $50–100 |
| 6.5–9.5s | None of them are lying. You just can't compare them. |
| 9.5–12.0s | We're fixing that in Montgomery County → **tuveloz.com** |

## Static / carousel version (ship this now)

Five cards, brand navy on brand black, orange numerals:

1. **$80. Or $260. Same dead battery, same car.** (hero still behind, dimmed)
2. Walmart $80–$155 · Parts chain $135–$200 (free install w/ purchase)
3. Service center $185–$260 · Dealer: highest labor +$50–$100 install
4. Independents $40–$100/hr · Dealers $75–$150/hr · Metros like ours $130–$175/hr
5. **None of them are lying. You just can't see them side by side.**
   Tuveloz — Montgomery County, MD. Providers join free: tuveloz.com/join

---

## Captions

Ready to publish, one file per post, five hashtags each:
`../outreach/media/captions/ad-03-{ig,tiktok}-{en,es}.txt`

Instagram hard-capped hashtags at five per post in December 2025, so the 26-tag
block in the older `captions-ad03-copy-paste.txt` would now suppress this post's
reach rather than widen it. That file is flagged out of date; its body copy is
still current. Selection formula: `../outreach/media/captions/README.md`.

---

## Posting schedule (Eastern Time)

| Slot | Platform | Version |
|---|---|---|
| Tue 12:00 PM | Instagram Reel + Facebook (crosspost) | EN main cut / carousel |
| Tue 7:30 PM | TikTok | EN short cut |
| Wed 9:00 AM | TikTok | ES short cut |
| Wed 12:00 PM | Instagram + Facebook | ES |
| Wed 1:00 PM | X | EN, still + caption |
| Thu | Instagram Story | poll: "Ever gotten two quotes more than $100 apart?" |

Midday beats the 9 AM slot used for the recruitment reels — this one is aimed at
car owners on a lunch scroll, not at mechanics before the first job. After 2–3
posts, move to the account's own analytics peaks.

---

## Measurement (48h after each post)

Same bars as the recruitment reels, plus two specific to this format:

- **3-second hold rate ≥ 60%.** Under 40% means the `$80. Or $260.` hook needs
  rewriting — it is the whole ad.
- **Optimize completion rate**, not views.
- **Saves and shares are the primary metric here.** A price list that doesn't
  get saved has failed even if it reaches well. Target saves > likes.
- **Follower locality.** If Montgomery County isn't the top cluster in IG/TikTok
  audience insights, the automotive tags are pulling the wrong crowd — cut
  #CarTok and #Automotive and go local-only on the next post.
- Link taps → `/join` visits (`analytics_events`, visible at
  `/admin/analytics-funnel`) and actual applications.

If this reaches well and drives zero `/join` visits, that isn't a failure of the
creative — it means the reach is customer-side, which is what a launch-day
audience is for. Judge it on saves and local follower growth, and keep the
recruitment reels carrying the application number.

---

## Honesty rules (carried from `../social-media-kit/profile-copy.md`)

- Never imply customers can book or pay today. The ad says "we're building" and
  "not live yet" — keep it.
- The prices are **published national 2026 ranges**, disclosed as such in the
  caption. Never present them as local quotes we collected.
- Never accuse any shop or chain of dishonesty. "None of them are lying" is the
  thesis and it is load-bearing — it is also what keeps this legally clean.
- Launch services only (battery/jump start, detailing, wipers, fluids,
  diagnostics). No towing, tires, or A/C.
- Providers keep 100% of what they quote; customers pay the 5% site fee. Never
  say "keep 95%".
- AI-content label ON.

---

## Sources

Trend read:
- https://newengen.com/insights/instagram-trends/
- https://sproutsocial.com/insights/social-media-trends/
- https://www.superside.com/blog/short-form-video-trends
- https://www.kapwing.com/resources/short-form-video-statistics-tiktok-reels-and-shorts-by-the-numbers-in-2026/
- https://en.wikipedia.org/wiki/Salary_Transparent_Street
- https://www.fastcompany.com/91014708/why-pay-transparency-is-going-viral-on-tiktok-according-to-salary-transparent-streets-hannah-williams
- https://saudiauto.com.sa/en/cartok-success-secrets/

Prices and labor rates:
- https://carserviceland.com/car-battery-replacement-cost/
- https://www.ecostify.com/blog/car-battery-replacement-cost
- https://ismycarcooked.com/blog/car-battery-replacement-cost-2025-2026-what-youll-actually-pay/
- https://repairpal.com/estimator/battery-replacement-cost
- https://www.cbac.com/longmont/media-center/blog/2026/january/why-auto-repair-prices-vary-so-much-and-how-to-a/
- https://www.kwikkarspringvalley.com/automotive-insights/why-repair-estimates-vary-by-shop-a-2026-guide
