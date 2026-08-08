import { forwardRef, useId } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

import { Text } from './text';

/**
 * A labelled text input with room for help and error text.
 *
 * The label is always rendered rather than relying on a placeholder: a
 * placeholder disappears the moment someone starts typing, which is exactly
 * when they need to remember what the field was for.
 */

export interface TextFieldProps extends Omit<TextInputProps, 'className' | 'placeholderTextColor'> {
  label: string;
  /** Shown under the field in a normal tone. Hidden while an error is showing. */
  hint?: string;
  /** Shown under the field in the danger tone and marks the field invalid. */
  error?: string;
  containerClassName?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, containerClassName, editable = true, ...rest },
  ref
) {
  const inputId = useId();
  const hasError = Boolean(error);

  return (
    <View className={cn('gap-1.5', containerClassName)}>
      <Text variant="label" nativeID={`${inputId}-label`}>
        {label}
      </Text>

      <TextInput
        ref={ref}
        editable={editable}
        accessibilityLabel={label}
        accessibilityLabelledBy={`${inputId}-label`}
        accessibilityState={{ disabled: !editable }}
        placeholderTextColor={colors.textMuted}
        className={cn(
          'min-h-12 rounded-control border bg-surface px-4 text-body text-ink',
          hasError ? 'border-danger' : 'border-border',
          !editable && 'bg-surface-muted text-ink-muted'
        )}
        {...rest}
      />

      {hasError ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
