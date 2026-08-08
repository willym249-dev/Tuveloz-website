import { EmptyState, Screen, Text } from '@/components/ui';

/** Won jobs and their progress. Built in Phase 3. */
export default function ProviderJobsScreen() {
  return (
    <Screen>
      <Text variant="title" className="mt-4">
        Jobs
      </Text>

      <EmptyState
        title="No jobs yet"
        description="When a customer accepts one of your quotes, the job appears here with its schedule and status."
      />
    </Screen>
  );
}
