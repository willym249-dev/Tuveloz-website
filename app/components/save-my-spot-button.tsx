"use client";

import Link from "next/link";
import { useAccountHeaderState } from "./account-header-state";

/**
 * The "Create a free account" call to action, which is an invitation to create an
 * account. Shown unchanged to a visitor without a session; for someone already
 * signed in it becomes a link into their own workspace, because telling a
 * signed-in customer to go make an account is what makes a public page read as
 * a sign-out.
 */
export function SaveMySpotButton({
  className = "button primary",
  href = "/account?role=customer&mode=create",
  showArrow = true,
}: {
  className?: string;
  /** Where the invitation points for a visitor without a session. */
  href?: string;
  showArrow?: boolean;
}) {
  const { accountHref, signedIn, state } = useAccountHeaderState();
  const label = !signedIn
    ? "Create a free account"
    : state === "provider"
      ? "Go to your provider workspace"
      : "Go to your account";

  return (
    <Link className={className} href={signedIn ? accountHref : href}>
      {label} {showArrow && <span>→</span>}
    </Link>
  );
}
