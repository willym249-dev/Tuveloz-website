import { ActivityIndicator, View } from 'react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

import { Button } from './button';
import { Text } from './text';

/**
 * The two views every async screen needs alongside its success state. Having
 * them here means loading and failure look the same everywhere instead of
 * being reinvented per screen.
 */

export function LoadingView({
  label = 'Loading…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      className={cn('flex-1 items-center justify-center gap-3', className)}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <Text variant="bodySmall" tone="muted">
        {label}
      </Text>
    </View>
  );
}

export function ErrorView({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <View className={cn('flex-1 items-center justify-center gap-3 px-6', className)}>
      <Text variant="heading" className="text-center">
        {title}
      </Text>
      <Text variant="body" tone="muted" className="text-center">
        {message}
      </Text>
      {onRetry ? (
        <Button
          label="Try again"
          variant="secondary"
          onPress={onRetry}
          fullWidth={false}
          className="mt-2"
        />
      ) : null}
    </View>
  );
}
