import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/components/ui';
import { fieldErrors, signInSchema } from '@/features/auth/validation';
import { signIn } from '@/lib/firebase/auth';

/**
 * Email and password sign-in.
 *
 * On success nothing navigates explicitly: Firebase notifies the session
 * provider, the session becomes `ready`, and the auth layout redirects. Screens
 * never push a route based on an auth result, which is what keeps the
 * navigation rules in one place.
 */
export default function SignInScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setFormError(null);

    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setSubmitting(true);
    const result = await signIn(parsed.data.email, parsed.data.password);
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error.message);
    }
  }

  return (
    <Screen scroll avoidKeyboard>
      <View className="mt-8 gap-2">
        <Text variant="title">Welcome back</Text>
        <Text variant="body" tone="muted">
          Sign in to see your requests and quotes.
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
          returnKeyType="next"
        />

        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
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
          label="Sign in"
          loading={submitting}
          onPress={() => {
            void handleSubmit();
          }}
        />

        <Button
          label="Forgot your password?"
          variant="ghost"
          onPress={() => router.push('/forgot-password')}
        />
      </View>

      <View className="mt-auto pt-8">
        <Button
          label="Create an account instead"
          variant="secondary"
          onPress={() => router.replace('/sign-up')}
        />
      </View>
    </Screen>
  );
}
