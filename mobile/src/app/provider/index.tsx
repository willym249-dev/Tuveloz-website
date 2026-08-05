import { View } from 'react-native';

import { Card, CardHeader, Screen, Text } from '@/components/ui';
import { LAUNCH_AREA } from '@/constants/app';
import { useCurrentProfile } from '@/providers/session-provider';

/**
 * Provider dashboard.
 *
 * Phase 1 ships the shell. Quote requests, submitted quotes, jobs and earnings
 * are Phase 3 — the counters below read zero because there is no data behind
 * them yet, which is stated on the screen rather than implied.
 */
export default function ProviderDashboardScreen() {
  const profile = useCurrentProfile();
  const firstName = profile.fullName.split(' ')[0] ?? profile.fullName;

  return (
    <Screen scroll>
      <View className="mt-4 gap-1">
        <Text variant="title">Hi {firstName}</Text>
        <Text variant="body" tone="muted">
          Your business in {LAUNCH_AREA}.
        </Text>
      </View>

      <View className="mt-6 flex-row gap-3">
        <Stat label="Open requests" value="0" />
        <Stat label="Active jobs" value="0" />
      </View>

      <Card className="mt-4">
        <CardHeader
          title="Set up your business"
          subtitle="Your profile, services and availability decide which requests reach you."
        />
        <Text variant="bodySmall" tone="muted">
          Provider setup arrives in a later release. Until then your account is reserved and you
          will keep your place in the founding provider group.
        </Text>
      </Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex-1 gap-1">
      <Text variant="display" tone="accent">
        {value}
      </Text>
      <Text variant="bodySmall" tone="muted">
        {label}
      </Text>
    </Card>
  );
}
