/**
 * Types for the Supabase schema.
 *
 * Hand-written for now because the schema is small and changes with every
 * migration under `supabase/migrations`. Once the schema settles, replace the
 * body of this file with generated types and keep the file path stable:
 *
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 *
 * Rule: this file describes the database. Domain types the UI works with live
 * in `src/types/session.ts` and feature folders, so a column rename does not
 * ripple through every screen.
 */

/** Which side of the marketplace an account acts as. */
export type UserRole = 'customer' | 'provider';

/**
 * One row per account. `id` is the Firebase UID rather than a generated key,
 * because row-level security compares it directly against the `sub` claim of
 * the Firebase ID token.
 */
// Declared as a type alias, not an interface, on purpose: supabase-js
// constrains each table to `Record<string, unknown>`, and TypeScript only
// grants implicit index signatures to type aliases. An interface here compiles
// but degrades every query's inferred result to `never`.
export type ProfileRow = {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  /** Null until the account finishes its role-specific onboarding. */
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileInsert = Pick<ProfileRow, 'id' | 'role' | 'full_name' | 'email'> &
  Partial<Pick<ProfileRow, 'phone' | 'avatar_url' | 'onboarding_completed_at'>>;

export type ProfileUpdate = Partial<
  Pick<ProfileRow, 'role' | 'full_name' | 'phone' | 'avatar_url' | 'onboarding_completed_at'>
>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
    };
    // `Record<string, never>` rather than `{}`: supabase-js checks the schema
    // against an index-signature constraint, and an empty object type does not
    // satisfy it — which silently degrades every query's inferred type.
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
}
