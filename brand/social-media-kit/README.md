# Tuveloz Brand Kit (v2)

One unified mark everywhere: the Tuveloz badge — chunky funnel + drop in orange
(`#FF6A00`) inside a rounded square with orange keyline on brand black (`#050505`).
Master vector: [`brand/tuveloz-icon.svg`](../tuveloz-icon.svg). The website favicon
(`public/tuveloz-favicon-v2.svg`) is the same badge, so site + socials + email match.

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
title. Badge background is brand black (`#050505`), same as the site theme.

## Regenerating

Edit `brand/tuveloz-icon.svg`, then re-run the build script (rasterizes the SVG
with sharp at each size and composites the avatar canvases).
