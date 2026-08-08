import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

import { Text } from './text';

/**
 * The app's only button.
 *
 * `variant` carries meaning rather than colour: `primary` is the customer
 * action colour, `accent` the provider one, so a screen keeps its identity
 * without hard-coding brand values.
 *
 * The height floors (`min-h-*`) exist to keep every button above the 44pt
 * accessibility touch target on both platforms.
 */

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const CONTAINER_BASE =
  'flex-row items-center justify-center gap-2 rounded-control active:opacity-90';

const VARIANT_CONTAINER: Record<Variant, string> = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  secondary: 'bg-surface border border-border-strong',
  ghost: 'bg-transparent',
  danger: 'bg-danger',
};

const VARIANT_LABEL_TONE: Record<Variant, 'inverse' | 'default' | 'primary'> = {
  primary: 'inverse',
  accent: 'inverse',
  secondary: 'default',
  ghost: 'primary',
  danger: 'inverse',
};

const SIZE_CONTAINER: Record<Size, string> = {
  sm: 'min-h-10 px-4',
  md: 'min-h-12 px-5',
  lg: 'min-h-14 px-6',
};

const SIZE_LABEL: Record<Size, 'bodySmall' | 'body' | 'subheading'> = {
  sm: 'bodySmall',
  md: 'body',
  lg: 'subheading',
};

/** Spinner colour has to be a real value — ActivityIndicator takes no classes. */
const VARIANT_SPINNER: Record<Variant, string> = {
  primary: colors.textOnPrimary,
  accent: colors.textOnAccent,
  secondary: colors.text,
  ghost: colors.primary,
  danger: colors.textInverse,
};

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks presses. Use for in-flight network calls. */
  loading?: boolean;
  /** Stretches the button to the width of its parent. */
  fullWidth?: boolean;
  /** Rendered before the label — an icon, usually. */
  leading?: React.ReactNode;
  className?: string;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = true,
  leading,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const isInteractive = !disabled && !loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      accessibilityLabel={label}
      disabled={!isInteractive}
      className={cn(
        CONTAINER_BASE,
        VARIANT_CONTAINER[variant],
        SIZE_CONTAINER[size],
        fullWidth ? 'w-full' : 'self-start',
        !isInteractive && 'opacity-50',
        className
      )}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={VARIANT_SPINNER[variant]} />
      ) : (
        <>
          {leading ? <View>{leading}</View> : null}
          <Text
            variant={SIZE_LABEL[size]}
            tone={VARIANT_LABEL_TONE[variant]}
            className="font-semibold"
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
