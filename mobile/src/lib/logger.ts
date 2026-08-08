/**
 * Minimal logging seam.
 *
 * Everything goes through here rather than calling `console` directly so that
 * wiring a crash reporter (Sentry, Firebase Crashlytics) later is a change to
 * this file alone. Debug output is dropped from release builds.
 *
 * Never log personal data — emails, phone numbers, addresses, photos or
 * message contents. Log identifiers and error codes instead.
 */

const isDev = __DEV__;

type Context = Record<string, unknown>;

export const logger = {
  debug(message: string, context?: Context): void {
    if (!isDev) return;
    console.log(`[debug] ${message}`, context ?? '');
  },

  info(message: string, context?: Context): void {
    console.info(`[info] ${message}`, context ?? '');
  },

  warn(message: string, context?: Context): void {
    console.warn(`[warn] ${message}`, context ?? '');
  },

  /** Report a failure. `error` is the original throwable, kept for stack traces. */
  error(message: string, error?: unknown, context?: Context): void {
    console.error(`[error] ${message}`, error ?? '', context ?? '');
    // TODO(phase-4): forward to the crash reporter once one is chosen.
  },
};
