import { env } from "cloudflare:workers";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

type StoredImage = {
  body: ReadableStream<Uint8Array>;
  httpMetadata?: { contentType?: string };
};

type ImageBucket = {
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

export class ProviderImageValidationError extends Error {}

function getBucket() {
  const bucket = (env as unknown as { BUCKET?: ImageBucket }).BUCKET;
  if (!bucket) throw new Error("Image storage is unavailable.");
  return bucket;
}

function matchesDeclaredImageType(bytes: ArrayBuffer, contentType: string) {
  const data = new Uint8Array(bytes);
  if (contentType === "image/jpeg") {
    return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
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

export async function validateProviderImage(value: unknown) {
  if (!(value instanceof File) || value.size === 0) {
    throw new ProviderImageValidationError("Choose a JPG, PNG, or WebP image.");
  }
  const extension = ALLOWED_IMAGE_TYPES.get(value.type);
  if (!extension) {
    throw new ProviderImageValidationError("Upload a JPG, PNG, or WebP image.");
  }
  if (value.size > MAX_IMAGE_BYTES) {
    throw new ProviderImageValidationError("The image must be 8 MB or smaller.");
  }
  const bytes = await value.arrayBuffer();
  if (!matchesDeclaredImageType(bytes, value.type)) {
    throw new ProviderImageValidationError(
      "That file does not appear to be a valid JPG, PNG, or WebP image.",
    );
  }
  return {
    bytes,
    contentType: value.type,
    extension,
    originalName: value.name.slice(0, 180),
  };
}

export async function storeProviderImage(
  providerId: string,
  kind: "logo" | "gallery",
  image: Awaited<ReturnType<typeof validateProviderImage>>,
) {
  const key = `providers/${providerId}/${kind}/${crypto.randomUUID()}.${image.extension}`;
  await getBucket().put(key, image.bytes, {
    httpMetadata: { contentType: image.contentType },
    customMetadata: {
      kind,
      providerId,
      originalName: image.originalName,
    },
  });
  return key;
}

export async function getProviderImage(key: string) {
  return getBucket().get(key);
}

export async function deleteProviderImage(key: string) {
  await getBucket().delete(key);
}
