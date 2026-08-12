import { env } from "cloudflare:workers";
import type { validateJobImage } from "./job-images";

type ValidatedJobImage = NonNullable<Awaited<ReturnType<typeof validateJobImage>>>;

function bucket() {
  const store = env.BUCKET;
  if (!store) throw new Error("Image storage is not configured.");
  return store;
}

// Message attachments live under their own prefix so they are never confused
// with issue/completion or evidence images.
export async function storeJobMessageImage(
  requestId: string,
  messageId: string,
  image: ValidatedJobImage,
) {
  const key = `jobs/${requestId}/messages/${messageId}.${image.extension}`;
  await bucket().put(key, image.bytes, {
    httpMetadata: { contentType: image.contentType },
    customMetadata: { kind: "job-message", requestId, messageId, originalName: image.originalName },
  });
  return key;
}

export function getJobMessageImage(key: string) {
  return bucket().get(key);
}

export function deleteJobMessageImage(key: string) {
  return bucket().delete(key);
}
