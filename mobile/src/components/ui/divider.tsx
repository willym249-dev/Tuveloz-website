import { View } from 'react-native';

import { cn } from '@/lib/cn';

import { Text } from './text';

/** A hairline rule, optionally with a centred label ("or", "Today"). */
export function Divider({ label, className }: { label?: string; className?: string }) {
  if (!label) {
    return <View accessibilityRole="none" className={cn('h-px w-full bg-border', className)} />;
  }

  return (
    <View className={cn('w-full flex-row items-center gap-3', className)}>
      <View className="h-px flex-1 bg-border" />
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}
