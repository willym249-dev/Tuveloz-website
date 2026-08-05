import { Image } from 'expo-image';
import { View } from 'react-native';

import { cn } from '@/lib/cn';

import { Text } from './text';

/**
 * Profile image with an initials fallback, so a missing photo never renders as
 * an empty box. `expo-image` is used for its disk cache — avatars appear in
 * lists and would otherwise refetch on every scroll.
 */

type Size = 'sm' | 'md' | 'lg';

const SIZE_CONTAINER: Record<Size, string> = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

const SIZE_TEXT: Record<Size, 'caption' | 'label' | 'heading'> = {
  sm: 'caption',
  md: 'label',
  lg: 'heading',
};

export interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: Size;
  className?: string;
}

export function Avatar({ name, uri, size = 'md', className }: AvatarProps) {
  const containerClasses = cn(
    'items-center justify-center overflow-hidden rounded-full bg-primary-soft',
    SIZE_CONTAINER[size],
    className
  );

  if (uri) {
    return (
      <View className={containerClasses}>
        <Image
          source={{ uri }}
          contentFit="cover"
          transition={150}
          accessibilityLabel={`${name}'s profile photo`}
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    );
  }

  return (
    <View className={containerClasses} accessibilityLabel={name}>
      <Text variant={SIZE_TEXT[size]} tone="primary">
        {initialsFrom(name)}
      </Text>
    </View>
  );
}

/** "Ada Lovelace" -> "AL"; "Ada" -> "A"; "" -> "?" */
function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';

  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';

  return (first + last).toUpperCase();
}
