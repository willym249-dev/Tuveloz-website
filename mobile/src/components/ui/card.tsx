import type { PropsWithChildren } from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '@/lib/cn';

import { Text } from './text';

/**
 * The standard content container: white surface, hairline border, card radius.
 *
 * Borders rather than shadows are the house style — they render identically on
 * both platforms and stay crisp on the light background.
 */

export interface CardProps extends PropsWithChildren {
  /** Makes the whole card a single tap target. */
  onPress?: () => void;
  accessibilityLabel?: string;
  className?: string;
}

const CARD_BASE = 'rounded-card border border-border bg-surface p-4';

export function Card({ children, onPress, accessibilityLabel, className }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        className={cn(CARD_BASE, 'active:bg-surface-muted', className)}
      >
        {children}
      </Pressable>
    );
  }

  return <View className={cn(CARD_BASE, className)}>{children}</View>;
}

/** Optional title/subtitle block for the top of a card. */
export function CardHeader({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <View className={cn('mb-3 gap-1', className)}>
      <Text variant="heading">{title}</Text>
      {subtitle ? (
        <Text variant="bodySmall" tone="muted">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
