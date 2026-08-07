"use client";

import { useEffect, useState } from "react";

export type AccountHeaderState = "checking" | "signed-out" | "customer" | "provider";

/**
 * Header account state shared by the homepage and by every public page that
 * renders PublicSiteHeader. Without it a signed-in visitor who opens a public
 * page — the customer launch status page reached from the customer workspace,
 * for example — sees "Sign in" and "Save my spot" and reasonably concludes the
 * session was dropped.
 *
 * The lookup doubles as a session keep-alive: getAccountSession refreshes
 * lastSeenAt, so reading public pages no longer counts as idle time against the
 * 30-minute idle timeout.
 */
export function useAccountHeaderState() {
  const [state, setState] = useState<AccountHeaderState>("checking");
  const [destination, setDestination] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/account", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          setState("signed-out");
          return;
        }
        if (!response.ok) throw new Error("Account status unavailable.");

        const result = (await response.json()) as {
          role?: "customer" | "provider";
          destination?: string;
        };
        if (result.role === "customer" || result.role === "provider") {
          setState(result.role);
          setDestination(result.destination ?? "");
          return;
        }
        setState("checking");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // An unavailable lookup leaves the header on its neutral state rather
        // than telling a signed-in visitor they are signed out.
        setState("checking");
      });

    return () => controller.abort();
  }, []);

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
  const signedIn = state === "customer" || state === "provider";

  return { state, accountHref, accountLabel, signedIn };
}
