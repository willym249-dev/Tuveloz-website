import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/components/ui';
import { fieldErrors, signUpSchema } from '@/features/auth/validation';
import { signUp } from '@/lib/firebase/auth';

/**
 * Account creation.
 *
 * This screen only creates the Firebase identity. Choosing customer or
 * provider happens next, on the role screen, because the session provider
 * routes any signed-in account without a profile row there — including one
 * that quit the app mid-signup.
 */
export default function SignUpScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setFormError(null);

    const parsed = signUpSchema.safeParse({ fullName, email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setSubmitting(true);
    const result = await signUp(parsed.data.email, parsed.data.password, parsed.data.fullName);
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error.message);
    }
  }

  return (
    <Screen scroll avoidKeyboard>
      <View className="mt-8 gap-2">
        <Text variant="title">Create your account</Text>
        <Text variant="body" tone="muted">
          You will choose whether you are booking work or offering it on the next screen.
        </Text>
      </View>

      <View className="mt-8 gap-4">
        <TextField
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          error={errors.fullName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
        />

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
        />

        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          hint="At least 8 characters."
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
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
          label="Create account"
          loading={submitting}
          onPress={() => {
            void handleSubmit();
          }}
        />
      </View>

      <View className="mt-auto pt-8">
        <Button
          label="I already have an account"
          variant="secondary"
          onPress={() => router.replace('/sign-in')}
        />
      </View>
    </Screen>
  );
}
