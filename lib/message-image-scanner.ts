import { env } from "cloudflare:workers";
import { and, asc, eq, ne } from "drizzle-orm";
import { getDb } from "../db";
import { jobMessages } from "../db/schema";
import {
  classifyCloudmersiveAdvancedResult,
  cloudmersiveScannerConfigured,
} from "./cloudmersive-scan-policy";
import { getJobMessageImage } from "./job-message-images";

const SCAN_URL = "https://api.cloudmersive.com/virus/scan/file/advanced";
const SCAN_TIMEOUT_MS = 45_000;
const MAX_RESPONSE_BYTES = 128 * 1024;
const MESSAGE_IMAGE_FILE_TYPES = ".jpg,.jpeg,.png,.webp";

export type MessageImageScanSweep = {
  configured: boolean;
  loaded: number;
  cleared: number;
  blocked: number;
  retryable: number;
};

function scanHeaders(apiKey: string) {
  return {
    Apikey: apiKey,
    allowExecutables: "false",
    allowInvalidFiles: "false",
    allowScripts: "false",
    allowPasswordProtectedFiles: "false",
    allowMacros: "false",
    allowXmlExternalEntities: "false",
    allowInsecureDeserialization: "false",
    allowHtml: "false",
    allowUnsafeArchives: "false",
    allowOleEmbeddedObject: "false",
    allowUnwantedAction: "false",
    options: "blockOfficeXmlOleEmbeddedFile,blockInvalidUris",
    restrictFileTypes: MESSAGE_IMAGE_FILE_TYPES,
  };
}

async function readBoundedResponse(response: Response) {
  const text = await response.text();
  return text.length > MAX_RESPONSE_BYTES ? text.slice(0, MAX_RESPONSE_BYTES) : text;
}

// Returns a terminal "clean" | "blocked", or throws to signal a transient/ambiguous
// result that must leave the message pending for a later sweep (fail-closed).
async function scanBytes(apiKey: string, bytes: ArrayBuffer, contentType: string): Promise<"clean" | "blocked"> {
  const form = new FormData();
  form.append("inputFile", new File([bytes], "attachment", {
    type: contentType || "application/octet-stream",
  }));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("message image scan timeout"), SCAN_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(SCAN_URL, { method: "POST", headers: scanHeaders(apiKey), body: form, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  // Non-2xx never proves the file safe — retry later.
  if (!response.ok) throw new Error(`cloudmersive_http_${response.status}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readBoundedResponse(response));
  } catch {
    throw new Error("cloudmersive_invalid_json");
  }
  const classification = classifyCloudmersiveAdvancedResult(parsed);
  if (!classification.terminal) throw new Error(`cloudmersive_ambiguous_${classification.reason}`);
  return classification.status === "clean" ? "clean" : "blocked";
}

/**
 * Clears or blocks pending message-image attachments. When the scanner is not
 * configured this is a no-op, so attachments stay 'pending' and are never served
 * or shown — the fail-closed default until scanning is turned on.
 */
export async function processPendingMessageImageScans(batchSize = 5): Promise<MessageImageScanSweep> {
  const runtime = env as unknown as Record<string, unknown>;
  if (!cloudmersiveScannerConfigured(runtime)) {
    return { configured: false, loaded: 0, cleared: 0, blocked: 0, retryable: 0 };
  }
  const apiKey = typeof runtime.CLOUDMERSIVE_API_KEY === "string" ? runtime.CLOUDMERSIVE_API_KEY.trim() : "";
  const db = getDb();
  const pending = await db.select({
    id: jobMessages.id,
    imageKey: jobMessages.imageKey,
    imageType: jobMessages.imageType,
  }).from(jobMessages)
    .where(and(eq(jobMessages.scanStatus, "pending"), ne(jobMessages.imageKey, "")))
    .orderBy(asc(jobMessages.createdAt))
    .limit(Math.max(1, Math.min(20, Math.trunc(batchSize))));

  let cleared = 0;
  let blocked = 0;
  let retryable = 0;
  for (const row of pending) {
    const object = await getJobMessageImage(row.imageKey);
    if (!object) {
      // A pending row with no object can never be safely shown.
      await db.update(jobMessages).set({ scanStatus: "blocked" })
        .where(and(eq(jobMessages.id, row.id), eq(jobMessages.scanStatus, "pending")));
      blocked += 1;
      continue;
    }
    let verdict: "clean" | "blocked";
    try {
      verdict = await scanBytes(apiKey, await object.arrayBuffer(), row.imageType);
    } catch (error) {
      // Transient/ambiguous — leave pending, retry next sweep.
      retryable += 1;
      console.error(`Message image ${row.id} scan not terminal`, error);
      continue;
    }
    await db.update(jobMessages).set({ scanStatus: verdict })
      .where(and(eq(jobMessages.id, row.id), eq(jobMessages.scanStatus, "pending")));
    if (verdict === "clean") cleared += 1;
    else blocked += 1;
  }

  return { configured: true, loaded: pending.length, cleared, blocked, retryable };
}
