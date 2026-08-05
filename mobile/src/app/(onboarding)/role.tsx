import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { LAUNCH_AREA } from '@/constants/app';
import { cn } from '@/lib/cn';
import { useSession } from '@/providers/session-provider';
import type { UserRole } from '@/types/database';

/**
 * Role selection — the one irreversible-feeling choice in onboarding, so it
 * gets a screen of its own with the consequences spelled out.
 *
 * Picking a role writes the profile row, which flips the session to `ready`
 * and lets the gate route into the matching area of the app.
 */

const ROLE_OPTIONS: {
  role: UserRole;
  title: string;
  description: string;
  selectedClasses: string;
}[] = [
  {
    role: 'customer',
    title: 'I need work done',
    description:
      'Describe the job, add photos, and compare quotes from independent providers near you.',
    selectedClasses: 'border-primary bg-primary-soft',
  },
  {
    role: 'provider',
    title: 'I provide services',
    description: 'Receive matching requests, send quotes, and manage the jobs you win.',
    selectedClasses: 'border-accent bg-accent-soft',
  },
];

export default function RoleScreen() {
  const { session, chooseRole } = useSession();

  const [selected, setSelected] = useState<UserRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const greetingName = session.status === 'needsRole' ? session.displayName.split(' ')[0] : '';

  async function handleContinue() {
    if (!selected) return;

    setError(null);
    setSubmitting(true);
    const result = await chooseRole(selected);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
    }
    // On success the session becomes `ready` and the layout guard redirects.
  }

  return (
    <Screen scroll>
      <View className="mt-8 gap-2">
        <Text variant="title">{greetingName ? `Welcome, ${greetingName}` : 'Welcome'}</Text>
        <Text variant="body" tone="muted">
          How will you use Tuveloz in {LAUNCH_AREA}?
        </Text>
      </View>

      <View className="mt-8 gap-3">
        {ROLE_OPTIONS.map((option) => {
          const isSelected = selected === option.role;

          return (
            <Card
              key={option.role}
              onPress={() => setSelected(option.role)}
              accessibilityLabel={`${option.title}. ${option.description}`}
              className={cn(
                'gap-1 border-2',
                isSelected ? option.selectedClasses : 'border-border'
              )}
            >
              <Text variant="heading">{option.title}</Text>
              <Text variant="bodySmall" tone="secondary">
                {option.description}
              </Text>
            </Card>
          );
        })}
      </View>

      <Text variant="caption" tone="muted" className="mt-4">
        Contact support if you need to change this later — accounts serve one side of the
        marketplace at a time.
      </Text>

      {error ? (
        <Text variant="bodySmall" tone="danger" className="mt-4" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <View className="mt-auto pt-8">
        <Button
          label="Continue"
          disabled={!selected}
          loading={submitting}
          variant={selected === 'provider' ? 'accent' : 'primary'}
          onPress={() => {
            void handleContinue();
          }}
        />
      </View>
    </Screen>
  );
}
