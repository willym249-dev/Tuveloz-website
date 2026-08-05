/**
 * Design tokens — the single source of truth for the Tuveloz app's visual
 * language.
 *
 * These values are consumed twice:
 *   1. `tailwind.config.ts` turns them into NativeWind utility classes, which
 *      is how components should style themselves 99% of the time.
 *   2. Runtime code that cannot use classes (React Navigation themes, the
 *      status bar, imperative APIs) imports them directly.
 *
 * Never hard-code a hex value in a component. Add it here first so both worlds
 * stay in sync.
 *
 * The palette is inherited from the Tuveloz brand used on the website so the
 * app and the marketing site read as one product.
 */

/** Raw brand colours. Prefer the semantic aliases below in product code. */
export const palette = {
  navy: '#07182D',
  ink: '#071726',
  ink2: '#0D2336',
  ink3: '#1B3346',

  blue: '#1268FF',
  blueDark: '#0754DA',
  blueSoft: '#EDF4FF',

  orange: '#FF6A00',
  orangeDark: '#D95700',
  orangeSoft: '#FFF6EF',

  lime: '#C8FF48',

  paper: '#F4F7F9',
  white: '#FFFFFF',
  line: '#DFE6EB',
  muted: '#607083',
  slate: '#41586E',

  green: '#21A779',
  greenSoft: '#E7F6F0',
  amber: '#B54708',
  amberSoft: '#FFF8F2',
  red: '#D92D20',
  redSoft: '#FEF3F2',
} as const;

/**
 * Semantic colours. Product code names the *role* a colour plays, not the
 * colour itself, so a rebrand is a change in this file only.
 *
 * `primary` is the customer-facing action colour and `accent` is the
 * provider-facing one — the two sides of the marketplace are deliberately
 * distinguishable at a glance.
 */
export const colors = {
  background: palette.paper,
  surface: palette.white,
  surfaceMuted: '#F7F9FB',
  surfaceInverse: palette.navy,
  border: palette.line,
  borderStrong: '#C6D2DC',

  primary: palette.blue,
  primaryDark: palette.blueDark,
  primarySoft: palette.blueSoft,

  accent: palette.orange,
  accentDark: palette.orangeDark,
  accentSoft: palette.orangeSoft,

  highlight: palette.lime,

  text: palette.ink,
  textSecondary: palette.slate,
  textMuted: palette.muted,
  textInverse: palette.white,
  textOnPrimary: palette.white,
  textOnAccent: palette.white,

  success: palette.green,
  successSoft: palette.greenSoft,
  warning: palette.amber,
  warningSoft: palette.amberSoft,
  danger: palette.red,
  dangerSoft: palette.redSoft,
} as const;

/** Corner radii. `card` and `control` are the two you should reach for. */
export const radius = {
  none: 0,
  sm: 8,
  control: 12,
  card: 16,
  lg: 20,
  xl: 28,
  full: 9999,
} as const;

/**
 * Spacing scale in points, on a 4pt grid. Tailwind's numeric scale
 * (`p-4` = 16pt) is generated from this and is the preferred way to apply it.
 */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/**
 * Type scale. Sizes are points; line heights are absolute rather than
 * multipliers because React Native does not support unitless line height.
 */
export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '600' },
  subheading: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodySmall: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
} as const;

/**
 * Minimum touch target. Anything tappable must be at least this tall — both
 * platforms' accessibility guidelines ask for ~44pt.
 */
export const MIN_TOUCH_TARGET = 48;

export type PaletteColor = keyof typeof palette;
export type SemanticColor = keyof typeof colors;
export type TypographyVariant = keyof typeof typography;
