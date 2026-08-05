import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { cn } from '@/lib/cn';
import type { TypographyVariant } from '@/theme/tokens';

/**
 * Every piece of text in the app renders through this component.
 *
 * Screens pick a semantic `variant` and `tone` instead of font sizes and hex
 * colours, which is what keeps typography consistent and makes a global type
 * change a one-file edit.
 */

type Tone = 'default' | 'secondary' | 'muted' | 'inverse' | 'primary' | 'accent' | 'danger';

const VARIANT_CLASS: Record<TypographyVariant, string> = {
  display: 'text-display font-bold',
  title: 'text-title font-bold',
  heading: 'text-heading font-semibold',
  subheading: 'text-subheading font-semibold',
  body: 'text-body font-normal',
  bodySmall: 'text-bodySmall font-normal',
  label: 'text-label font-semibold',
  caption: 'text-caption font-medium',
};

const TONE_CLASS: Record<Tone, string> = {
  default: 'text-ink',
  secondary: 'text-ink-secondary',
  muted: 'text-ink-muted',
  inverse: 'text-ink-inverse',
  primary: 'text-primary',
  accent: 'text-accent',
  danger: 'text-danger',
};

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  tone?: Tone;
  className?: string;
}

export function Text({ variant = 'body', tone = 'default', className, ...rest }: TextProps) {
  return <RNText className={cn(VARIANT_CLASS[variant], TONE_CLASS[tone], className)} {...rest} />;
}
