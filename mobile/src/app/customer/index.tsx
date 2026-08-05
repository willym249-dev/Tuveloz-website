import { View } from 'react-native';

import { Button, Card, CardHeader, Screen, Text } from '@/components/ui';
import { LAUNCH_AREA } from '@/constants/app';
import { useCurrentProfile } from '@/providers/session-provider';

/**
 * Customer home.
 *
 * Phase 1 deliberately ships the shell only. The request flow, quotes and
 * chat arrive in Phase 2 — see PROJECT_STATUS.md — and this screen states that
 * plainly rather than showing controls that do nothing.
 */
export default function CustomerHomeScreen() {
  const profile = useCurrentProfile();
  const firstName = profile.fullName.split(' ')[0] ?? profile.fullName;

  return (
    <Screen scroll>
      <View className="mt-4 gap-1">
        <Text variant="title">Hi {firstName}</Text>
        <Text variant="body" tone="muted">
          Serving {LAUNCH_AREA}.
        </Text>
      </View>

      <Card className="mt-6">
        <CardHeader
          title="Request a service"
          subtitle="Tell us what your vehicle needs and get quotes from nearby providers."
        />
        <Button label="Coming in the next release" disabled />
      </Card>

      <Card className="mt-4">
        <CardHeader title="What happens next" />
        <View className="gap-3">
          <Step number={1} text="Describe the work and add photos." />
          <Step number={2} text="Providers near you send quotes." />
          <Step number={3} text="Compare, choose, and book." />
        </View>
      </Card>
    </Screen>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-soft">
        <Text variant="label" tone="primary">
          {number}
        </Text>
      </View>
      <Text variant="body" className="flex-1">
        {text}
      </Text>
    </View>
  );
}
