"use client";

import { useEffect, useState } from "react";

function isStagingHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "staging.tuveloz.com"
    || (normalized.endsWith(".workers.dev") && normalized.includes("tuveloz-staging"));
}

export function StagingEnvironmentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(isStagingHostname(window.location.hostname));
  }, []);

  if (!visible) return null;

  return (
    <aside
      aria-label="Staging environment notice"
      role="status"
      style={{
        background: "#ff6a00",
        color: "#07182d",
        fontSize: ".82rem",
        fontWeight: 900,
        letterSpacing: ".04em",
        lineHeight: 1.4,
        padding: ".7rem 1rem",
        textAlign: "center",
        textTransform: "uppercase",
      }}
    >
      Test mode — admin staging site. No real payments, emails, customer jobs, or provider notifications.
    </aside>
  );
}
