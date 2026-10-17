import { privacyFileReview } from "./privacy-file-review";
import type { PrivacyFileReview } from "./privacy-file-review";

// Metadata only, against the existing upload bucket. Never list, download or
// mutate objects. Keep each owner refresh bounded even when storage stalls.
export const PRIVACY_STORAGE_OBJECT_LIMIT = 20;
const DEADLINE_MS = 3000;
type StorageState = NonNullable<PrivacyFileReview["items"][number]["storage"]>;
type HeadOnlyBucket = { head(key: string): Promise<unknown> };

export async function checkPrivacyFileStorage(value: string | undefined, bucket?: HeadOnlyBucket): Promise<PrivacyFileReview> {
  const review = privacyFileReview(value);
  // Validation above precedes every storage call. These keys never leave this
  // server function. The extra truncation sentinel is deliberately excluded.
  const rows = (JSON.parse(value!) as { objectKey: string }[]).slice(0, review.items.length);
  const keys = [...new Set(rows.map(row => row.objectKey))];
  const selected = keys.slice(0, PRIVACY_STORAGE_OBJECT_LIMIT);
  const states = new Map<string, StorageState>();
  const startedAt = new Date().toISOString();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  let next = 0;
  const deadline = new Promise<"unavailable">(resolve => {
    timer = setTimeout(() => { expired = true; resolve("unavailable"); }, DEADLINE_MS);
  });
  const inspect = async (key: string): Promise<StorageState> => {
    try {
      const object = await bucket!.head(key);
      if (object === null) return "missing";
      // An absent/malformed reply or wrong key is uncertainty, never absence.
      if (typeof object !== "object" || !object) return "unavailable";
      const metadata = object as { key?: unknown; version?: unknown; size?: unknown };
      return metadata.key === key && typeof metadata.version === "string" && metadata.version.length > 0
        && typeof metadata.size === "number" && Number.isSafeInteger(metadata.size) && metadata.size >= 0
        ? "found" : "unavailable";
    } catch { return "unavailable"; }
  };
  try {
    if (bucket && typeof bucket.head === "function") {
      await Promise.all(Array.from({ length: Math.min(4, selected.length) }, async () => {
        while (!expired && next < selected.length) {
          const key = selected[next++];
          states.set(key, await Promise.race([inspect(key), deadline]));
        }
      }));
    }
    review.items = review.items.map((item, index) => ({ ...item,
      storage: states.get(rows[index].objectKey)
        ?? (selected.includes(rows[index].objectKey) ? "unavailable" : "not-checked"),
    }));
    review.storageChecked = review.items.length > 0 && !review.truncated
      && review.items.every(item => item.storage === "found" || item.storage === "missing");
    review.storageCheck = { startedAt, finishedAt: new Date().toISOString(), objectLimit: PRIVACY_STORAGE_OBJECT_LIMIT };
    return review;
  } finally { clearTimeout(timer); }
}
