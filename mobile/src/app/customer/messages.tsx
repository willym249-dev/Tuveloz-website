import { EmptyState, Screen, Text } from '@/components/ui';

/** Customer/provider chat. Built in Phase 2. */
export default function CustomerMessagesScreen() {
  return (
    <Screen>
      <Text variant="title" className="mt-4">
        Messages
      </Text>

      <EmptyState
        title="No messages"
        description="Once a provider quotes on one of your requests, your conversation with them opens here."
      />
    </Screen>
  );
}
