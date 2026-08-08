/**
 * A single error type for everything the UI has to render.
 *
 * Service functions translate whatever their SDK throws (Firebase auth codes,
 * Supabase PostgREST errors, network failures) into an `AppError` carrying a
 * stable `code` for branching and a `message` that is already safe and
 * sensible to show a customer or provider. Screens never inspect a raw SDK
 * error, so swapping a provider stays a change inside `src/lib`.
 */

export type AppErrorCode =
  | 'auth/invalid-credentials'
  | 'auth/email-already-in-use'
  | 'auth/weak-password'
  | 'auth/invalid-email'
  | 'auth/too-many-requests'
  | 'auth/requires-recent-login'
  | 'auth/not-signed-in'
  | 'network/unavailable'
  | 'data/not-found'
  | 'data/permission-denied'
  | 'data/conflict'
  | 'unknown';

/** Fallback copy for every code, so a new call site never renders an empty string. */
const DEFAULT_MESSAGES: Record<AppErrorCode, string> = {
  'auth/invalid-credentials': 'That email and password combination did not match an account.',
  'auth/email-already-in-use': 'An account already exists for that email address.',
  'auth/weak-password': 'Choose a password with at least 8 characters.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/requires-recent-login': 'Please sign in again to confirm this change.',
  'auth/not-signed-in': 'You need to be signed in to do that.',
  'network/unavailable': 'No connection. Check your network and try again.',
  'data/not-found': 'We could not find what you were looking for.',
  'data/permission-denied': 'You do not have access to that.',
  'data/conflict': 'That change conflicts with something that already exists.',
  unknown: 'Something went wrong. Please try again.',
};

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? DEFAULT_MESSAGES[code], options);
    this.name = 'AppError';
    this.code = code;
  }

  /** True for failures that are worth offering a "Try again" button for. */
  get isRetryable(): boolean {
    return this.code === 'network/unavailable' || this.code === 'unknown';
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/** Last-resort conversion for a `catch` block that received something unknown. */
export function toAppError(value: unknown): AppError {
  if (isAppError(value)) return value;
  return new AppError('unknown', undefined, { cause: value });
}
