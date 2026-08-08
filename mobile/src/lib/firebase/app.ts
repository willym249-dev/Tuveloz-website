import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';

import { env } from '@/lib/env';

/**
 * The one Firebase app instance for the whole client.
 *
 * `getApps()` is checked first because Fast Refresh re-evaluates this module
 * during development, and `initializeApp` throws on a duplicate name.
 */
export const firebaseApp: FirebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp({
        apiKey: env.firebase.apiKey,
        authDomain: env.firebase.authDomain,
        projectId: env.firebase.projectId,
        appId: env.firebase.appId,
      });
