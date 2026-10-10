import { AuthErasureRecoveryJournal, type RecoveryStore } from "./privacy-erasure-recovery";

// Optional until the separately approved private store and secrets are set up.
// No activation flag: configuring this adapter does not enable erasure.
export type PrivacyRecoveryEnvironment = {
  SITE_URL?: string;
  BUCKET?: unknown;
  BACKUP_BUCKET?: unknown;
  PRIVACY_ERASURE_JOURNAL?: RecoveryStore;
  PRIVACY_ERASURE_CONTEXT?: string;
  PRIVACY_ERASURE_SIGNING_KEY_ID?: string;
  PRIVACY_ERASURE_KEYS_JSON?: string;
};

export function configuredPrivacyRecoveryJournal(env: PrivacyRecoveryEnvironment) {
  const store = env.PRIVACY_ERASURE_JOURNAL;
  if (!store || !env.PRIVACY_ERASURE_CONTEXT || !env.PRIVACY_ERASURE_SIGNING_KEY_ID || !env.PRIVACY_ERASURE_KEYS_JSON) {
    return { state: "not-configured" as const };
  }
  try {
    // This adapter is production-specific. Never silently reuse this namespace
    // or key ring for a staging/restored environment. Identity and bucket privacy
    // still require deployment review; handle inequality alone cannot prove them.
    if (env.SITE_URL !== "https://tuveloz.com" || env.PRIVACY_ERASURE_CONTEXT !== "tuveloz-production"
      || store === env.BUCKET || store === env.BACKUP_BUCKET
      || [store.get, store.put, store.list].some(method => typeof method !== "function")
      || env.PRIVACY_ERASURE_KEYS_JSON.length > 4096) throw new Error();
    const parsed: unknown = JSON.parse(env.PRIVACY_ERASURE_KEYS_JSON);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    const entries = Object.entries(parsed);
    if (entries.length < 1 || entries.length > 5 || new Set(entries.map(([, secret]) => secret)).size !== entries.length) throw new Error();
    const keys: Record<string, string> = Object.create(null);
    for (const [id, secret] of entries) {
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id) || ["__proto__", "constructor", "prototype"].includes(id)
        || typeof secret !== "string" || !/^[a-f0-9]{64}$/.test(secret)) throw new Error();
      keys[id] = secret;
    }
    if (!Object.hasOwn(keys, env.PRIVACY_ERASURE_SIGNING_KEY_ID)) throw new Error();
    return { state: "configured" as const, journal: new AuthErasureRecoveryJournal(store,
      env.PRIVACY_ERASURE_CONTEXT, env.PRIVACY_ERASURE_SIGNING_KEY_ID, Object.freeze(keys)) };
  } catch {
    // Never return a parser error, key identifier, secret or environment value.
    return { state: "invalid-configuration" as const };
  }
}
