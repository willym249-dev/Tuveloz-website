import { env } from "cloudflare:workers";
import { recordAuthenticatedEvidenceScanResult } from "../../../../lib/evidence-scan-result-recorder";
import { selfHostedScanHandler } from "../../../../lib/self-hosted-scan-protocol";

export async function POST(request: Request) {
  const runtime = env as unknown as Record<string, unknown>;
  return selfHostedScanHandler({
    provider: typeof runtime.EVIDENCE_SCAN_PROVIDER === "string" ? runtime.EVIDENCE_SCAN_PROVIDER : "",
    secret: typeof runtime.SELF_HOSTED_SCAN_SECRET === "string" ? runtime.SELF_HOSTED_SCAN_SECRET : "",
    db: env.DB,
    bucket: env.BUCKET,
    recordEvidence: recordAuthenticatedEvidenceScanResult,
  })(request);
}
