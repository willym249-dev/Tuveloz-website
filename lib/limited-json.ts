export class RequestBodyTooLargeError extends Error {}

export class InvalidJsonBodyError extends Error {}

export async function readLimitedJsonObject(
  request: Request,
  maximumBytes: number,
) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
  if (contentType !== "application/json") {
    throw new InvalidJsonBodyError("Send this request as JSON.");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (!Number.isFinite(parsedLength) || parsedLength < 0) {
      throw new InvalidJsonBodyError("The request size is invalid.");
    }
    if (parsedLength > maximumBytes) {
      throw new RequestBodyTooLargeError("The request is too large.");
    }
  }

  if (!request.body) {
    throw new InvalidJsonBodyError("The request body is missing.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      totalBytes += result.value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError("The request is too large.");
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new InvalidJsonBodyError("Send one JSON object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof InvalidJsonBodyError) throw error;
    throw new InvalidJsonBodyError("The request body is not valid JSON.");
  }
}
