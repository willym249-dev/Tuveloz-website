const MAX_SOURCE_OBJECTS = 250;
const MAX_DELETE_KEYS = 1000;
const MAX_ERROR_TEXT = 600;

export type BackupHttpMetadata = {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
};

export type BackupObject = {
  key: string;
  size: number;
  etag: string;
  uploaded: Date;
  httpMetadata?: BackupHttpMetadata;
  customMetadata?: Record<string, string>;
};

export type BackupObjectBody = BackupObject & {
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
};

export type BackupBucket = {
  list(options?: {
    prefix?: string;
    cursor?: string;
    limit?: number;
    include?: Array<"httpMetadata" | "customMetadata">;
  }): Promise<{
    objects: BackupObject[];
    truncated: boolean;
    cursor?: string;
  }>;
  get(key: string): Promise<BackupObjectBody | null>;
  head(key: string): Promise<BackupObject | null>;
  put(key: string, value: ArrayBuffer | ReadableStream | string, options?: {
    httpMetadata?: BackupHttpMetadata;
    customMetadata?: Record<string, string>;
  }): Promise<BackupObject>;
  delete(keys: string | string[]): Promise<void>;
};

export type SourceObjectDescriptor = {
  key: string;
  size: number;
  etag: string;
  uploaded: string;
  httpMetadata?: Omit<BackupHttpMetadata, "cacheExpiry"> & { cacheExpiry?: string };
  customMetadata?: Record<string, string>;
};

export type CopiedObject = SourceObjectDescriptor & {
  sha256: string;
  backupKey: string;
};

export type DatabaseBackup = {
  bookmark: string;
  backupKey: string;
  size: number;
  etag: string;
};

export type ProductionBackupManifest = {
  version: 1;
  createdAt: string;
  retentionDays: number;
  database: DatabaseBackup;
  objects: CopiedObject[];
};

type ExportDownload = {
  signed_url?: string;
  filename?: string;
};

type ExportResult = {
  at_bookmark?: string;
  error?: string;
  messages?: string[];
  result?: ExportDownload;
  status?: "complete" | "error";
  success?: boolean;
  type?: "export";
};

type CloudflareEnvelope = {
  success?: boolean;
  result?: ExportResult;
  errors?: Array<{ code?: number; message?: string }>;
};

function safeErrorText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_ERROR_TEXT);
}

function safeKeySegment(value: string, fallback: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 160);
  return cleaned || fallback;
}

function sourceKeySegment(value: string) {
  const encoded = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of encoded) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function metadataForManifest(metadata?: BackupHttpMetadata): SourceObjectDescriptor["httpMetadata"] {
  if (!metadata) return undefined;
  const { cacheExpiry, ...rest } = metadata;
  return {
    ...rest,
    ...(cacheExpiry ? { cacheExpiry: cacheExpiry.toISOString() } : {}),
  };
}

function metadataForRestore(metadata?: SourceObjectDescriptor["httpMetadata"]): BackupHttpMetadata | undefined {
  if (!metadata) return undefined;
  const { cacheExpiry, ...rest } = metadata;
  return {
    ...rest,
    ...(cacheExpiry ? { cacheExpiry: new Date(cacheExpiry) } : {}),
  };
}

async function sha256Hex(value: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function cloudflareEnvelope(response: Response, label: string): Promise<CloudflareEnvelope> {
  const body = await response.text();
  let envelope: CloudflareEnvelope;
  try {
    envelope = JSON.parse(body) as CloudflareEnvelope;
  } catch {
    throw new Error(`${label} returned HTTP ${response.status} with invalid JSON.`);
  }
  if (!response.ok || envelope.success === false) {
    const detail = envelope.errors?.map((error) => error.message || error.code).filter(Boolean).join("; ");
    throw new Error(`${label} failed with HTTP ${response.status}. ${safeErrorText(detail)}`.trim());
  }
  return envelope;
}

export function validateBackupSettings(input: {
  accountId: string;
  databaseId: string;
  apiToken: string;
  retentionDays: string | number;
}) {
  const accountId = input.accountId.trim();
  const databaseId = input.databaseId.trim();
  const apiToken = input.apiToken.trim();
  const retentionDays = Number(input.retentionDays);
  if (!/^[a-f0-9]{32}$/i.test(accountId)) throw new Error("BACKUP_ACCOUNT_ID is invalid.");
  if (!/^[a-f0-9-]{36}$/i.test(databaseId)) throw new Error("BACKUP_DATABASE_ID is invalid.");
  if (!apiToken) throw new Error("D1_BACKUP_API_TOKEN is not configured.");
  if (!Number.isInteger(retentionDays) || retentionDays < 7 || retentionDays > 90) {
    throw new Error("BACKUP_RETENTION_DAYS must be a whole number from 7 through 90.");
  }
  return { accountId, databaseId, apiToken, retentionDays };
}

export async function beginD1Export(
  fetchImpl: typeof fetch,
  settings: ReturnType<typeof validateBackupSettings>,
) {
  const response = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${settings.accountId}/d1/database/${settings.databaseId}/export`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${settings.apiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ output_format: "polling" }),
    },
  );
  const envelope = await cloudflareEnvelope(response, "D1 export start");
  const exportResult = envelope.result;
  if (exportResult?.status === "error" || exportResult?.success === false) {
    throw new Error(`D1 export start failed. ${safeErrorText(exportResult.error)}`.trim());
  }
  const bookmark = exportResult?.at_bookmark?.trim();
  if (!bookmark) throw new Error("D1 export start did not return an at_bookmark value.");
  return bookmark;
}

export async function finishD1Export(
  fetchImpl: typeof fetch,
  settings: ReturnType<typeof validateBackupSettings>,
  bookmark: string,
  destination: BackupBucket,
  createdAt: Date,
): Promise<DatabaseBackup> {
  const exportUrl = `https://api.cloudflare.com/client/v4/accounts/${settings.accountId}/d1/database/${settings.databaseId}/export`;
  const response = await fetchImpl(exportUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${settings.apiToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ output_format: "polling", current_bookmark: bookmark }),
  });
  const envelope = await cloudflareEnvelope(response, "D1 export status");
  const exportResult = envelope.result;
  if (exportResult?.status === "error" || exportResult?.success === false) {
    throw new Error(`D1 export failed. ${safeErrorText(exportResult.error)}`.trim());
  }
  const signedUrl = exportResult?.result?.signed_url?.trim();
  if (!signedUrl) {
    if (exportResult?.status === "complete") {
      throw new Error("D1 export completed without a signed download URL.");
    }
    throw new Error("D1 export is still preparing its signed download URL.");
  }

  const download = await fetchImpl(signedUrl, {
    headers: { "user-agent": "Tuveloz-Production-Backup" },
  });
  if (!download.ok || !download.body) {
    throw new Error(`D1 export download failed with HTTP ${download.status}.`);
  }
  const date = createdAt.toISOString().slice(0, 10);
  const filename = safeKeySegment(exportResult?.result?.filename || `${bookmark}.sql`, "database.sql");
  const backupKey = `d1/${date}/${filename}`;
  await destination.put(backupKey, download.body, {
    httpMetadata: { contentType: "application/sql" },
    customMetadata: {
      bookmark,
      createdAt: createdAt.toISOString(),
      databaseId: settings.databaseId,
    },
  });
  const stored = await destination.head(backupKey);
  if (!stored || stored.size <= 0) throw new Error("The stored D1 export is missing or empty.");
  return { bookmark, backupKey, size: stored.size, etag: stored.etag };
}

async function listAll(bucket: BackupBucket, prefix = "") {
  const objects: BackupObject[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({
      prefix,
      cursor,
      limit: 1000,
      include: ["httpMetadata", "customMetadata"],
    });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
}

export async function listSourceObjects(bucket: BackupBucket): Promise<SourceObjectDescriptor[]> {
  const objects = await listAll(bucket);
  if (objects.length > MAX_SOURCE_OBJECTS) {
    throw new Error(
      `The private upload bucket has ${objects.length} objects; the current backup limit is ${MAX_SOURCE_OBJECTS}. ` +
      "Increase capacity deliberately before a partial backup can occur.",
    );
  }
  return objects
    .map((object) => ({
      key: object.key,
      size: object.size,
      etag: object.etag,
      uploaded: object.uploaded.toISOString(),
      httpMetadata: metadataForManifest(object.httpMetadata),
      customMetadata: object.customMetadata,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export async function copySourceObject(
  source: BackupBucket,
  destination: BackupBucket,
  descriptor: SourceObjectDescriptor,
): Promise<CopiedObject> {
  const object = await source.get(descriptor.key);
  if (!object) throw new Error(`Source object disappeared during backup: ${descriptor.key}`);
  if (object.etag !== descriptor.etag || object.size !== descriptor.size) {
    throw new Error(`Source object changed during backup: ${descriptor.key}`);
  }
  const bytes = await object.arrayBuffer();
  if (bytes.byteLength !== descriptor.size) {
    throw new Error(`Source object size changed while reading: ${descriptor.key}`);
  }
  const sha256 = await sha256Hex(bytes);
  const backupKey = `objects/${sourceKeySegment(descriptor.key)}/${sha256}`;
  const existing = await destination.head(backupKey);
  if (existing) {
    if (existing.size !== descriptor.size || existing.customMetadata?.sha256 !== sha256) {
      throw new Error(`Existing backup object failed its integrity metadata check: ${backupKey}`);
    }
  } else {
    const stored = await destination.put(backupKey, bytes, {
      httpMetadata: metadataForRestore(descriptor.httpMetadata),
      customMetadata: {
        sha256,
        sourceEtag: descriptor.etag,
        sourceUploaded: descriptor.uploaded,
      },
    });
    if (stored.size !== descriptor.size) {
      throw new Error(`Backup object size verification failed: ${backupKey}`);
    }
  }
  return { ...descriptor, sha256, backupKey };
}

export async function writeBackupManifest(
  destination: BackupBucket,
  instanceId: string,
  createdAt: Date,
  retentionDays: number,
  database: DatabaseBackup,
  objects: CopiedObject[],
) {
  const manifest: ProductionBackupManifest = {
    version: 1,
    createdAt: createdAt.toISOString(),
    retentionDays,
    database,
    objects,
  };
  const date = createdAt.toISOString().slice(0, 10);
  const key = `manifests/${date}/${safeKeySegment(instanceId, "scheduled")}.json`;
  await destination.put(key, `${JSON.stringify(manifest)}\n`, {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { createdAt: manifest.createdAt, version: String(manifest.version) },
  });
  return { key, manifest };
}

function dateFromKey(key: string, prefix: string) {
  if (!key.startsWith(prefix)) return null;
  const day = key.slice(prefix.length).split("/", 1)[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const parsed = Date.parse(`${day}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function cutoffFor(createdAt: Date, retentionDays: number) {
  const day = Date.UTC(createdAt.getUTCFullYear(), createdAt.getUTCMonth(), createdAt.getUTCDate());
  return day - retentionDays * 24 * 60 * 60 * 1000;
}

export async function enforceBackupRetention(
  bucket: BackupBucket,
  createdAt: Date,
  retentionDays: number,
) {
  const cutoff = cutoffFor(createdAt, retentionDays);
  const manifests = await listAll(bucket, "manifests/");
  const retainedManifests = manifests.filter((object) => {
    const date = dateFromKey(object.key, "manifests/");
    return date === null || date >= cutoff;
  });
  const referencedObjects = new Set<string>();
  for (const manifestObject of retainedManifests) {
    const stored = await bucket.get(manifestObject.key);
    if (!stored) throw new Error(`Retained backup manifest is missing: ${manifestObject.key}`);
    let manifest: ProductionBackupManifest;
    try {
      manifest = JSON.parse(await stored.text()) as ProductionBackupManifest;
    } catch {
      throw new Error(`Retained backup manifest is not valid JSON: ${manifestObject.key}`);
    }
    if (manifest.version !== 1 || !Array.isArray(manifest.objects)) {
      throw new Error(`Retained backup manifest has an unsupported shape: ${manifestObject.key}`);
    }
    for (const object of manifest.objects) {
      if (typeof object.backupKey !== "string" || !object.backupKey.startsWith("objects/")) {
        throw new Error(`Retained backup manifest has an invalid object reference: ${manifestObject.key}`);
      }
      referencedObjects.add(object.backupKey);
    }
  }

  const [databaseBackups, objectBackups] = await Promise.all([
    listAll(bucket, "d1/"),
    listAll(bucket, "objects/"),
  ]);
  const obsolete = [
    ...manifests
      .filter((object) => {
        const date = dateFromKey(object.key, "manifests/");
        return date !== null && date < cutoff;
      })
      .map((object) => object.key),
    ...databaseBackups
      .filter((object) => {
        const date = dateFromKey(object.key, "d1/");
        return date !== null && date < cutoff;
      })
      .map((object) => object.key),
    ...objectBackups
      .filter((object) => !referencedObjects.has(object.key))
      .map((object) => object.key),
  ];
  // R2 accepts at most 1,000 keys per delete call. A backlog can exceed that
  // even with the source-object cap because each file can have many versions.
  for (let index = 0; index < obsolete.length; index += MAX_DELETE_KEYS) {
    await bucket.delete(obsolete.slice(index, index + MAX_DELETE_KEYS));
  }
  return {
    deleted: obsolete.length,
    retainedManifests: retainedManifests.length,
    retainedObjectVersions: referencedObjects.size,
  };
}
