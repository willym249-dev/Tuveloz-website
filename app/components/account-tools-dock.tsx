"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Owner access stays separate from customer and provider navigation.
 *
 * Customer and provider workspaces already contain their own role-specific tools,
 * so this global floating control is intentionally hidden from ordinary signed-in
 * users. It appears only on the account page as an owner sign-in entry or after
 * Cloudflare Access has verified the owner session.
 */
export function AccountToolsDock() {
  const pathname = usePathname();
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void fetch("/api/owner-access", { cache: "no-store" })
        .then(async (response) => response.ok ? await response.json() as { isOwner?: boolean } : {})
        .then((owner) => {
          if (active) setIsOwner(owner.isOwner === true);
        })
        .catch(() => {
          // Public visitors and ordinary accounts do not see owner controls.
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const ownerEntryAvailable = pathname === "/account";
  const ownerControlVisible = (isOwner || ownerEntryAvailable);
  if (!ownerControlVisible) return null;

  const dockStyle = {
    position: "fixed" as const,
    right: "1rem",
    bottom: "1rem",
    zIndex: 80,
    maxWidth: "min(18rem, calc(100vw - 2rem))",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "1rem",
    background: "rgba(7, 24, 45, .96)",
    boxShadow: "0 1rem 3rem rgba(0,0,0,.3)",
    color: "white",
    padding: ".7rem .85rem",
  };

  const linkStyle = {
    display: "block",
    padding: ".55rem .65rem",
    borderRadius: ".65rem",
    color: "white",
    textDecoration: "none",
  };

  return (
    <details style={dockStyle}>
      <summary style={{ cursor: "pointer", fontWeight: 800 }}>
        {isOwner ? "Owner Tools" : "Owner/admin sign in"}
      </summary>
      <nav aria-label="Tuveloz owner tools" style={{ display: "grid", gap: ".15rem", marginTop: ".55rem" }}>
        <Link href="/admin" style={linkStyle}>
          {isOwner ? "Open Owner Control Center" : "Continue to secure owner sign in"}
        </Link>
        {isOwner && (
          <>
            <Link href="/admin/marketplace-tools" style={linkStyle}>
              Marketplace operations
            </Link>
            <Link href="/admin/test-lab" style={linkStyle}>
              Open Test Lab
            </Link>
          </>
        )}
        {!isOwner && ownerEntryAvailable && (
          <small style={{ display: "block", padding: ".25rem .65rem", opacity: .78, lineHeight: 1.4 }}>
            Cloudflare Access verifies the owner separately. Customer and provider accounts cannot grant owner access.
          </small>
        )}
      </nav>
    </details>
  );
}
