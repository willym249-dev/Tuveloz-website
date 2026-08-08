import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/providers/session-provider';
import { colors } from '@/theme/tokens';

/**
 * Onboarding is only reachable by a signed-in account that has not yet chosen
 * a role. Anyone else goes back to the gate.
 */
export default function OnboardingLayout() {
  const { session } = useSession();

  if (session.status !== 'needsRole') {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
