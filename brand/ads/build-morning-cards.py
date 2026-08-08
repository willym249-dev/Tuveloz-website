#!/usr/bin/env python3
"""Render the Morning Number stat cards from morning-ads-provider-recruitment.md.

Every card is text on the brand background plus the Tuveloz lockup — no stock
footage, no music, so nothing here depends on the Epidemic Sound licence.

    pip install Pillow
    python3 brand/ads/build-morning-cards.py

Writes 1080x1920 (Reels/TikTok/Shorts) and 1080x1080 (feed) PNGs into
brand/ads/morning-cards/. Re-running overwrites them.

Copy is the source of truth in morning-ads-provider-recruitment.md §5. Change it
there first, then here — and check §6 before changing a word of it. In
particular the fee is a *proposed* 5%, so these cards say "small service fee".
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent / "morning-cards"
LOGO = Path(__file__).parent.parent / "social-media-kit" / "Tuveloz Logo.png"

# brand/SALES_PITCH.md §15
BLACK = "#050505"
ORANGE = "#FF6A00"
NAVY = "#07182D"
WHITE = "#F7F7F7"
GREY = "#8A8A8A"

BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
BOOK = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# id, lang, number, context (<=10 words), counter-fact, source
CARDS = [
    ("M1", "en", "$15–$85",
     "What other platforms charge a pro for one lead —\nshared with up to 7 other pros.",
     "Tuveloz charges providers nothing.\nNot per lead. Not per month.",
     "Source: 2026 Angi / Thumbtack contractor cost surveys"),
    ("M1", "es", "$15–$85",
     "Lo que otras plataformas le cobran por un solo\ncontacto — compartido con hasta 7 más.",
     "Tuveloz no le cobra nada al proveedor.\nNi por contacto, ni al mes.",
     "Fuente: encuestas de costos Angi / Thumbtack, 2026"),

    ("M2", "en", "12.8 years",
     "The average car on the road is older\nthan it has ever been.",
     "They all need somebody. Montgomery County\nis signing up providers now.",
     "Source: S&P Global Mobility, 2025"),
    ("M2", "es", "12.8 años",
     "El carro promedio en la calle nunca\nhabía sido tan viejo.",
     "Todos necesitan a alguien. El Condado de\nMontgomery inscribe proveedores ahora.",
     "Fuente: S&P Global Mobility, 2025"),

    ("M3", "en", "42%",
     "The share of the country's demand for techs\nthat training programs actually fill.",
     "You're not competing for a spot.\nYou're the scarce part.",
     "Source: TechForce Foundation Supply & Demand Report, 2026"),
    ("M3", "es", "42%",
     "La parte de la demanda nacional de técnicos\nque los programas alcanzan a cubrir.",
     "Usted no compite por un lugar.\nUsted es lo escaso.",
     "Fuente: TechForce Foundation, informe 2026"),

    ("M4", "en", "+4.9%",
     "Car repair prices, this year alone.\n+43.6% since 2019.",
     "Customers are shopping harder than ever.\nTuveloz is where they compare quotes.",
     "Source: BLS Consumer Price Index, vehicle maintenance & repair"),
    ("M4", "es", "+4.9%",
     "El precio de la reparación automotriz,\nsolo este año. +43.6% desde 2019.",
     "Los clientes comparan más que nunca.\nTuveloz es donde comparan cotizaciones.",
     "Fuente: Índice de Precios al Consumidor (BLS)"),

    ("M5", "en", "76%",
     "of independent workers now call it\na career, not a stopgap.",
     "Then it should come with terms you set.\nYour prices. Your schedule.",
     "Source: Quicken / MBO Partners independent-workforce data, 2025–26"),
    ("M5", "es", "76%",
     "de los trabajadores independientes ya lo\nconsideran una carrera, no algo temporal.",
     "Entonces debería tener condiciones que\nusted pone. Sus precios. Su horario.",
     "Fuente: Quicken / MBO Partners, 2025–26"),

    ("M7", "en", "$0",
     "What a chargeback costs you on Tuveloz.",
     "The platform absorbs processing fees and\nchargeback losses. Not taken from your payout.",
     "Source: Stripe Connect configuration, lib/stripe-provider.ts"),
    ("M7", "es", "$0",
     "Lo que le cuesta un contracargo en Tuveloz.",
     "La plataforma absorbe las comisiones y las\npérdidas por contracargos. No de su pago.",
     "Fuente: configuración de Stripe Connect"),

    ("M8", "en", "Labor only",
     "Quotes on Tuveloz are labor-only —\nthe customer buys the part.",
     "You never front the parts. No markup,\nno inventory, no wrong-part trip.",
     "Enforced server-side: LABOR_ONLY_QUOTE_REQUIRED"),
    ("M8", "es", "Solo mano\nde obra",
     "Las cotizaciones en Tuveloz son solo de\nmano de obra — el cliente compra la pieza.",
     "Usted nunca adelanta las piezas. Sin margen,\nsin inventario, sin viaje perdido.",
     "Verificado en el servidor"),
]

SIZES = {"9x16": (1080, 1920), "1x1": (1080, 1080)}


def fitted(text, font_path, start, max_width, draw, min_size=28):
    """Largest size at which the longest line still fits max_width."""
    size = start
    while size > min_size:
        font = ImageFont.truetype(font_path, size)
        widest = max(draw.textlength(line, font=font) for line in text.split("\n"))
        if widest <= max_width:
            return font
        size -= 4
    return ImageFont.truetype(font_path, min_size)


def block(draw, text, font, x, y, fill, spacing, anchor="la"):
    for line in text.split("\n"):
        draw.text((x, y), line, font=font, fill=fill, anchor=anchor)
        y += font.size + spacing
    return y


def render(card, ratio, size):
    cid, lang, number, context, counter, source = card
    w, h = size
    tall = ratio == "9x16"
    margin = int(w * 0.085)
    inner = w - margin * 2

    img = Image.new("RGB", size, BLACK)
    d = ImageDraw.Draw(img)

    # Orange keyline down the left edge — ties the series together at a glance.
    d.rectangle([0, 0, int(w * 0.018), h], fill=ORANGE)

    num_font = fitted(number, BOLD, int(w * 0.30) if tall else int(w * 0.24),
                      inner, d, min_size=64)
    ctx_font = fitted(context, BOOK, int(w * 0.052), inner, d)
    cf_font = fitted(counter, BOLD, int(w * 0.050), inner - margin, d)

    def stack_h(text, font):
        n = text.count("\n") + 1
        return n * font.size + (n - 1) * int(font.size * 0.34)

    gap_num = int(h * (0.045 if tall else 0.035))
    gap_ctx = int(h * (0.055 if tall else 0.05))
    cf_lines = counter.count("\n") + 1
    pad = margin // 2
    panel_h = (cf_lines * cf_font.size + (cf_lines - 1) * int(cf_font.size * 0.34)
               + pad * 2)

    # Measure the whole block, then centre it in the space above the footer, so a
    # short card doesn't leave a dead band through the middle of the frame.
    content_h = (stack_h(number, num_font) + gap_num + stack_h(context, ctx_font)
                 + gap_ctx + panel_h)
    top_limit = int(h * 0.10)
    bottom_limit = h - int(h * (0.20 if tall else 0.24))
    y = max(top_limit, top_limit + ((bottom_limit - top_limit) - content_h) // 2)

    y = block(d, number, num_font, margin, y, ORANGE, int(num_font.size * 0.06))
    y += gap_num
    y = block(d, context, ctx_font, margin, y, WHITE, int(ctx_font.size * 0.34))

    # Counter-fact sits on a navy panel so it reads as the turn, not more body.
    # The panel is drawn from y downward — offsetting it upward would let it eat
    # the descenders of the context line above on the tighter square format.
    y += gap_ctx
    d.rounded_rectangle([margin - 24, y, w - margin + 24, y + panel_h],
                        radius=28, fill=NAVY)
    block(d, counter, cf_font, margin, y + pad, WHITE, int(cf_font.size * 0.34))

    # Footer: CTA, lockup, source line.
    foot = h - int(h * (0.11 if tall else 0.155))
    cta_font = ImageFont.truetype(BOLD, int(w * 0.055))
    d.text((margin, foot), "tuveloz.com/join", font=cta_font, fill=ORANGE)

    if LOGO.exists():
        logo = Image.open(LOGO).convert("RGBA")
        lw = int(w * 0.30)
        logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
        img.paste(logo, (w - margin - lw, foot - int(logo.height * 0.15)), logo)

    src_font = ImageFont.truetype(BOOK, int(w * 0.0235))
    d.text((margin, h - int(h * (0.05 if tall else 0.055))), source,
           font=src_font, fill=GREY)

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{cid.lower()}-{lang}-{ratio}.png"
    img.save(path, "PNG", optimize=True)
    return path


def main():
    made = []
    for card in CARDS:
        for ratio, size in SIZES.items():
            made.append(render(card, ratio, size))
    print(f"Wrote {len(made)} cards to {OUT}/")
    for p in made:
        print(" ", p.name)


if __name__ == "__main__":
    main()
