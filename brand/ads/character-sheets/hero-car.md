# TUV-CAR-01 — the hero car

Role: in every shot of Ad 02; the single most continuity-critical element.
A car that reads "everyday Montgomery County", not luxury, not junker.

## LOCKED BLOCK (paste verbatim into every prompt it appears in)

> A light steel-blue compact crossover SUV, recent model year but not
> brand-new, unbranded generic design, slightly dusty lower panels, dark
> gray plastic wheel-arch trim, silver 5-spoke alloy wheels, tinted rear
> windows, no visible badges, blurred illegible license plate,
> photorealistic, cinematic.

Why steel-blue: distinctive enough that a viewer tracks it across cuts,
common enough to stay relatable. Color is the continuity anchor — video
models hold a car's color far better than its exact body lines.

## What may NEVER change

- Steel-blue color (same saturation — beware golden-hour grading warming it
  toward teal; correct in the grade, not by regenerating)
- Compact crossover body type, silver alloys, tinted rear windows
- No badges, no readable plate

## What MAY vary per shot

- Dirt level slightly; hood open (shot 4 only) vs closed
- Hazard lights ON in shots 2–4, OFF elsewhere

## Reference set (generate once, then freeze)

1. `ref-front34.png` — front three-quarter, eye level
2. `ref-rear34.png` — rear three-quarter
3. `ref-profile.png` — full side profile
4. `ref-hood-open.png` — front, hood raised
5. `ref-aerial.png` — top-down aerial view on asphalt

All refs: neutral overcast light, empty asphalt background.
Register in Higgsfield as asset/character `TUV-CAR-01`.

## Negative prompt (append everywhere)

> no badges, no brand logos, no readable license plate, no roof rack, no
> stickers, not a sedan, not a pickup
