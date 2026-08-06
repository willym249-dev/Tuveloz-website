# Ad production handoff — status as of 2026-08-06

## Update 2026-08-06 — Artlist MCP now works here, and credits are nearly out

Two things changed since the 08-04 notes below.

1. **The Artlist MCP connector IS available in Claude Code sessions now.** The
   standing limitation recorded further down is out of date — image and video
   generation ran end to end from a Claude Code session on 08-06. What is still
   blocked is the *network*: this environment's egress policy 403s
   `cms-toolkit-artifacts.artlist.io` and `mcp.artlist.io`, so generated media
   **cannot be downloaded into the repo from a session**. Generation is
   automated; filing the asset is still manual (Wil pulls the download URL).
2. **Credits are nearly exhausted: 140 left of 16,500**, renewing 2026-09-04.
   The cheapest image-to-video run costs 280, so **no further video generation
   is possible until renewal or a top-up.** Text-to-image ran 100 credits.

Cost note for the next session: image-to-video models silently default to
`aspect_ratio: 16:9`. Pass `aspect_ratio`, `resolution` and `duration`
explicitly on every call — a vertical generation that comes back landscape is a
full-price mistake, which is exactly how Ad 03's motion pass was lost.

### Ad 03 (price transparency, broad reach) — NEW
Spec: [price-spread-ad-03.md](price-spread-ad-03.md).
Captions: `../outreach/media/captions-ad03-copy-paste.txt`.
- ✅ Hero still generated (Seedream 5.0, 9:16, 2K) — the primary asset, ships
  as a static/carousel post as-is.
- ⚠ Vertical motion pass NOT done — came back 16:9 480p and credits ran out.
  The exact prompt and the settings to force are in the spec.
- ⬜ Neither asset is filed in `ad-03-assets/` yet — blocked on the egress
  policy above.

---

# Original handoff — status as of 2026-08-04 (updated same day)

CORRECTION (verified on artlist.io/account/plan-and-billings, logged in as
hello@tuveloz.com): the plan is **AI Starter / AI Suite $19.99/mo**, NOT Max.
AI credits work (15,960/16,500 remaining) but **stock catalog assets are NOT
licensed** — music/footage downloads come out watermarked, WAV is paywalled.
The Artlist MCP connector exists only on claude.ai; it is NOT available in
Claude Code sessions. Minimize credits: images and image-to-video over
text-to-video; one-shot prompts, no retries.

## Blockers needing Wil (as of 2026-08-04)

1. (Standing limitation) Claude's Chrome extension is hard-blocked on
   `toolkit.artlist.io` — no approval prompt ever appears, even with Chrome
   site access "On all sites". Ad 01 assets were pulled manually by Wil 8/4;
   any future toolkit generation/download also needs to be manual.
2. Citadel: `Ardie Son - Citadel.mp3` in Downloads is the WATERMARKED preview
   (plan has no stock license). Options: (a) upgrade to Max, (b) pick a track
   from Epidemic Sound (see below), (c) ship draft with watermark for internal
   review only.

## Epidemic Sound status (verified 2026-08-04, logged-in Chrome session)

- A **Pro subscription EXISTS** ($42.39/mo, 250,000 credits, includes
  "Licensing for digital ads") but is **CANCELED — plan ends Aug 9, 2026**.
  Receipt dated 2026-08-03 (subscribed then canceled next day).
- URGENT WINDOW: pick + download a track before Aug 9, or reactivate.
  Caveat to verify: Epidemic licensing generally covers content *published
  while the subscription is active* — an ad launched after Aug 9 may need the
  plan reactivated. Confirm on their license terms before running paid ads
  post-cancellation.
- The Epidemic Sound Hub app is installed
  (`%LOCALAPPDATA%\Programs\Epidemic Sound Hub`) but has never been run
  (no app data). The website session in Chrome is logged in and sufficient.
- "Citadel" (Ardie Son) is Artlist-only. Closest-vibe Epidemic shortlist
  (search "uplifting cinematic acoustic warm", sorted by 15s-segment
  popularity — preview and pick one):
  1. Outside Your Reach (Instr.) — Victor Lundberg, 60 BPM —
     epidemicsound.com/music/tracks/8eed52a6-7ee0-4ed6-af2b-ba47708f53a0/
  2. A Nomad's Journey — Victor Lundberg, 108 BPM —
     epidemicsound.com/music/tracks/87fb95d8-e574-4b84-9b02-2777e903ff4c/
  3. On My Way (Instr.) — Ten Towers, 137 BPM —
     epidemicsound.com/music/tracks/a431a01d-ada6-4ddf-b837-a37aef56fe6a/
  4. For You (Instr.) — Victor Lundberg, 112 BPM —
     epidemicsound.com/music/tracks/b95de993-0fd1-414b-a0fe-78a2c9e93e4e/
  5. Rivers — Victor Lundberg —
     epidemicsound.com/music/tracks/b976d68b-f919-49ea-a0a0-65274549be06/
- Once a track is chosen and downloaded: save as
  `brand/ads/ad-01-assets/music.mp3`, re-run `build-ad-01.ps1`.

## Current task: build Ad 01 (provider recruitment)

Full spec: [provider-recruitment-ad-01.md](provider-recruitment-ad-01.md).
Ad 02 spec (customer launch, "The Rescue"): [breakdown-rescue-ad-02.md](breakdown-rescue-ad-02.md).

### Assets status
- ✅ All visuals downloaded and filed in `brand/ads/ad-01-assets/` as
  scene1.png (mechanic hands), scene2.png (microfiber wipe), scene3.png
  (jumper cables — cropped from right half of a split-frame download),
  scene4.mp4 (Kling aerial, generated by Wil 8/4).
- ✅ Ad 01 RENDERED WITH MUSIC (2026-08-04): `ad-01-9x16.mp4`, `ad-01-1x1.mp4`.
- ✅ Music: RESOLVED. "On My Way (Instrumental Version)" by Ten Towers,
  downloaded 8/4 from Epidemic Sound (Pro plan, logged-in session, Wil
  approved) and saved as `brand/ads/ad-01-assets/music.mp3`. Original file:
  `Downloads\ES_On My Way (Instrumental Version) - Ten Towers.mp3` — keep as
  the license artifact. "Citadel" (Artlist) abandoned — would need Max Pro.
  ⚠ PUBLISH WINDOW: Epidemic's own UI says "6 more days to use this track"
  (through Aug 9, 2026). Publish the ad before then or reactivate the
  subscription.

### Video prompt (approved)
Cinematic aerial drone shot slowly following a car driving down a sunny
suburban tree-lined road, golden hour warm light, smooth camera movement,
photorealistic, shallow depth of field, American neighborhood with houses and
green lawns, vertical 9:16, no text, no logos

### Assembly pipeline (DONE 2026-08-04 — draft rendered)
`brand/ads/build-ad-01.ps1` renders both formats end-to-end (ffmpeg 8.1.2
installed via winget). Drop assets into `brand/ads/ad-01-assets/` as
`scene1.*` (mechanic) / `scene2.*` (detailing) / `scene3.*` (jumper cables) /
`scene4.*` (aerial video or 4th image) / `music.mp3`, re-run the script, done.
Missing files render as labeled placeholder slates — current
`ad-01-9x16.mp4` / `ad-01-1x1.mp4` are placeholder drafts (captions + branded
end card verified, no music).

### Assembly plan (no credits — local edit)
15s vertical: hook "Tired of working somebody else's route?" → 3 images with
Ken Burns motion (+ aerial video if available) → "Set your own prices." /
"Pick your own jobs." / "Keep 100% of your price. Join free." (fee is
customer-side 5% per Section 7 sign-off — providers keep their full quote;
NEVER say "keep 95%") → logo end card
(brand/tuveloz-lockup-horizontal.svg + Tuveloz Logo.png), tuveloz.com/join,
"Customer choice. Provider freedom." Citadel under it all, captions burned in.
Export 1080x1920 (Reels/TikTok/Shorts) + 1080x1080 (feed).
Assets folder: brand/ads/ad-01-assets/ (create; pull files from Downloads).

### Rules (from brand/social-media-kit/profile-copy.md)
- Pre-launch: provider messaging only; never imply customers can book today.
- Launch services only (battery/jump start, detailing, wipers, fluids,
  diagnostics) — no towing/tires/AC.
- Hashtag sets + captions were drafted in prior session; local + niche mix,
  e.g. #MobileMechanic #MontgomeryCountyMD #BeYourOwnBoss #SideHustle #DMV.
