import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/components/ui';
import { fieldErrors, resetPasswordSchema } from '@/features/auth/validation';
import { sendPasswordReset } from '@/lib/firebase/auth';

/**
 * Password reset request.
 *
 * The confirmation is deliberately identical whether or not an account exists
 * for the address — telling the difference would let anyone test which emails
 * are registered.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setFormError(null);

    const parsed = resetPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setSubmitting(true);
    const result = await sendPasswordReset(parsed.data.email);
    setSubmitting(false);

    // Anything other than a rate limit or a network failure is reported as
    // success, so an unknown address cannot be distinguished from a known one.
    if (!result.ok && result.error.code !== 'unknown') {
      setFormError(result.error.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <Screen>
        <View className="mt-8 gap-3">
          <Text variant="title">Check your email</Text>
          <Text variant="body" tone="muted">
            If an account exists for {email.trim()}, we have sent a link to reset the password. The
            link expires after one hour.
          </Text>
        </View>

        <View className="mt-auto pb-4">
          <Button label="Back to sign in" onPress={() => router.replace('/sign-in')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll avoidKeyboard>
      <View className="mt-8 gap-2">
        <Text variant="title">Reset your password</Text>
        <Text variant="body" tone="muted">
          Enter the email address on your account and we will send a reset link.
        </Text>
      </View>

      <View className="mt-8 gap-4">
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="go"
          onSubmitEditing={() => {
            void handleSubmit();
          }}
        />

        {formError ? (
          <Text variant="bodySmall" tone="danger" accessibilityLiveRegion="polite">
            {formError}
          </Text>
        ) : null}

        <Button
          label="Send reset link"
          loading={submitting}
          onPress={() => {
            void handleSubmit();
          }}
        />

        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
