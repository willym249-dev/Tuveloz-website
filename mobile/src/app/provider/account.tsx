import { Card, CardHeader, Text } from '@/components/ui';
import { AccountScreen } from '@/features/profile/components/account-screen';

export default function ProviderAccountScreen() {
  return (
    <AccountScreen
      extraSection={
        <Card className="mt-4">
          <CardHeader title="Business profile" />
          <Text variant="bodySmall" tone="muted">
            Services, availability, service area and payouts are added in a later release.
          </Text>
        </Card>
      }
    />
  );
}
