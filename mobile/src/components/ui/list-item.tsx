import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '@/lib/cn';

import { Text } from './text';

/**
 * A row in a settings or navigation list: leading slot, stacked title and
 * subtitle, trailing slot. Rows are at least 48pt tall so they clear the
 * accessibility touch target.
 */
export interface ListItemProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  className?: string;
}

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  className,
}: ListItemProps) {
  const content = (
    <>
      {leading ? <View className="mr-3">{leading}</View> : null}

      <View className="flex-1 gap-0.5">
        <Text variant="body">{title}</Text>
        {subtitle ? (
          <Text variant="bodySmall" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ? <View className="ml-3">{trailing}</View> : null}
    </>
  );

  const classes = cn('min-h-12 flex-row items-center py-3', className);

  if (!onPress) {
    return <View className={classes}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      className={cn(classes, 'active:opacity-60')}
    >
      {content}
    </Pressable>
  );
}
