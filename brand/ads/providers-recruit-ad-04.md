# Ad 04 — provider recruitment, text-driven cut

- **Status:** finished — ready to post
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-07

**Files:** `tuveloz-providers-recruit.mp4` (English) and
`tuveloz-proveedores-es.mp4` (Spanish) — 9.5s each, 1080×1920, H.264 High,
yuv420p, AAC, faststart. Post to Instagram Reels and TikTok as-is, as two
separate posts rather than one bilingual post.

Captions, the 5-hashtag sets, and the posting checklist are in
`../outreach/media/captions-ad-04-copy-paste.txt`.

Built entirely from code — Chromium renders the four frames from
`ad-04-assets/build-frames.html`, ffmpeg adds a slow push and crossfades.

**Branding comes from the masters, not from a redraw.** The badge SVG in
`build-frames.html` is copied verbatim from `brand/tuveloz-icon.svg`, and the
lockup matches `brand/tuveloz-lockup-horizontal.svg` — badge, "Tuveloz" in
orange, tagline in orange. Palette is badge orange `#FF6A00` and brand navy
`#07182D` grading into brand black `#050505`, per
`brand/social-media-kit/README.md`. The first cut typed the wordmark out as
plain text, which breaks that README's rule that the logo is never hand-drawn;
if you edit these frames, keep the badge markup in sync with the icon master
rather than adjusting it by eye. **No
AI-generated footage, so no AI-content label is needed**, and no stock music, so
the licensing situation in `HANDOFF.md` does not apply. Zero generation credits.

This exists because ad 03 stalled: the Artlist balance was down to 10 credits
and the image-to-video pass was unaffordable (see `tuesday-reel-ad-03.md`). It
is not a downgrade — text-driven, subtitle-style storytelling is one of the
formats indexing well this month, and it needs no licensed audio.

## The four frames

1. **"You already do the work. Now get found."** — the hook, straight from the
   provider pitch in `docs/PITCH.md` §3.
2. **What you get** — free to join, you set your prices and keep 100% of what
   you quote, no exclusivity, you pick the jobs. Every line is a shared fact
   from the pitch; none of them are new claims.
3. **"We're not open to customers yet. On purpose."** — the honesty beat. A
   marketplace where you post a job and nobody answers is worse than no
   marketplace, so providers get signed up first.
4. **"Your wrench. Your rules."** — one of the headline variants already under
   test, plus the CTA.

The "100% of what you quote" line is deliberate. Never phrase it as "providers
keep 95%" — the 5% customer service fee sits on top of the quote and is paid by
the customer, so it is not a cut of the provider's price.

## Posting

- Captions and hashtags: `../outreach/media/captions-ad-04-copy-paste.txt`.
  **Do not reuse the 30-tag block from `captions-v3-copy-paste.txt`** —
  Instagram now caps hashtags at 5 per post (rolled out late 2025 into 2026)
  and has said outright that hashtags do not drive reach; it removed hashtag
  following in Dec 2024. Five specific, local tags per platform.
- **Do not** add TikTok's own text overlays on top; the frames already carry the
  copy. Upload natively to each platform, never export from one and re-upload to
  the other — a watermark tanks Reels reach.
- Geotag a specific MoCo town, not "Maryland".
- Tag the link `tuveloz.com/join?src=recruit-04` so the funnel at
  `/admin/analytics-funnel` can attribute applications to it.

## Rebuilding or editing

Edit the copy in `ad-04-assets/build-frames.html` (each frame is one entry in
the `FRAMES` object), then:

```bash
# 1. render the frames
for f in f1 f2 f3 f4; do
  chrome --headless=new --no-sandbox --hide-scrollbars \
    --force-device-scale-factor=1 --window-size=1080,1920 \
    --screenshot=$f.png "file://$PWD/build-frames.html?f=$f"
done

# 2. one clip per frame, slow push
for i in 1 2 3 4; do
  ffmpeg -y -loop 1 -i f$i.png -t 2.7 -filter_complex \
    "scale=2160:3840,zoompan=z='min(zoom+0.0006,1.09)':d=81:\
x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,format=yuv420p" \
    -c:v libx264 -preset medium -crf 18 -r 30 c$i.mp4
done

# 3. crossfade into the final cut
ffmpeg -y -i c1.mp4 -i c2.mp4 -i c3.mp4 -i c4.mp4 \
  -f lavfi -t 10 -i anullsrc=channel_layout=stereo:sample_rate=44100 \
  -filter_complex "[0][1]xfade=transition=fade:duration=0.45:offset=2.25[a];\
[a][2]xfade=transition=fade:duration=0.45:offset=4.5[b];\
[b][3]xfade=transition=fade:duration=0.45:offset=6.75[v]" \
  -map "[v]" -map 4:a -shortest -c:v libx264 -preset slow -crf 19 \
  -pix_fmt yuv420p -profile:v high -level 4.0 -movflags +faststart \
  -c:a aac -b:a 128k tuveloz-providers-recruit.mp4
```

Note: the ffmpeg bundled with Playwright is a stripped build (VP8/WebM only, no
H.264, no `zoompan` or `xfade`). Use a full build — `npm i ffmpeg-static` gets
one without a system install.

Both language sets live in `build-frames.html`; append `&lang=es` to the query
string to render the Spanish frames.

## Still worth doing

The AI hero frame generated for ad 03 would make a far better background than
the gradient. It could not be pulled into the repo from a session because the
network policy denies `artlist.io` hosts — download it manually into
`ad-04-assets/` and these frames can be re-rendered over it.

When a real provider volunteers, a spotlight of them beats this outright. See
`../outreach/provider-spotlight-kit.md`.
