"use client";

import { useEffect, useSyncExternalStore } from "react";

export type AccountHeaderState = "checking" | "signed-out" | "customer" | "provider";

export type AccountHeaderSnapshot = {
  state: AccountHeaderState;
  destination: string;
};

const CACHE_KEY = "tuveloz.account-header-state";
const SERVER_SNAPSHOT: AccountHeaderSnapshot = { state: "checking", destination: "" };

// One snapshot object shared by every consumer. useSyncExternalStore compares
// by reference, so this is replaced only when the value actually changes.
let snapshot: AccountHeaderSnapshot | null = null;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function readCachedSnapshot(): AccountHeaderSnapshot {
  try {
    const stored = window.sessionStorage.getItem(CACHE_KEY);
    if (!stored) return SERVER_SNAPSHOT;
    const parsed = JSON.parse(stored) as Partial<AccountHeaderSnapshot>;
    if (parsed.state === "customer" || parsed.state === "provider" || parsed.state === "signed-out") {
      return { state: parsed.state, destination: typeof parsed.destination === "string" ? parsed.destination : "" };
    }
  } catch {
    // A blocked or malformed sessionStorage just means the lookup decides.
  }
  return SERVER_SNAPSHOT;
}

function publish(next: AccountHeaderSnapshot) {
  const current = snapshot ?? SERVER_SNAPSHOT;
  if (current.state === next.state && current.destination === next.destination) return;
  snapshot = next;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    // Caching is an optimization; the lookup still works without it.
  }
  for (const listener of listeners) listener();
}

/**
 * Records the session a page already learned about from its own /api/account
 * read, so the shared header does not have to discover it a second time. The
 * customer and provider workspaces call this, which is what removes the flash
 * of signed-out wording on the first public page opened from a workspace.
 */
export function primeAccountHeaderState(
  state: Exclude<AccountHeaderState, "checking">,
  destination = "",
) {
  publish({ state, destination });
}

function ensureLoaded() {
  if (inFlight) return inFlight;
  inFlight = fetch("/api/account", { cache: "no-store" })
    .then(async (response) => {
      if (response.status === 401) {
        publish({ state: "signed-out", destination: "" });
        return;
      }
      if (!response.ok) throw new Error("Account status unavailable.");
      const result = (await response.json()) as {
        role?: "customer" | "provider";
        destination?: string;
      };
      if (result.role === "customer" || result.role === "provider") {
        publish({ state: result.role, destination: result.destination ?? "" });
      }
    })
    .catch(() => {
      // An unavailable lookup leaves whatever is already known in place rather
      // than telling a signed-in visitor they are signed out.
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  if (!snapshot) snapshot = readCachedSnapshot();
  return snapshot;
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

/**
 * Header account state shared by the homepage, the launch banner, and every
 * public page that renders PublicSiteHeader. Without it a signed-in visitor who
 * opens a public page — the customer launch status page reached from the
 * customer workspace, for example — is shown "Sign in" and "Save my spot" and
 * reasonably concludes the session was dropped.
 *
 * Every consumer shares one lookup and one cached answer, so a page with a
 * header, a banner, and three calls to action makes a single request.
 *
 * The lookup doubles as a session keep-alive: getAccountSession refreshes
 * lastSeenAt, so reading public pages no longer counts as idle time against the
 * 30-minute idle timeout.
 */
export function useAccountHeaderState() {
  const { state, destination } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    ensureLoaded();
  }, []);

  const signedIn = state === "customer" || state === "provider";
  const accountHref = destination || (
    state === "customer"
      ? "/customer"
      : state === "provider"
        ? "/provider-onboarding"
        : "/account"
  );
  const accountLabel = state === "customer"
    ? "Customer account"
    : state === "provider"
      ? "Provider account"
      : state === "signed-out"
        ? "Sign up or sign in"
        : "Account";

  return { state, accountHref, accountLabel, signedIn };
}
