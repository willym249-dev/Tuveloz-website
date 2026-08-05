# Ad 03 — "Roadside Dusk" (6s clip, youth-oriented / b-roll)

Source: Wil's Artlist AI generation ("young woman waiting roadside"), captured
as a screen recording. Cleaned up by Claude — zero credits spent, all local
ffmpeg editing.

## What was done

- Cropped the browser/Artlist UI out of the screen recording, isolating the
  2.59:1 cinematic video content (1990x768).
- Removed player overlays baked into the recording: mute icons (bottom-left
  and a faint top-left badge), the Use/download buttons bottom-right, and the
  moving mouse cursor (template-tracked frame by frame, patched with delogo).
- Trimmed off the garbled AI logo ("TTUL/ TANIINI OIET") that fades in at
  ~3.9s over the close-up.
- Added a fade to black and a real Tuveloz end card (orange lockup from
  `brand/social-media-kit/Tuveloz Logo.png` + tuveloz.com), 2.4s hold.

## Files

| File | Format | Use |
|------|--------|-----|
| `ad-03-assets/tuveloz-roadside.mp4` | 1990x768 (2.59:1), 60fps, 6.3s, silent | Wide/cinematic master |
| `ad-03-assets/tuveloz-roadside-9x16.mp4` | 1080x1920, 60fps, 6.3s, silent | TikTok / Reels / Shorts |
| `ad-03-assets/endcard.png` | 1990x768 | Reusable wide end card |
| `ad-03-assets/endcard-9x16.png` | 1080x1920 | Reusable vertical end card |

## V2 — full ad cut (7.9s)

Story beats added on top of the cleaned footage: "Stuck?" hook over the wide
shot, "Post it on Tuveloz." over the phone close-up, then a 1.6s quote-compare
UI insert (mocked in brand style — `ui-insert.html` rendered with Chromium,
since the real post-job flow is launch-gated), then the end card.

| File | Notes |
|------|-------|
| `ad-03-assets/tuveloz-roadside-v2.mp4` | Wide, silent |
| `ad-03-assets/tuveloz-roadside-v2-9x16.mp4` | Vertical, silent |
| `ad-03-assets/tuveloz-roadside-v2-music.mp4` | Wide + Ad-01 music (fit unconfirmed) |
| `ad-03-assets/tuveloz-roadside-v2-9x16-music.mp4` | Vertical + Ad-01 music |
| `ad-03-assets/ui-insert.png` / `.html` | Quote-compare mock screen, editable |

UI insert shows sample quotes ($140/$185/$160, fictional provider names) —
swap copy in `ui-insert.html` and re-render if needed.

## Open items

- **Music**: both cuts are silent (the recording had no audio). Pick a track
  (moody/tense, resolves warm — the clip is a woman waiting by her car at
  dusk, checking her phone). Artlist search: `tense cinematic dusk` or
  `moody suspense resolve`.
- **Phase gate**: same as Ad 02 — if run pre-launch, swap end-card message to
  "Launching soon in Montgomery County, MD".
- Fits the "Text Thread" / breakdown-story youth concepts as b-roll: the
  phone-check close-up cuts naturally to a Tuveloz job-post UI insert.
