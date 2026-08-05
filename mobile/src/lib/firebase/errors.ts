import { AppError } from '@/lib/errors';

/**
 * Translates Firebase Auth error codes into the app's own error vocabulary.
 *
 * Sign-in failures are deliberately collapsed into a single
 * `auth/invalid-credentials`: distinguishing "no such user" from "wrong
 * password" tells an attacker which email addresses have accounts. Firebase
 * itself does this with `auth/invalid-credential` when email enumeration
 * protection is enabled; older codes are folded in for safety.
 */
export function toFirebaseAuthError(error: unknown): AppError {
  const code = readErrorCode(error);

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return new AppError('auth/invalid-credentials', undefined, { cause: error });

    case 'auth/email-already-in-use':
      return new AppError('auth/email-already-in-use', undefined, { cause: error });

    case 'auth/weak-password':
      return new AppError('auth/weak-password', undefined, { cause: error });

    case 'auth/invalid-email':
    case 'auth/missing-email':
      return new AppError('auth/invalid-email', undefined, { cause: error });

    case 'auth/too-many-requests':
      return new AppError('auth/too-many-requests', undefined, { cause: error });

    case 'auth/requires-recent-login':
      return new AppError('auth/requires-recent-login', undefined, { cause: error });

    case 'auth/network-request-failed':
      return new AppError('network/unavailable', undefined, { cause: error });

    default:
      return new AppError('unknown', undefined, { cause: error });
  }
}

function readErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error as { code: unknown };
    if (typeof code === 'string') return code;
  }
  return '';
}
