// `react-native-url-polyfill` must be imported before supabase-js: the SDK
// builds request URLs with the WHATWG `URL` API, which React Native's runtime
// only partially implements.
import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { getIdToken } from '@/lib/firebase/auth';
import type { Database } from '@/types/database';

/**
 * The Supabase client for all application data.
 *
 * Authentication is *not* handled by Supabase Auth. The `accessToken` hook
 * hands Supabase the current Firebase ID token on every request, and Supabase
 * is configured to trust that issuer as a third-party auth provider. Policies
 * therefore authorise against `auth.jwt() ->> 'sub'`, which is the Firebase
 * UID. See docs/decisions/0004-firebase-auth-with-supabase-rls.md.
 *
 * Consequence worth knowing: with `accessToken` set, supabase-js disables its
 * own `supabase.auth.*` namespace and throws if you touch it. Sign-in,
 * sign-out and password resets all go through `src/lib/firebase/auth.ts`.
 *
 * Firebase caches and refreshes the token internally, so calling `getIdToken`
 * per request is cheap — it only hits the network when the token is near
 * expiry.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  env.supabase.url,
  env.supabase.anonKey,
  {
    accessToken: async () => await getIdToken(),
  }
);
