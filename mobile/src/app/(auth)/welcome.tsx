import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { LAUNCH_AREA, SUPPORT_EMAIL } from '@/constants/app';

/**
 * First screen for anyone who is not signed in. It states what Tuveloz is and
 * offers exactly two paths — create an account, or sign in.
 */
export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <Screen scroll contentClassName="justify-between">
      <View className="mt-12 gap-3">
        <Text variant="display">Tuveloz</Text>
        <Text variant="body" tone="secondary">
          Describe the work your vehicle needs, compare quotes from independent providers near you,
          and book the one you trust.
        </Text>
        <Text variant="bodySmall" tone="muted">
          Now serving {LAUNCH_AREA}.
        </Text>
      </View>

      <View className="mt-10 gap-3">
        <Button label="Create an account" onPress={() => router.push('/sign-up')} />
        <Button
          label="I already have an account"
          variant="secondary"
          onPress={() => router.push('/sign-in')}
        />

        <Text variant="caption" tone="muted" className="mt-2 text-center">
          Questions? {SUPPORT_EMAIL}
        </Text>
      </View>
    </Screen>
  );
}
