#!/usr/bin/env python3
"""Build Ad 03 - "Same Battery. Four Prices." (price transparency).

    python3 brand/ads/build-ad-03.py

Uses NO Artlist credits and NO licensed music. Every frame comes from footage
already committed to this repo:

    brand/outreach/media/tuveloz-reel-deadbattery-v2.mp4   hook bed
    brand/outreach/media/tuveloz-reel-mechanic.mp4         the turn
    brand/social-media-kit/Tuveloz Logo.png                end card

Text is rendered to transparent PNGs with Pillow rather than through ffmpeg's
drawtext filter. Two reasons: drawtext needs an ffmpeg built with libfreetype,
which the portable/pip builds are not, and the PNGs double as a **DaVinci
Resolve-ready overlay set** - they land in ad-03-assets/cards/ at full 1080x1920
with alpha, so the whole ad can be rebuilt on a Resolve timeline without
re-typesetting anything.

Requires: ffmpeg (any build), Pillow. Companion to build-ad-01.ps1.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ADS = ROOT / "brand" / "ads"
MEDIA = ROOT / "brand" / "outreach" / "media"
ASSETS = ADS / "ad-03-assets"
CARDS = ASSETS / "cards"
WORK = ASSETS / "_work"

BED = MEDIA / "tuveloz-reel-deadbattery-v2.mp4"
TURN = MEDIA / "tuveloz-reel-mechanic.mp4"
LOGO = ROOT / "brand" / "social-media-kit" / "Tuveloz Logo.png"

# Brand palette - brand/social-media-kit/README.md
ORANGE = (255, 106, 0, 255)
NAVY = (7, 24, 45, 255)
BLACK = (5, 5, 5, 255)
WHITE = (255, 255, 255, 255)

W, H, FPS = 1080, 1920, 30
FONT_PATH = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

FF = shutil.which("ffmpeg") or "ffmpeg"


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_PATH, size)


def text_block(
    draw: ImageDraw.ImageDraw,
    lines: list[str],
    size: int,
    color,
    center_y: int,
    line_gap: float = 1.28,
    shadow: bool = False,
) -> tuple[int, int]:
    """Draw centred lines around center_y. Returns (top, bottom) of the block."""
    f = font(size)
    step = int(size * line_gap)
    total = step * len(lines)
    y = center_y - total // 2
    top = y
    for line in lines:
        w = draw.textlength(line, font=f)
        x = (W - w) / 2
        if shadow:
            for dx, dy in ((-3, 0), (3, 0), (0, -3), (0, 3), (3, 3), (-3, -3)):
                draw.text((x + dx, y + dy), line, font=f, fill=(0, 0, 0, 235))
        draw.text((x, y), line, font=f, fill=color)
        y += step
    return top, y


def overlay_card(name: str, lines: list[str], size: int, center_y: int, scrim=True) -> Path:
    """Transparent overlay for burning over footage, with a soft dark scrim."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if scrim:
        probe = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        top, bottom = text_block(ImageDraw.Draw(probe), lines, size, WHITE, center_y)
        pad = int(size * 0.55)
        band = Image.new("RGBA", (W, bottom - top + pad * 2), (5, 5, 5, 120))
        img.alpha_composite(band, (0, max(0, top - pad)))
    text_block(draw, lines, size, WHITE, center_y, shadow=True)
    out = CARDS / f"{name}.png"
    img.save(out)
    return out


def price_card(name: str, label: str, amount: str, note: list[str]) -> Path:
    """Full-bleed navy card: white label, huge orange number, muted note."""
    img = Image.new("RGBA", (W, H), NAVY)
    draw = ImageDraw.Draw(img)
    text_block(draw, [label], 64, WHITE, int(H * 0.40))
    text_block(draw, [amount], 148, ORANGE, int(H * 0.50))
    if note:
        text_block(draw, note, 44, (255, 255, 255, 190), int(H * 0.60))
    out = CARDS / f"{name}.png"
    img.save(out)
    return out


def statement_card(name: str, lines: list[str], size: int, accents: set[int] = frozenset()) -> Path:
    """Full-bleed navy card of plain statement text; accents index orange lines."""
    img = Image.new("RGBA", (W, H), NAVY)
    draw = ImageDraw.Draw(img)
    step = int(size * 1.34)
    y = H // 2 - (step * len(lines)) // 2
    for i, line in enumerate(lines):
        f = font(size)
        w = draw.textlength(line, font=f)
        draw.text(((W - w) / 2, y), line, font=f, fill=ORANGE if i in accents else WHITE)
        y += step
    out = CARDS / f"{name}.png"
    img.save(out)
    return out


def end_card(name: str, url: str) -> Path:
    """Logo + URL, matching the geometry in build-ad-01.ps1."""
    img = Image.new("RGBA", (W, H), BLACK)
    logo = Image.open(LOGO).convert("RGBA")
    logo_w = int(W * 0.76)
    logo_h = int(logo_w * logo.height / logo.width)
    logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
    url_size = int(W * 0.058)
    gap = int(H * 0.055)
    logo_y = (H - (logo_h + gap + url_size)) // 2
    img.alpha_composite(logo, ((W - logo_w) // 2, logo_y))
    draw = ImageDraw.Draw(img)
    f = font(url_size)
    draw.text(((W - draw.textlength(url, font=f)) / 2, logo_y + logo_h + gap),
              url, font=f, fill=ORANGE)
    out = CARDS / f"{name}.png"
    img.save(out)
    return out


def run(args: list[str]) -> None:
    proc = subprocess.run([FF, "-v", "error", "-y", *args], capture_output=True, text=True)
    if proc.returncode != 0:
        sys.exit(f"ffmpeg failed:\n{proc.stderr}")


def seg_footage(out: str, src: Path, ss: float, dur: float, card: Path) -> Path:
    """Footage segment with a transparent overlay burned in."""
    dst = WORK / out
    run(["-ss", str(ss), "-t", str(dur), "-i", str(src), "-i", str(card),
         "-filter_complex",
         f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,"
         f"crop={W}:{H},setsar=1[v];[v][1:v]overlay=0:0",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), "-an", str(dst)])
    return dst


def seg_still(out: str, card: Path, dur: float, fade: float = 0.25) -> Path:
    dst = WORK / out
    run(["-loop", "1", "-t", str(dur), "-i", str(card),
         "-vf", f"scale={W}:{H},setsar=1,fade=t=in:st=0:d={fade}",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), "-an", str(dst)])
    return dst


def concat(out: Path, parts: list[Path]) -> None:
    listing = WORK / f"concat-{out.stem}.txt"
    listing.write_text("".join(f"file '{p}'\n" for p in parts))
    run(["-f", "concat", "-safe", "0", "-i", str(listing),
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS), "-an", str(out)])


def main() -> None:
    for path in (BED, TURN, LOGO):
        if not path.exists():
            sys.exit(f"Missing asset: {path}")
    if not Path(FONT_PATH).exists():
        sys.exit(f"Font not found: {FONT_PATH}")

    CARDS.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)

    # ---- overlay + card set (also the Resolve-ready export) ----------------
    c_hook = overlay_card("01-hook", ["$80. Or $260.", "Same dead battery,", "same car."],
                          96, int(H * 0.22))
    c_setup = overlay_card("02-setup", ["Nobody's lying to you.", "Here's the actual spread."],
                           62, int(H * 0.78))
    c_walmart = price_card("03-walmart", "Walmart", "$80-$155", [])
    c_chain = price_card("04-parts-chain", "Parts chain", "$135-$200",
                         ["Install free if you buy the battery there"])
    c_service = price_card("05-service-center", "Tire / service center", "$185-$260", [])
    c_dealer = price_card("06-dealership", "Dealership", "+$50-$100",
                          ["On top of the highest labor rate.",
                           "Some cars need the new battery",
                           "registered with a scan tool."])
    c_labor = statement_card("07-labor-rates",
                             ["Independents bill", "$40-$100 / hr", "",
                              "Dealers bill", "$75-$150 / hr", "",
                              "In metros like ours", "$130-$175 / hr"],
                             68, accents={1, 4, 7})
    c_turn = overlay_card("08-turn", ["None of them are lying.",
                                      "You just can't see them", "side by side."],
                          66, int(H * 0.72))
    c_cta = statement_card("09-cta", ["So we're building that", "for Montgomery County.", "",
                                      "Mechanics and mobile pros,", "join free."], 66)
    c_end = end_card("10-end-card", "tuveloz.com/join")
    c_short_prices = statement_card("11-short-prices",
                                    ["Walmart          $80-$155",
                                     "Parts chain     $135-$200",
                                     "Service ctr     $185-$260",
                                     "Dealership       +$50-$100"], 60)
    c_short_turn = overlay_card("12-short-turn",
                                ["None of them are lying.", "You just can't", "compare them."],
                                64, int(H * 0.72))
    c_short_end = end_card("13-short-end-card", "tuveloz.com")

    # ---- main cut, ~39s ---------------------------------------------------
    # Long on purpose: 60-90s micro-learning is out-performing 15s clips in
    # 2026, and the price list is what earns the save. See price-spread-ad-03.md.
    print("Building main cut...")
    main_parts = [
        seg_footage("m01.mp4", BED, 0, 5, c_hook),
        seg_footage("m02.mp4", BED, 5, 3, c_setup),
        seg_still("m03.mp4", c_walmart, 4),
        seg_still("m04.mp4", c_chain, 4),
        seg_still("m05.mp4", c_service, 4),
        seg_still("m06.mp4", c_dealer, 5),
        seg_still("m07.mp4", c_labor, 5),
        seg_footage("m08.mp4", TURN, 1, 5, c_turn),
        seg_still("m09.mp4", c_cta, 4),
        seg_still("m10.mp4", c_end, 4, fade=0.4),
    ]
    concat(ADS / "ad-03-9x16.mp4", main_parts)

    # ---- short cut, ~14s --------------------------------------------------
    # TikTok cold reach, where a new account has no watch history to lean on.
    print("Building short cut...")
    short_parts = [
        seg_footage("s01.mp4", BED, 0, 4, c_hook),
        seg_still("s02.mp4", c_short_prices, 4),
        seg_footage("s03.mp4", TURN, 1, 3, c_short_turn),
        seg_still("s04.mp4", c_short_end, 3, fade=0.4),
    ]
    concat(ADS / "ad-03-short-9x16.mp4", short_parts)

    shutil.rmtree(WORK, ignore_errors=True)

    print(f"""
Built:
  {ADS / 'ad-03-9x16.mp4'}          main cut
  {ADS / 'ad-03-short-9x16.mp4'}    TikTok cut
  {CARDS}/   {len(list(CARDS.glob('*.png')))} overlay PNGs, 1080x1920 with alpha

Both outputs are SILENT on purpose. Feed video is watched muted and this ad is
text-driven, so silence costs it nothing - and it keeps an evergreen post clear
of the Epidemic Sound licensing window, which only covers content published
while that subscription is active (see HANDOFF.md). Add a track natively in the
Instagram/TikTok editor, which also attaches the post to a trending audio.

DaVinci Resolve rebuild: import cards/ as a stills bin over the two source
reels. Every PNG is full-frame 1080x1920 with alpha, so they drop straight onto
V2 above the footage in the order they are numbered - no re-typesetting.

To mux a licensed track instead:
  ffmpeg -i ad-03-9x16.mp4 -i music.mp3 -map 0:v -map 1:a \\
    -af 'afade=t=out:st=37:d=2' -c:v copy -c:a aac -b:a 192k -shortest out.mp4
""")


if __name__ == "__main__":
    main()
