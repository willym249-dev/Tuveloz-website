import { z } from 'zod';

/**
 * Typed, validated access to the app's build-time configuration.
 *
 * Two rules govern this file:
 *
 * 1. Every variable must be read as a literal `process.env.EXPO_PUBLIC_…`
 *    member expression. Metro replaces those textually at build time; a
 *    dynamic lookup like `process.env[name]` reads as `undefined` on device
 *    even though it works in Node.
 * 2. Only publishable values live here. `EXPO_PUBLIC_*` values are compiled
 *    into the shipped bundle and can be extracted from any installed build, so
 *    a real secret (Supabase service-role key, Stripe secret key) must never be
 *    added — those belong to a server. Access control is enforced by Supabase
 *    row-level security, not by hiding these identifiers.
 */
const envSchema = z.object({
  firebase: z.object({
    apiKey: z.string().min(1),
    authDomain: z.string().min(1),
    projectId: z.string().min(1),
    appId: z.string().min(1),
  }),
  supabase: z.object({
    url: z.string().url(),
    anonKey: z.string().min(1),
  }),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse({
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  },
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});

if (!parsed.success) {
  // Report which keys are wrong, never their values — this message can end up
  // in logs and crash reports.
  const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');

  throw new Error(
    `Missing or invalid environment configuration: ${missing}.\n` +
      'Copy mobile/.env.example to mobile/.env, fill in the values, then restart ' +
      'the bundler with `npx expo start --clear`.'
  );
}

export const env: Env = parsed.data;
