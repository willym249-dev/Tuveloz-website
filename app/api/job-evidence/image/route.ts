import { env } from "cloudflare:workers";
import { getAccountSession, providerAccountFor } from "../../../../lib/account-auth";
import { getJobEvidenceImage } from "../../../../lib/job-evidence-images";

type EvidenceImageRow = {
  imageKey: string;
  imageType: string;
  providerEmail: string;
  customerEmail: string;
};

function cleanEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function GET(request: Request) {
  const session = await getAccountSession(request);
  if (!session || (session.role !== "customer" && session.role !== "provider")) {
    return Response.json({ error: "Sign in to view this private image." }, { status: 401 });
  }
  if (session.role === "provider" && !(await providerAccountFor(session.email))) {
    return Response.json({ error: "Verified provider access is required." }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id")?.trim().slice(0, 100) ?? "";
  if (!id) return Response.json({ error: "Private image record not found." }, { status: 404 });
  const row = await env.DB.prepare(
    `SELECT evidence.image_key AS imageKey,
            evidence.image_type AS imageType,
            evidence.provider_email AS providerEmail,
            evidence.customer_email AS customerEmail
       FROM job_evidence_items evidence
       INNER JOIN customer_requests request
         ON request.id = evidence.request_id
      WHERE evidence.id = ?
        AND EXISTS (
          SELECT 1
            FROM provider_applications provider
           WHERE lower(provider.email) = lower(evidence.provider_email)
             AND provider.is_test_provider = request.is_test_job
        )
      LIMIT 1`,
  ).bind(id).first<EvidenceImageRow>();
  if (!row?.imageKey) {
    return Response.json({ error: "Private image record not found." }, { status: 404 });
  }

  const email = cleanEmail(session.email);
  const authorized = session.role === "provider"
    ? cleanEmail(row.providerEmail) === email
    : cleanEmail(row.customerEmail) === email;
  if (!authorized) {
    return Response.json({ error: "This private image does not belong to your account." }, { status: 403 });
  }

  const image = await getJobEvidenceImage(row.imageKey);
  if (!image) return Response.json({ error: "Private image file is unavailable." }, { status: 404 });
  return new Response(image.body, {
    headers: {
      "content-type": image.httpMetadata?.contentType || row.imageType || "application/octet-stream",
      "content-disposition": "inline",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
