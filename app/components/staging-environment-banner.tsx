import { headers } from "next/headers";

function isStagingHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase().split(":")[0];
  return normalized === "staging.tuveloz.com"
    || (normalized.endsWith(".workers.dev") && normalized.includes("tuveloz-staging"));
}

export async function StagingEnvironmentBanner() {
  const requestHeaders = await headers();
  const hostname = requestHeaders.get("host") ?? "";

  if (!isStagingHostname(hostname)) return null;

  return (
    <aside
      aria-label="Staging environment notice"
      role="status"
      style={{
        background: "#ff6a00",
        color: "#0a0705",
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
