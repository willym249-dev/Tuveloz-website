import { env } from "cloudflare:workers";
import { isVerifiedOwnerRequest } from "../../../../../lib/owner-auth";
import { isSameOriginRequest } from "../../../../../lib/request-security";
import { configuredPrivacyRecoveryJournal, type PrivacyRecoveryEnvironment } from "../../../../../lib/privacy-recovery-config";
import { assertCurrentAuthenticationCatalog } from "../../../../../lib/privacy-erasure-catalog";

const headers = { "cache-control": "private, no-store" };
export async function GET(request: Request) {
  if (!(await isVerifiedOwnerRequest(request)) || !isSameOriginRequest(request)) {
    return Response.json({ error: "Owner access required." }, { status: 403, headers });
  }
  const configured = configuredPrivacyRecoveryJournal(env as typeof env & PrivacyRecoveryEnvironment);
  if (configured.state === "not-configured") {
    return Response.json({ state: "not-configured", deletionEnabled: false,
      message: "Private recovery storage and signing keys still need to be connected. Account data deletion is unavailable." }, { headers });
  }
  if (configured.state === "configured") {
    try {
      const intents = await configured.journal.completedIntents();
      await assertCurrentAuthenticationCatalog(env.DB, intents);
      return Response.json({ state: "read-check-passed", deletionEnabled: false,
        message: "Recovery storage can be read, and its completed deletion records match the database. Write access, recovery procedures and the case review still need verification before deletion can be enabled." }, { headers });
    } catch { /* Return the same safe failure for storage, database and signature errors. */ }
  }
  return Response.json({ state: "needs-review", deletionEnabled: false,
    error: "Recovery setup could not be verified. Keep deletion disabled and review the private configuration and recovery records. Nothing was changed." }, { status: 503, headers });
}
