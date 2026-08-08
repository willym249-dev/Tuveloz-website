import { View } from 'react-native';

import { cn } from '@/lib/cn';

import { Button } from './button';
import { Text } from './text';

/**
 * What a list shows when it has nothing in it.
 *
 * An empty list is a normal state, not a failure, so the copy should explain
 * what will appear here and offer the action that fills it.
 */
export interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <View className={cn('flex-1 items-center justify-center gap-3 px-6 py-12', className)}>
      <Text variant="heading" className="text-center">
        {title}
      </Text>

      {description ? (
        <Text variant="body" tone="muted" className="text-center">
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} fullWidth={false} className="mt-2" />
      ) : null}
    </View>
  );
}
