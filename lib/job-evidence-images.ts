import { env } from "cloudflare:workers";
import type { validateJobImage } from "./job-images";

type ValidatedJobImage = NonNullable<Awaited<ReturnType<typeof validateJobImage>>>;

type StoredImage = {
  body: ReadableStream<Uint8Array>;
  httpMetadata?: { contentType?: string };
};

type EvidenceBucket = {
  put(
    key: string,
    value: ArrayBuffer,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  get(key: string): Promise<StoredImage | null>;
  delete(key: string): Promise<void>;
};

function bucket() {
  const value = (env as unknown as { BUCKET?: EvidenceBucket }).BUCKET;
  if (!value) throw new Error("Private image storage is unavailable.");
  return value;
}

export async function storeJobEvidenceImage(
  requestId: string,
  evidenceId: string,
  image: ValidatedJobImage,
) {
  const key = `jobs/${requestId}/evidence/${evidenceId}.${image.extension}`;
  await bucket().put(key, image.bytes, {
    httpMetadata: { contentType: image.contentType },
    customMetadata: {
      kind: "job-evidence",
      requestId,
      evidenceId,
      originalName: image.originalName,
    },
  });
  return key;
}

export async function getJobEvidenceImage(key: string) {
  return bucket().get(key);
}

export async function deleteJobEvidenceImage(key: string) {
  await bucket().delete(key);
}
