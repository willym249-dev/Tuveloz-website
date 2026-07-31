"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AccountSummary = {
  role?: "customer" | "provider";
};

export function AccountToolsDock() {
  const pathname = usePathname();
  const [role, setRole] = useState<"customer" | "provider" | "">("");
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void Promise.all([
        fetch("/api/account", { cache: "no-store" })
          .then(async (response) => response.ok ? await response.json() as AccountSummary : {}),
        fetch("/api/owner-access", { cache: "no-store" })
          .then(async (response) => response.ok ? await response.json() as { isOwner?: boolean } : {}),
      ]).then(([account, owner]) => {
        if (!active) return;
        setRole(account.role === "customer" || account.role === "provider" ? account.role : "");
        setIsOwner(owner.isOwner === true);
      }).catch(() => {
        // Public visitors simply do not see private account shortcuts.
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!role) return;
    const deliver = () => {
      void fetch("/api/notifications", { cache: "no-store" }).catch(() => undefined);
    };
    const timer = window.setTimeout(deliver, 0);
    const interval = window.setInterval(deliver, 20_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [role]);

  const ownerEntryAvailable = pathname === "/account";
  if (!role && !isOwner && !ownerEntryAvailable) return null;

  const dockStyle = {
    position: "fixed" as const,
    right: "1rem",
    bottom: "1rem",
    zIndex: 80,
    maxWidth: "min(22rem, calc(100vw - 2rem))",
    maxHeight: "75vh",
    overflow: "auto" as const,
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
        {isOwner
          ? "Tuveloz account & admin tools"
          : role
            ? "Tuveloz account tools"
            : "Tuveloz owner access"}
      </summary>
      <nav aria-label="Tuveloz account tools" style={{ display: "grid", gap: ".15rem", marginTop: ".55rem" }}>
        {role === "customer" && (
          <>
            <Link href="/customer" style={linkStyle}>Customer workspace</Link>
            <Link href="/appointments" style={linkStyle}>Appointments</Link>
            <Link href="/tracking" style={linkStyle}>Provider tracking & job status</Link>
            <Link href="/job-authorizations" style={linkStyle}>Job agreements</Link>
            <Link href="/job-authorizations/documents" style={linkStyle}>Estimates, invoices & receipts</Link>
            <Link href="/service-reminders" style={linkStyle}>Service history & reminders</Link>
            <Link href="/notifications" style={linkStyle}>Notifications</Link>
          </>
        )}
        {role === "provider" && (
          <>
            <Link href="/provider-jobs" style={linkStyle}>Provider workspace</Link>
            <Link href="/provider-jobs/toolkit" style={linkStyle}>Quote templates</Link>
            <Link href="/provider-services" style={linkStyle}>Services, prices & credentials</Link>
            <Link href="/provider-service-area" style={linkStyle}>Service area</Link>
            <Link href="/appointments" style={linkStyle}>Appointments</Link>
            <Link href="/tracking" style={linkStyle}>Share trip location</Link>
            <Link href="/job-authorizations" style={linkStyle}>Job agreements & change orders</Link>
            <Link href="/job-authorizations/documents" style={linkStyle}>Invoices & job documents</Link>
            <Link href="/notifications" style={linkStyle}>Notifications</Link>
          </>
        )}
        {(isOwner || ownerEntryAvailable) && (
          <>
            <hr style={{ border: 0, borderTop: "1px solid rgba(255,255,255,.18)", width: "100%" }} />
            <Link href="/admin" style={linkStyle}>
              {isOwner ? "Owner admin dashboard" : "Owner/admin sign in"}
            </Link>
            {isOwner && (
              <Link href="/admin/marketplace-tools" style={linkStyle}>Appointments & credential review</Link>
            )}
            {!isOwner && ownerEntryAvailable && (
              <small style={{ display: "block", padding: ".25rem .65rem", opacity: .78, lineHeight: 1.4 }}>
                Admin access uses separate Cloudflare Access owner verification. A customer or provider sign-in does not grant admin rights.
              </small>
            )}
          </>
        )}
      </nav>
    </details>
  );
}
