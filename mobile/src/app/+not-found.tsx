import { useRouter } from 'expo-router';

import { EmptyState, Screen } from '@/components/ui';

/** Rendered for any URL that does not match a route, including bad deep links. */
export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen>
      <EmptyState
        title="Page not found"
        description="That link does not lead anywhere in the app."
        actionLabel="Go home"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
