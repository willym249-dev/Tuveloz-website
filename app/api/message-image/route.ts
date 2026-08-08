import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobMessages } from "../../../db/schema";
import { getAccountSession } from "../../../lib/account-auth";
import { getJobMessageImage } from "../../../lib/job-message-images";

const NO_STORE = { "cache-control": "private, no-store" } as const;

export async function GET(request: Request) {
  const session = await getAccountSession(request);
  if (!session) {
    return Response.json({ error: "Sign in to view this image." }, { status: 401, headers: NO_STORE });
  }
  const url = new URL(request.url);
  const requestId = (url.searchParams.get("requestId") ?? "").trim().slice(0, 100);
  const messageId = (url.searchParams.get("messageId") ?? "").trim().slice(0, 100);
  if (!requestId || !messageId) {
    return Response.json({ error: "Missing image reference." }, { status: 400, headers: NO_STORE });
  }

  const [message] = await getDb().select({
    senderEmail: jobMessages.senderEmail,
    recipientEmail: jobMessages.recipientEmail,
    imageKey: jobMessages.imageKey,
    imageType: jobMessages.imageType,
    scanStatus: jobMessages.scanStatus,
  }).from(jobMessages)
    .where(and(eq(jobMessages.id, messageId), eq(jobMessages.requestId, requestId)))
    .limit(1);

  // Only the two people on the message may view it.
  const viewer = session.email.toLowerCase();
  const participant = message
    && (message.senderEmail.toLowerCase() === viewer || message.recipientEmail.toLowerCase() === viewer);
  if (!message || !participant) {
    return Response.json({ error: "Image not found." }, { status: 404, headers: NO_STORE });
  }

  // Fail-closed: an image is only ever served once a scan has cleared it.
  if (!message.imageKey || message.scanStatus !== "clean") {
    return Response.json({ error: "This image is not available." }, { status: 404, headers: NO_STORE });
  }

  const object = await getJobMessageImage(message.imageKey);
  if (!object) {
    return Response.json({ error: "Image not found." }, { status: 404, headers: NO_STORE });
  }
  return new Response(object.body, {
    headers: {
      "cache-control": "private, no-store",
      "content-type": object.httpMetadata?.contentType || message.imageType || "application/octet-stream",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
    },
  });
}
