import { AppError, toAppError } from './errors';

/**
 * Explicit success/failure values for anything that talks to the network.
 *
 * Service functions in `src/lib` and `src/features/*​/services` return a
 * `Result` instead of throwing, which makes the failure path visible in the
 * type signature and stops screens from forgetting a `try`/`catch`. Programmer
 * errors (a bad argument, an impossible state) should still throw.
 */
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Runs an async operation and captures any throw as an `AppError`.
 *
 * `mapError` lets a caller translate SDK-specific failures into domain codes:
 *
 *   return attempt(() => signInWithEmailAndPassword(auth, email, password),
 *                  toFirebaseAuthError);
 */
export async function attempt<T>(
  operation: () => Promise<T>,
  mapError: (error: unknown) => AppError = toAppError
): Promise<Result<T>> {
  try {
    return ok(await operation());
  } catch (error) {
    return err(mapError(error));
  }
}
