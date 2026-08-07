"use client";

import Link from "next/link";
import { useAccountHeaderState } from "./account-header-state";

/**
 * A signed-in visitor reaching a public marketing page — the customer launch
 * status page is linked straight from the customer workspace — otherwise sees
 * only sign-up wording and no route back to their own account. This renders
 * nothing at all for a visitor without a session, so the marketing page is
 * unchanged for everyone else.
 */
export function SignedInReturnNote() {
  const { accountHref, signedIn, state } = useAccountHeaderState();
  if (!signedIn) return null;

  return (
    <div className="signed-in-return-note" role="status">
      <strong>You&rsquo;re signed in. This page is public information, not a sign-out.</strong>
      <Link href={accountHref}>
        {state === "provider" ? "Back to your provider workspace →" : "Back to your account →"}
      </Link>
    </div>
  );
}
