import { View } from 'react-native';

import { Avatar, Badge, Button, Card, Divider, ListItem, Screen, Text } from '@/components/ui';
import { APP_NAME, SUPPORT_EMAIL, WEBSITE_URL } from '@/constants/app';
import { useCurrentProfile, useSession } from '@/providers/session-provider';

/**
 * The account tab, shared by both sides of the marketplace.
 *
 * Customers and providers see the same identity, support and sign-out block;
 * anything role-specific is passed in as `extraSection` rather than forked
 * into two near-identical screens.
 */
export function AccountScreen({ extraSection }: { extraSection?: React.ReactNode }) {
  const profile = useCurrentProfile();
  const { signOut } = useSession();

  return (
    <Screen scroll>
      <Text variant="title" className="mt-4">
        Account
      </Text>

      <Card className="mt-6 flex-row items-center gap-4">
        <Avatar name={profile.fullName} uri={profile.avatarUrl} size="lg" />

        <View className="flex-1 gap-1">
          <Text variant="heading">{profile.fullName}</Text>
          <Text variant="bodySmall" tone="muted">
            {profile.email}
          </Text>
          <Badge
            label={profile.role === 'customer' ? 'Customer' : 'Provider'}
            tone={profile.role === 'customer' ? 'info' : 'accent'}
            className="mt-1"
          />
        </View>
      </Card>

      {extraSection}

      <Card className="mt-4">
        <Text variant="label" tone="muted" className="mb-1">
          Support
        </Text>
        <ListItem title="Contact us" subtitle={SUPPORT_EMAIL} />
        <Divider />
        <ListItem title={`${APP_NAME} on the web`} subtitle={WEBSITE_URL} />
      </Card>

      <View className="mt-6">
        <Button
          label="Sign out"
          variant="secondary"
          onPress={() => {
            void signOut();
          }}
        />
      </View>
    </Screen>
  );
}
