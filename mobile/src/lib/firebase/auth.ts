import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';

import { attempt, type Result } from '@/lib/result';

import { firebaseApp } from './app';
import { toFirebaseAuthError } from './errors';

/**
 * Firebase Authentication is the app's only identity provider. Everything the
 * rest of the app needs from it is re-exported through the small, typed API
 * below — no screen imports `firebase/auth` directly, so replacing or
 * extending the provider stays contained here.
 *
 * See docs/decisions/0004-firebase-auth-with-supabase-rls.md for why identity
 * and data live in different services.
 */

function createAuth(): Auth {
  try {
    // AsyncStorage persistence keeps the user signed in across app restarts.
    // Without it Firebase falls back to in-memory persistence on React Native.
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Fast Refresh re-runs this module; auth is already initialised by then.
    return getAuth(firebaseApp);
  }
}

export const firebaseAuth = createAuth();

export type FirebaseUser = User;

/** Fires whenever the user signs in or out. Returns an unsubscribe function. */
export function subscribeToAuthState(listener: (user: User | null) => void): () => void {
  return onAuthStateChanged(firebaseAuth, listener);
}

/**
 * Fires on sign-in, sign-out *and* every ID token refresh (roughly hourly).
 * Used to keep downstream services holding a fresh token.
 */
export function subscribeToIdToken(listener: (user: User | null) => void): () => void {
  return onIdTokenChanged(firebaseAuth, listener);
}

/**
 * The current user's ID token, refreshed automatically when close to expiry.
 * Returns `null` when nobody is signed in.
 */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export function signIn(email: string, password: string): Promise<Result<User>> {
  return attempt(
    async () => (await signInWithEmailAndPassword(firebaseAuth, email.trim(), password)).user,
    toFirebaseAuthError
  );
}

export function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<Result<User>> {
  return attempt(async () => {
    const { user } = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
    const trimmedName = displayName.trim();
    if (trimmedName.length > 0) {
      await updateProfile(user, { displayName: trimmedName });
    }
    return user;
  }, toFirebaseAuthError);
}

export function sendPasswordReset(email: string): Promise<Result<void>> {
  return attempt(() => sendPasswordResetEmail(firebaseAuth, email.trim()), toFirebaseAuthError);
}

export function signOutUser(): Promise<Result<void>> {
  return attempt(() => signOut(firebaseAuth), toFirebaseAuthError);
}
