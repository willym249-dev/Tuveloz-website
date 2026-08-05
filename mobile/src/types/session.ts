import type { UserRole } from './database';

/**
 * The app-facing shape of an account. Deliberately camelCase and free of
 * database concerns so screens are insulated from column renames.
 */
export interface UserProfile {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  onboardingCompletedAt: string | null;
}

/**
 * The single source of truth for "who is using the app right now", modelled as
 * a discriminated union so that every state has exactly the data it needs and
 * no more. Navigation reads this and nothing else — see `src/app/index.tsx`.
 *
 *   loading    — Firebase has not reported yet, or the profile is in flight.
 *   signedOut  — no Firebase user; show the auth stack.
 *   needsRole  — signed in, but no profile row yet, so no customer/provider
 *                choice has been made. This is the state a brand-new account
 *                lands in, and also where an interrupted sign-up resumes.
 *   ready      — signed in with a profile; route by `profile.role`.
 *   error      — the profile lookup failed (usually offline). The UI offers a
 *                retry rather than silently bouncing the user to sign-in.
 */
export type Session =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'needsRole'; userId: string; email: string; displayName: string }
  | { status: 'ready'; userId: string; profile: UserProfile }
  | { status: 'error'; message: string };

export type SessionStatus = Session['status'];
