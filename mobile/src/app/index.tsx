import { Redirect } from 'expo-router';

import { ErrorView, LoadingView, Screen } from '@/components/ui';
import { useSession } from '@/providers/session-provider';

/**
 * The routing gate.
 *
 * This is the only place that decides which part of the app someone belongs
 * in. Every route group also guards itself, but they all bounce back here
 * rather than duplicating the decision, so the rule lives in one file.
 */
export default function IndexRoute() {
  const { session, refresh } = useSession();

  switch (session.status) {
    case 'loading':
      return (
        <Screen>
          <LoadingView label="Signing you in…" />
        </Screen>
      );

    case 'signedOut':
      return <Redirect href="/welcome" />;

    case 'needsRole':
      return <Redirect href="/role" />;

    case 'ready':
      return <Redirect href={session.profile.role === 'customer' ? '/customer' : '/provider'} />;

    case 'error':
      return (
        <Screen>
          <ErrorView
            title="We could not load your account"
            message={session.message}
            onRetry={() => {
              void refresh();
            }}
          />
        </Screen>
      );
  }
}
