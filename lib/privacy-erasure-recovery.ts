// Private recovery journal, stored outside any database being restored.
// No deployment binding, public route or account access is enabled here.
export type RecoveryStore = {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  put(key: string, body: string, options: { onlyIf: { etagDoesNotMatch: string }; httpMetadata: { contentType: string } }): Promise<unknown>;
  list(options: { prefix: string; cursor?: string; limit: number }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
};
export type AuthErasureIntent = {
  requestId: string; email: string; snapshotDigest: string; approvedBy: string;
  caseReference: string; recoveryReference: string; closureCaseReference: string;
  closedAt: string; reviewAfter: string;
};
type RecordBody = { version: 1; context: string; kind: "intent"; intent: AuthErasureIntent }
  | { version: 1; context: string; kind: "complete"; intentHash: string };
type Envelope = { keyId: string; body: RecordBody; signature: string };
const encoder = new TextEncoder();
const digest = async (value: string) => hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
const hex = (value: ArrayBuffer) => Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, "0")).join("");
const problem = () => new Error("Private erasure recovery evidence is missing, incomplete or invalid.");
const nonempty = (value: unknown, max = 200) => typeof value === "string" && value.trim().length > 0 && value.length <= max;

function validateIntent(value: AuthErasureIntent) {
  if (!value || !nonempty(value.requestId, 100) || !nonempty(value.email, 320)
    || value.email !== value.email.trim().toLowerCase() || !value.email.includes("@")
    || !/^[a-f0-9]{64}$/.test(value.snapshotDigest) || !nonempty(value.approvedBy, 320)
    || ![value.caseReference, value.recoveryReference, value.closureCaseReference].every(item => nonempty(item) && item.trim().length >= 8)
    || !nonempty(value.closedAt, 40) || !/^\d{4}-\d{2}-\d{2}$/.test(value.reviewAfter)) throw problem();
}
function orderedIntent(value: AuthErasureIntent): AuthErasureIntent {
  validateIntent(value);
  return { requestId: value.requestId, email: value.email, snapshotDigest: value.snapshotDigest,
    approvedBy: value.approvedBy, caseReference: value.caseReference, recoveryReference: value.recoveryReference,
    closureCaseReference: value.closureCaseReference, closedAt: value.closedAt, reviewAfter: value.reviewAfter };
}

export class AuthErasureRecoveryJournal {
  readonly prefix: string;
  constructor(private store: RecoveryStore, private context: string, private signingKeyId: string,
    private keys: Readonly<Record<string, string>>) {
    if (!/^[a-z0-9-]{3,80}$/.test(context) || !/^[a-zA-Z0-9_-]{1,64}$/.test(signingKeyId)
      || typeof keys[signingKeyId] !== "string" || keys[signingKeyId].length < 32) throw problem();
    this.prefix = `privacy-erasure/v1/${context}/`;
  }
  private async key(id: string) {
    const secret = this.keys[id];
    if (typeof secret !== "string" || secret.length < 32) throw problem();
    return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  }
  private async id(requestId: string, snapshotDigest: string) {
    return digest(JSON.stringify(["authentication-records-v1", this.context, requestId, snapshotDigest]));
  }
  private async read(key: string): Promise<RecordBody | null> {
    const object = await this.store.get(key);
    if (!object) return null;
    const raw = await object.text();
    if (raw.length > 8192) throw problem();
    let envelope: Envelope;
    try { envelope = JSON.parse(raw) as Envelope; } catch { throw problem(); }
    if (!envelope || typeof envelope.keyId !== "string" || !envelope.body
      || !/^[a-f0-9]{64}$/.test(envelope.signature)) throw problem();
    const valid = await crypto.subtle.verify("HMAC", await this.key(envelope.keyId),
      Uint8Array.from(envelope.signature.match(/../g)!, byte => parseInt(byte, 16)),
      encoder.encode(JSON.stringify(envelope.body)));
    if (!valid || envelope.body.version !== 1 || envelope.body.context !== this.context) throw problem();
    if (envelope.body.kind === "intent") validateIntent(envelope.body.intent);
    else if (envelope.body.kind !== "complete" || !/^[a-f0-9]{64}$/.test(envelope.body.intentHash)) throw problem();
    return envelope.body;
  }
  private async saveOnce(key: string, body: RecordBody) {
    const signature = hex(await crypto.subtle.sign("HMAC", await this.key(this.signingKeyId), encoder.encode(JSON.stringify(body))));
    // A lost PUT reply is safe only when a fresh read verifies the exact record.
    try { await this.store.put(key, JSON.stringify({ keyId: this.signingKeyId, body, signature }),
      { onlyIf: { etagDoesNotMatch: "*" }, httpMetadata: { contentType: "application/json" } }); } catch { /* reconcile below */ }
    const saved = await this.read(key);
    if (!saved || JSON.stringify(saved) !== JSON.stringify(body)) throw problem();
  }
  async prepare(value: AuthErasureIntent) {
    const intent = orderedIntent(value);
    const id = await this.id(intent.requestId, intent.snapshotDigest);
    await this.saveOnce(`${this.prefix}${id}/intent.json`, { version: 1, context: this.context, kind: "intent", intent });
  }
  async confirm(value: AuthErasureIntent) {
    const intent = orderedIntent(value), id = await this.id(intent.requestId, intent.snapshotDigest);
    const stored = await this.read(`${this.prefix}${id}/intent.json`);
    if (!stored || stored.kind !== "intent" || JSON.stringify(stored.intent) !== JSON.stringify(intent)) throw problem();
    await this.saveOnce(`${this.prefix}${id}/complete.json`, { version: 1, context: this.context, kind: "complete",
      intentHash: await digest(JSON.stringify(stored)) });
  }
  async completedIntents() {
    const keys = new Set<string>(), cursors = new Set<string>();
    let cursor: string | undefined;
    let pages = 0;
    do {
      if (++pages > 100) throw problem();
      const page = await this.store.list({ prefix: this.prefix, cursor, limit: 100 });
      for (const object of page.objects) {
        if (!object.key.startsWith(this.prefix) || !/^[a-f0-9]{64}\/(intent|complete)\.json$/.test(object.key.slice(this.prefix.length))) throw problem();
        keys.add(object.key);
        if (keys.size > 2000) throw problem();
      }
      if (!page.truncated) break;
      if (!page.cursor || cursors.has(page.cursor)) throw problem();
      cursors.add(page.cursor); cursor = page.cursor;
    } while (true);
    const result: AuthErasureIntent[] = [];
    // Validate the entire catalog before a caller is allowed to replay any row.
    for (const key of keys) {
      if (!key.endsWith("/intent.json")) {
        if (!keys.has(key.replace(/complete\.json$/, "intent.json"))) throw problem();
        continue;
      }
      const intent = await this.read(key), completion = await this.read(key.replace(/intent\.json$/, "complete.json"));
      if (!intent || intent.kind !== "intent" || !completion || completion.kind !== "complete"
        || completion.intentHash !== await digest(JSON.stringify(intent))
        || key !== `${this.prefix}${await this.id(intent.intent.requestId, intent.intent.snapshotDigest)}/intent.json`) throw problem();
      result.push(intent.intent);
    }
    return result;
  }
}
