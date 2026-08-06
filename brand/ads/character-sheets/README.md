# Ad continuity system — character sheets

Why this exists: shots generated one-by-one drift — a different car, a
different driver, different light in every clip. To a viewer the story falls
apart. These sheets lock every recurring element ONCE so all shots pull from
the same canon.

## The two rules

1. **Never split a story.** One story = ONE master edit, published whole.
   Platform versions (16:9 / 9:16 / 1:1) are crops and trims of that single
   master render — never separately generated variants, never a story posted
   as "part 1 / part 2".
2. **Never free-prompt a recurring element.** If it appears in more than one
   shot, it has a sheet in this folder, and every generation uses that
   sheet's references + locked block. No exceptions, no "close enough".

## Higgsfield workflow (do this in order)

1. **Master references first.** For each sheet, generate the reference set
   described in its "Reference set" section (text-to-image, cheapest decent
   model). Get Wil's approval on the refs BEFORE any video is made.
2. **Freeze.** Approved refs are saved to
   `brand/ads/character-sheets/refs/<ELEMENT-ID>/` and committed. From then
   on they are canon — never regenerate a ref to "improve" it mid-project.
3. **Register in Higgsfield.** Create one named character/asset per sheet
   using its refs, named EXACTLY the element ID (e.g. `TUV-DRIVER-01`), so
   every prompt and every teammate points at the same thing.
4. **Every shot prompt = locked blocks + action.** Paste the LOCKED BLOCK of
   each element in the shot, verbatim, then append only what changes: camera,
   action, beat. Never re-describe an element in your own words.
5. **Chain frames.** When two shots are continuous in story time, feed the
   last frame of shot N as the start frame of shot N+1 (Higgsfield
   start-frame / image-to-video). This carries light, grade, and geography
   across the cut for free.
6. **One world.** Every shot also carries the WORLD sheet's locked block
   (location + light + grade). Consistent light hides small character drift;
   inconsistent light exposes even perfect characters.

## Element index (Ad 02 — "The Rescue")

| ID | Sheet | Appears in shots |
|----|-------|------------------|
| TUV-DRIVER-01 | [driver.md](driver.md) | 2, 3, 5 (and 1/6 implied at the wheel) |
| TUV-CAR-01 | [hero-car.md](hero-car.md) | 1, 2, 3, 4, 5, 6 — every shot |
| TUV-PROVIDER-01 | [provider.md](provider.md) | 4, 5 |
| TUV-VAN-01 | [provider-van.md](provider-van.md) | 4, (background in 5) |
| TUV-WORLD-01 | [world.md](world.md) | all shots |
| TUV-UI-01 | [phone-ui.md](phone-ui.md) | 3 (composite — not AI-generated) |

## Hard rules carried over from brand

- No text, no logos, no license plates readable in any generated shot.
  Branding appears only in the composited UI insert and the end card.
- Pre-launch phase: end card is "Launching soon in Montgomery County, MD —
  follow along at tuveloz.com". Never imply customers can book today.
- Launch services only (battery/jump start, detailing, wipers, fluids,
  diagnostics). The rescue fix in shot 4 is a battery/jump start — NOT a tow,
  tire change, or engine teardown.
- Fee language: customers pay the 5% service fee; providers keep their full
  quote. Never "keep 95%".

## New ads

Copy this pattern: give every recurring element an ID and a sheet BEFORE
generating anything. Reuse existing elements where the story allows —
TUV-CAR-01 showing up across ads quietly builds a brand world.
