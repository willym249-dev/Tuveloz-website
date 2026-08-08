import { View } from 'react-native';

import { cn } from '@/lib/cn';

import { Text } from './text';

/**
 * Compact status marker — quote states, job states, role labels.
 *
 * Tones name a meaning, not a colour, so the same vocabulary works for
 * "Pending", "Accepted" and "Cancelled" across every feature.
 */

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

const TONE_CONTAINER: Record<Tone, string> = {
  neutral: 'bg-surface-muted border-border',
  info: 'bg-primary-soft border-primary-soft',
  success: 'bg-success-soft border-success-soft',
  warning: 'bg-warning-soft border-warning-soft',
  danger: 'bg-danger-soft border-danger-soft',
  accent: 'bg-accent-soft border-accent-soft',
};

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink-secondary',
  info: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  accent: 'text-accent-dark',
};

export interface BadgeProps {
  label: string;
  tone?: Tone;
  className?: string;
}

export function Badge({ label, tone = 'neutral', className }: BadgeProps) {
  return (
    <View
      className={cn('self-start rounded-full border px-3 py-1', TONE_CONTAINER[tone], className)}
    >
      <Text variant="caption" className={TONE_TEXT[tone]}>
        {label}
      </Text>
    </View>
  );
}
