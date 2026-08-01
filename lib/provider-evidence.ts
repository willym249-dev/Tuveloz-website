import { env } from "cloudflare:workers";

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

type StoredEvidence = {
  body: ReadableStream<Uint8Array>;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
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
  get(key: string): Promise<StoredEvidence | null>;
  delete(key: string): Promise<void>;
};

export class ProviderEvidenceValidationError extends Error {}

function getBucket() {
  const bucket = (env as unknown as { BUCKET?: EvidenceBucket }).BUCKET;
  if (!bucket) throw new Error("Private evidence storage is unavailable.");
  return bucket;
}

function hasSignature(bytes: ArrayBuffer, contentType: string) {
  const data = new Uint8Array(bytes);
  if (contentType === "application/pdf") {
    return data.length >= 5
      && String.fromCharCode(...data.slice(0, 5)) === "%PDF-";
  }
  if (contentType === "image/jpeg") {
    return data.length >= 3
      && data[0] === 0xff
      && data[1] === 0xd8
      && data[2] === 0xff;
  }
  if (contentType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return data.length >= signature.length
      && signature.every((byte, index) => data[index] === byte);
  }
  if (contentType === "image/webp") {
    return data.length >= 12
      && String.fromCharCode(...data.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...data.slice(8, 12)) === "WEBP";
  }
  return false;
}

function safeOriginalName(name: string) {
  return name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "-")
    .trim()
    .slice(0, 160) || "evidence";
}

export async function validateProviderEvidence(value: unknown) {
  if (!(value instanceof File) || value.size === 0) {
    throw new ProviderEvidenceValidationError(
      "Choose a PDF, JPG, PNG, or WebP document.",
    );
  }
  const extension = ALLOWED_EVIDENCE_TYPES.get(value.type);
  if (!extension) {
    throw new ProviderEvidenceValidationError(
      "Upload a PDF, JPG, PNG, or WebP document.",
    );
  }
  if (value.size > MAX_EVIDENCE_BYTES) {
    throw new ProviderEvidenceValidationError(
      "The document must be 10 MB or smaller.",
    );
  }
  const bytes = await value.arrayBuffer();
  if (!hasSignature(bytes, value.type)) {
    throw new ProviderEvidenceValidationError(
      "The file contents do not match the selected document type.",
    );
  }
  return {
    bytes,
    size: value.size,
    contentType: value.type,
    extension,
    originalName: safeOriginalName(value.name),
  };
}

export async function storeProviderEvidence(
  providerId: string,
  evidenceType: string,
  document: Awaited<ReturnType<typeof validateProviderEvidence>>,
) {
  const key = `provider-evidence/${providerId}/${crypto.randomUUID()}.${document.extension}`;
  await getBucket().put(key, document.bytes, {
    httpMetadata: { contentType: document.contentType },
    customMetadata: {
      providerId,
      evidenceType,
      originalName: document.originalName,
      access: "private",
    },
  });
  return key;
}

export async function getProviderEvidence(key: string) {
  if (!key.startsWith("provider-evidence/")) return null;
  return getBucket().get(key);
}

export async function deleteProviderEvidence(key: string) {
  if (!key.startsWith("provider-evidence/")) return;
  await getBucket().delete(key);
}
