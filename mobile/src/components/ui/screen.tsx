import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';

/**
 * The outer container every screen starts with.
 *
 * It owns three things screens keep getting wrong when done by hand: safe-area
 * insets (notches, home indicators), the page background, and keeping inputs
 * visible above the keyboard.
 *
 * Screens inside a tab navigator should pass `edges={['top']}` — the tab bar
 * already handles the bottom inset, and claiming it twice leaves a gap.
 */

export interface ScreenProps extends PropsWithChildren {
  /** Wraps content in a ScrollView. Use for anything taller than the viewport. */
  scroll?: boolean;
  /** Applies the standard horizontal gutter. Turn off for edge-to-edge lists. */
  padded?: boolean;
  /** Lifts content above the software keyboard. Turn on for any screen with inputs. */
  avoidKeyboard?: boolean;
  edges?: readonly Edge[];
  className?: string;
  contentClassName?: string;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  avoidKeyboard = false,
  edges = ['top'],
  className,
  contentClassName,
}: ScreenProps) {
  const contentClasses = cn('flex-1', padded && 'px-4', contentClassName);

  const body = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName={cn(padded && 'px-4', 'grow pb-8', contentClassName)}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View className={contentClasses}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} className={cn('flex-1 bg-background', className)}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}
