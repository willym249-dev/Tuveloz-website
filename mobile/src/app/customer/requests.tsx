import { EmptyState, Screen, Text } from '@/components/ui';

/** Booking history and open requests. Populated in Phase 2. */
export default function CustomerRequestsScreen() {
  return (
    <Screen>
      <Text variant="title" className="mt-4">
        Requests
      </Text>

      <EmptyState
        title="No requests yet"
        description="Service requests you submit will appear here, along with the quotes providers send back."
      />
    </Screen>
  );
}
