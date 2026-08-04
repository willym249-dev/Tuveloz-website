"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Owner access stays separate from customer and provider navigation.
 *
 * Customer and provider workspaces already contain their own role-specific tools,
 * so this global floating control is intentionally hidden from ordinary signed-in
 * users and from public visitors. It only renders after Cloudflare Access has
 * verified the owner session server-side — it never advertises that an owner
 * surface exists to anyone who hasn't already passed that check.
 */
export function AccountToolsDock() {
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

  if (!isOwner) return null;

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
        Owner Tools
      </summary>
      <nav aria-label="Tuveloz owner tools" style={{ display: "grid", gap: ".15rem", marginTop: ".55rem" }}>
        <Link href="/admin" style={linkStyle}>
          Open Owner Control Center
        </Link>
        <Link href="/admin/marketplace-tools" style={linkStyle}>
          Marketplace operations
        </Link>
        <Link href="/admin/test-lab" style={linkStyle}>
          Open Test Lab
        </Link>
      </nav>
    </details>
  );
}
