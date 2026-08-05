import { EmptyState, Screen, Text } from '@/components/ui';

/** Incoming quote requests matched to this provider. Built in Phase 3. */
export default function ProviderRequestsScreen() {
  return (
    <Screen>
      <Text variant="title" className="mt-4">
        Requests
      </Text>

      <EmptyState
        title="No requests yet"
        description="Customer requests that match your services and service area will appear here for you to quote on."
      />
    </Screen>
  );
}
