import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/providers/session-provider';
import { colors } from '@/theme/tokens';

/**
 * The signed-out stack. Anyone who already has a session is sent back to the
 * gate at `/`, which decides where they actually belong.
 */
export default function AuthLayout() {
  const { session } = useSession();

  if (session.status === 'ready' || session.status === 'needsRole') {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
