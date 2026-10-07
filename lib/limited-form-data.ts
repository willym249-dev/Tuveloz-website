import { RequestBodyTooLargeError } from "./limited-json";

export class InvalidFormBodyError extends Error {}

/** Bound the whole upload before multipart parsing, including unused parts. */
export async function readLimitedFormData(request: Request, maximumBytes: number) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.split(";", 1)[0].trim().toLowerCase() !== "multipart/form-data") {
    throw new InvalidFormBodyError();
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength) || !Number.isSafeInteger(Number(declaredLength))) {
      throw new InvalidFormBodyError();
    }
    if (Number(declaredLength) > maximumBytes) {
      void request.body?.cancel().catch(() => undefined);
      throw new RequestBodyTooLargeError();
    }
  }
  if (!request.body) throw new InvalidFormBodyError();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        void reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) throw error;
    throw new InvalidFormBodyError();
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return await new Response(bytes, { headers: { "content-type": contentType } }).formData();
  } catch {
    throw new InvalidFormBodyError();
  }
}
