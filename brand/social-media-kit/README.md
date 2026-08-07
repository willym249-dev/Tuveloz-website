# Tuveloz Brand Kit (v3 — DEFINITIVE)

One unified mark everywhere: the Tuveloz badge — chunky funnel + detached drop in
orange (`#FF6A00`) inside a rounded square with orange keyline on brand **navy**
(`#07182D`). Master raster: `tuveloz-profile-master-1024.png` (this folder).
Master vector: [`brand/tuveloz-icon.svg`](../tuveloz-icon.svg).

**Every website icon and social image is generated from these masters — never
hand-pick or re-draw the logo.** To regenerate the site's favicon, app icons,
and og-image after any master change, run:

```bash
node scripts/generate-brand-assets.mjs
```

## Profile pictures (this folder)

Badge sits at 76% of canvas so circular crops never clip the keyline.

| File | Platform | Size |
|---|---|---|
| `tuveloz-profile-master-1024.png` | Master / any platform (incl. Gmail avatar for hello@tuveloz.com) | 1024×1024 |
| `tuveloz-profile-google-720.png` | Google Business Profile | 720×720 |
| `tuveloz-profile-facebook-720.png` | Facebook Page | 720×720 |
| `tuveloz-profile-x-twitter-400.png` | X (Twitter) | 400×400 |
| `tuveloz-profile-instagram-320.png` | Instagram | 320×320 |
| `tuveloz-profile-tiktok-1024.png` | TikTok | 1024×1024 |
| `preview-circular-crop.png` | Preview of circular display | 1024×1024 |

## Email signature (parent folder)

- `brand/tuveloz-lockup-email.png` — badge + "Tuveloz" + tagline, transparent
  background. Insert in email signatures at ~250px display width.
- `brand/tuveloz-lockup-horizontal.svg` — vector source for the lockup.

Tagline in use: **"Customer choice. Provider freedom."** — matches the website
title. Badge interior is brand navy (`#07182D`); page/canvas background stays
brand black (`#050505`).

## What the website serves (`public/`)

Every one of these is generated from the masters above. None of them is drawn,
cropped, or exported by hand.

| File | Where it shows up |
|---|---|
| `brand-badge.png` | The logo in the header and footer of every page, via `<BrandMark>` |
| `favicon.ico` | Browser tab (16/32/48) |
| `favicon.svg`, `tuveloz-favicon-v2.svg` | Browser tab, vector |
| `apple-touch-icon.png` | iOS home screen |
| `icon-192.png`, `icon-512.png` | Android / PWA install, listed in `manifest.webmanifest` |
| `og-image.png` | Link previews when the site is shared |

`brand-badge.png` is the badge trimmed right to its keyline, because the header
gives it its own spacing; the app icons keep their padding instead.

## Regenerating

Edit the masters here (or `brand/tuveloz-icon.svg` for the vector), then run
`node scripts/generate-brand-assets.mjs` to rebuild every file in the table
above. Bump the `?v=` query string in `app/layout.tsx` and
`public/manifest.webmanifest` after regenerating so cached copies stop being
served — keep every `?v=` on the same number.

Two tests in `tests/brand-mark-consistency.test.mjs` hold this together: one
fails if a page draws a logo any way other than `<BrandMark>`, and one fails if
the app starts referencing a logo file the generator does not produce. If you
add a new icon, add it to the generator — not to `public/` by hand.
