import { AppError } from '@/lib/errors';
import { attempt, err, ok, type Result } from '@/lib/result';
import { supabase } from '@/lib/supabase/client';
import type { ProfileRow, ProfileUpdate, UserRole } from '@/types/database';
import type { UserProfile } from '@/types/session';

/**
 * Every read and write of the `profiles` table goes through this module.
 *
 * Screens and hooks never touch `supabase` directly: keeping the query surface
 * in one place is what makes row shapes, column names and PostgREST quirks
 * replaceable without a wide refactor.
 */

/**
 * Columns every read selects. Written as a `const` so supabase-js can infer the
 * result shape from the literal rather than handing back `any`.
 */
const PROFILE_COLUMNS = 'id, role, full_name, email, phone, avatar_url, onboarding_completed_at';

/** The subset of the row that {@link PROFILE_COLUMNS} actually returns. */
type ProfileSelection = Pick<
  ProfileRow,
  'id' | 'role' | 'full_name' | 'email' | 'phone' | 'avatar_url' | 'onboarding_completed_at'
>;

function toUserProfile(row: ProfileSelection): UserProfile {
  return {
    id: row.id,
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    onboardingCompletedAt: row.onboarding_completed_at,
  };
}

/**
 * Loads the signed-in account's profile.
 *
 * Resolves to `null` — not an error — when no row exists yet, because that is
 * the normal state between creating a Firebase account and choosing a role.
 */
export async function fetchProfile(userId: string): Promise<Result<UserProfile | null>> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return err(toSupabaseError(error));
  }

  return ok(data ? toUserProfile(data) : null);
}

/**
 * Creates the profile row that records which side of the marketplace an
 * account is on. Called once, immediately after role selection.
 */
export async function createProfile(input: {
  userId: string;
  role: UserRole;
  fullName: string;
  email: string;
}): Promise<Result<UserProfile>> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: input.userId,
      role: input.role,
      full_name: input.fullName,
      email: input.email,
    })
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    return err(toSupabaseError(error));
  }

  return ok(toUserProfile(data));
}

export async function updateProfile(
  userId: string,
  changes: ProfileUpdate
): Promise<Result<UserProfile>> {
  const { data, error } = await supabase
    .from('profiles')
    .update(changes)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    return err(toSupabaseError(error));
  }

  return ok(toUserProfile(data));
}

/** Marks role-specific onboarding as finished. */
export function completeOnboarding(userId: string): Promise<Result<UserProfile>> {
  return attempt(async () => {
    const result = await updateProfile(userId, {
      onboarding_completed_at: new Date().toISOString(),
    });
    if (!result.ok) throw result.error;
    return result.value;
  });
}

/**
 * Maps PostgREST failures onto the app's error vocabulary.
 *
 * `42501` and `PGRST301` both mean the request was rejected by row-level
 * security, which in practice means an expired or missing Firebase token.
 */
function toSupabaseError(error: { code?: string; message?: string }): AppError {
  switch (error.code) {
    case 'PGRST116':
      return new AppError('data/not-found', undefined, { cause: error });
    case '23505':
      return new AppError('data/conflict', undefined, { cause: error });
    case '42501':
    case 'PGRST301':
      return new AppError('data/permission-denied', undefined, { cause: error });
    default:
      if (error.message?.toLowerCase().includes('network')) {
        return new AppError('network/unavailable', undefined, { cause: error });
      }
      return new AppError('unknown', undefined, { cause: error });
  }
}
