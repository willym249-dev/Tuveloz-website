import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("provider application core records commit in one D1 batch", async () => {
  const route = await read("app/api/providers/route.ts");
  const batch = route.indexOf("await db.batch([");
  const notification = route.lastIndexOf("await notifyProviderApplicationReceived");

  assert.notEqual(batch, -1);
  for (const statement of [
    "applicationInsert",
    "pathwayInsert",
    "personnelInsert",
    "...acceptanceInserts",
    "auditInsert",
  ]) {
    assert.ok(route.slice(batch).includes(statement), `missing atomic statement ${statement}`);
  }
  assert.ok(notification > batch, "best-effort delivery must happen after the database commit");
  assert.ok(route.includes("A failure in any"));
  assert.ok(route.includes("rolls back the application row too"));
});

test("a safe provider application retry returns the saved application", async () => {
  const route = await read("app/api/providers/route.ts");
  const existing = route.slice(
    route.indexOf("if (existing[0])"),
    route.indexOf("const now = new Date().toISOString()"),
  );

  assert.ok(existing.includes("ok: true"));
  assert.ok(existing.includes("existing: true"));
  assert.ok(existing.includes("applicationId: existing[0].id"));
  assert.ok(existing.includes("{ status: 200 }"));
  assert.ok(!existing.includes("{ status: 409 }"));
});
