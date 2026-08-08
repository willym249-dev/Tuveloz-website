import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { createProfile, fetchProfile } from '@/features/profile/profile-repository';
import { AppError } from '@/lib/errors';
import { signOutUser, subscribeToAuthState, type FirebaseUser } from '@/lib/firebase/auth';
import { logger } from '@/lib/logger';
import { err, type Result } from '@/lib/result';
import type { UserRole } from '@/types/database';
import type { Session, UserProfile } from '@/types/session';

/**
 * Owns the answer to "who is signed in, and what may they see".
 *
 * Firebase reports identity; Supabase holds the profile that says whether the
 * account is a customer or a provider. This provider joins the two into the
 * single `Session` value the router keys off, so no screen has to coordinate
 * two async sources itself.
 */

interface SessionContextValue {
  session: Session;
  /** Re-reads the profile, e.g. after an edit or a failed load. */
  refresh: () => Promise<void>;
  /** Creates the profile row for a brand-new account. */
  chooseRole: (role: UserRole) => Promise<Result<UserProfile>>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session>({ status: 'loading' });

  // Auth state can change while a profile fetch is still in flight (sign out
  // during a slow request, a token refresh mid-load). Every load takes a
  // ticket, and only the newest ticket is allowed to write state.
  const latestLoad = useRef(0);
  const firebaseUser = useRef<FirebaseUser | null>(null);

  const loadSession = useCallback(async (user: FirebaseUser | null) => {
    const ticket = ++latestLoad.current;
    firebaseUser.current = user;

    if (!user) {
      setSession({ status: 'signedOut' });
      return;
    }

    setSession({ status: 'loading' });

    const result = await fetchProfile(user.uid);
    if (ticket !== latestLoad.current) return;

    if (!result.ok) {
      logger.error('Failed to load profile', result.error, { code: result.error.code });
      setSession({ status: 'error', message: result.error.message });
      return;
    }

    if (!result.value) {
      // Signed in, but no profile row: the account has not picked a side of
      // the marketplace yet.
      setSession({
        status: 'needsRole',
        userId: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? '',
      });
      return;
    }

    setSession({ status: 'ready', userId: user.uid, profile: result.value });
  }, []);

  useEffect(() => {
    return subscribeToAuthState((user) => {
      void loadSession(user);
    });
  }, [loadSession]);

  const refresh = useCallback(async () => {
    await loadSession(firebaseUser.current);
  }, [loadSession]);

  const chooseRole = useCallback(async (role: UserRole): Promise<Result<UserProfile>> => {
    const user = firebaseUser.current;
    if (!user) {
      return err(new AppError('auth/not-signed-in'));
    }

    const result = await createProfile({
      userId: user.uid,
      role,
      fullName: user.displayName?.trim() || 'Tuveloz member',
      email: user.email ?? '',
    });

    if (result.ok) {
      setSession({ status: 'ready', userId: user.uid, profile: result.value });
    }

    return result;
  }, []);

  const signOut = useCallback(async () => {
    // The auth listener drives the state change to `signedOut`; this only has
    // to surface a failure.
    const result = await signOutUser();
    if (!result.ok) {
      logger.error('Sign out failed', result.error, { code: result.error.code });
    }
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ session, refresh, chooseRole, signOut }),
    [session, refresh, chooseRole, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used inside <SessionProvider>.');
  }
  return context;
}

/**
 * For screens that only render inside an authenticated route group, where the
 * router has already guaranteed a profile exists.
 */
export function useCurrentProfile(): UserProfile {
  const { session } = useSession();
  if (session.status !== 'ready') {
    throw new Error(
      `useCurrentProfile called with session status "${session.status}". ` +
        'Render this screen inside an authenticated route group.'
    );
  }
  return session.profile;
}
