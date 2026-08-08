import type { Config } from 'tailwindcss';

import { colors, palette, radius, spacing, typography } from './src/theme/tokens';

/**
 * NativeWind reads this config.
 *
 * Values are imported from `src/theme/tokens.ts` rather than redeclared, so the
 * utility classes and the runtime theme can never drift apart. The nesting
 * below is what produces readable class names: a `dark` key under `primary`
 * becomes `bg-primary-dark`, and a `DEFAULT` key becomes plain `bg-primary`.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  // The NativeWind preset is CommonJS and Tailwind loads this config through a
  // CJS bridge, so `import` is not an option here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: colors.background,

        surface: {
          DEFAULT: colors.surface,
          muted: colors.surfaceMuted,
          inverse: colors.surfaceInverse,
        },

        border: {
          DEFAULT: colors.border,
          strong: colors.borderStrong,
        },

        // Text colours. `ink` is the brand's near-black.
        ink: {
          DEFAULT: colors.text,
          secondary: colors.textSecondary,
          muted: colors.textMuted,
          inverse: colors.textInverse,
        },

        // Customer-facing action colour.
        primary: {
          DEFAULT: colors.primary,
          dark: colors.primaryDark,
          soft: colors.primarySoft,
        },

        // Provider-facing action colour.
        accent: {
          DEFAULT: colors.accent,
          dark: colors.accentDark,
          soft: colors.accentSoft,
        },

        highlight: colors.highlight,

        success: { DEFAULT: colors.success, soft: colors.successSoft },
        warning: { DEFAULT: colors.warning, soft: colors.warningSoft },
        danger: { DEFAULT: colors.danger, soft: colors.dangerSoft },

        brand: {
          navy: palette.navy,
          lime: palette.lime,
        },
      },

      borderRadius: {
        control: `${radius.control}px`,
        card: `${radius.card}px`,
        lg: `${radius.lg}px`,
        xl: `${radius.xl}px`,
      },

      spacing: Object.fromEntries(
        Object.entries(spacing).map(([step, value]) => [step, `${value}px`])
      ),

      // `text-title`, `text-body`, … carry their line height with them.
      fontSize: Object.fromEntries(
        Object.entries(typography).map(([name, style]) => [
          name,
          [`${style.fontSize}px`, `${style.lineHeight}px`],
        ])
      ),
    },
  },
  plugins: [],
};

export default config;
