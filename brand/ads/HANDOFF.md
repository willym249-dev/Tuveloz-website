# Ad production handoff — status as of 2026-08-06

**AD 01 IS DONE AND POSTABLE.** `ad-01-9x16.mp4` and `ad-01-1x1.mp4` are
finished renders with music — verified 2026-08-06, both carry an `avc1` video
track and an `mp4a` audio track. Any earlier note in this file calling them
silent placeholder drafts was stale. Download and post; nothing else is
needed to ship them.

Plan (verified on artlist.io/account/plan-and-billings, logged in as
hello@tuveloz.com): **AI Starter / AI Suite $19.99/mo**, NOT Max. Stock
catalog assets are **NOT licensed** — music/footage downloads come out
watermarked, WAV is paywalled.

**Credits: 140 left of 16,500, renewing 2026-09-04** (checked 2026-08-06).
This is not a typo and it is not the 15,960 this file used to claim — the
month is effectively spent. Treat every generation as the last one: no
retries, no exploratory prompts, images and image-to-video over text-to-video.
Ask Wil before spending anything.

The Artlist MCP connector **is** available in Claude Code sessions (verified
2026-08-06) — generation, status, and balance calls all work. An earlier note
here said otherwise; that was wrong.

## Blockers needing Wil (as of 2026-08-06)

1. **Posting is not automatable from a Claude Code web session.**
   `graph.facebook.com` is refused by the sandbox network policy (gateway
   answers 403 to CONNECT), and no Meta access token exists anywhere in this
   repo. Meta/Instagram publishing is a manual upload by Wil until both are
   fixed. Do not promise automated posting.
2. **Artlist asset downloads are blocked the same way.**
   `cms-toolkit-artifacts.artlist.io` and `mcp.artlist.io` are also 403'd by
   the network policy. Consequence: a session can *generate* through the MCP
   connector but cannot pull the finished file into
   `brand/ads/ad-01-assets/`. Wil must download generated assets manually.
   Allowlisting these three hosts is done per-environment at
   https://claude.ai/code (Environments → network access), not in this repo.
3. (Standing limitation) Claude's Chrome extension is hard-blocked on
   `toolkit.artlist.io` — no approval prompt ever appears, even with Chrome
   site access "On all sites". Ad 01 assets were pulled manually by Wil 8/4;
   any future toolkit generation/download also needs to be manual.
4. **PUBLISH WINDOW CLOSES 2026-08-09 (3 days out).** The music in both cuts
   is "On My Way (Instrumental Version)" by Ten Towers, licensed under an
   Epidemic Sound Pro plan that is **canceled and ends Aug 9**. Epidemic's
   license generally covers content published *while the subscription is
   active*. Post Ad 01 before Aug 9 or reactivate the plan before running it
   as a paid ad.

(Citadel is closed out — the watermarked `Ardie Son - Citadel.mp3` was
abandoned in favor of the Epidemic track. No action needed.)

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

## Current task: POST Ad 01 (provider recruitment) — build is finished

Full spec: [provider-recruitment-ad-01.md](provider-recruitment-ad-01.md).
Ad 02 spec (customer launch, "The Rescue"): [breakdown-rescue-ad-02.md](breakdown-rescue-ad-02.md).

### Assets status
- ✅ All visuals downloaded and filed in `brand/ads/ad-01-assets/` as
  scene1.png (mechanic hands), scene2.png (microfiber wipe), scene3.png
  (jumper cables — cropped from right half of a split-frame download),
  scene4.mp4 (Kling aerial, generated by Wil 8/4).
- ✅ Ad 01 RENDERED WITH MUSIC (2026-08-04): `ad-01-9x16.mp4`, `ad-01-1x1.mp4`.
  Re-verified 2026-08-06: both files carry a real video track (`avc1`) and a
  real audio track (`mp4a`). These are the final cuts, not placeholders.
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
Missing files render as labeled placeholder slates. NOTE: the current
`ad-01-9x16.mp4` / `ad-01-1x1.mp4` are NOT placeholders — they are the final
music-backed renders (verified 2026-08-06). Re-running the script is only
needed if an input asset changes.

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
