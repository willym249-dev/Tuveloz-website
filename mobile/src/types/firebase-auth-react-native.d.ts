import type { Persistence } from 'firebase/auth';

/**
 * `getReactNativePersistence` only exists in the React Native build of
 * `firebase/auth` (`@firebase/auth/dist/rn`). Metro resolves that build at
 * runtime via the package's `react-native` export condition, but TypeScript
 * resolves the browser type surface, where the function is absent.
 *
 * Declaring it here keeps the call site fully typed instead of needing a
 * `@ts-expect-error`. Remove this file if Firebase ever ships the RN export in
 * its default types.
 */

/** The slice of AsyncStorage that Firebase's persistence layer uses. */
export interface FirebaseAsyncStorage {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
}

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: FirebaseAsyncStorage): Persistence;
}
